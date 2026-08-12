"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import { enviarCorreo } from "@/lib/email";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireInventario() {
  return exigirEscritura("compras.solicitudes");
}

// ─────────────── Carga desde Excel ───────────────

/** Tope de líneas por solicitud: sobre esto ya no es un pedido, es el catálogo entero. */
const MAX_LINEAS_EXCEL = 300;

export interface LineaExcel {
  productoId: string;
  cantidad: number;
  /** Precio del archivo, o null si venía vacío: el formulario vuelve a sugerir el suyo. */
  precio: number | null;
}

export interface CargaExcelState {
  error?: string;
  lineas?: LineaExcel[];
  resumen?: {
    cargadas: number;
    /** Filas con SKU pero sin cantidad: el resto del catálogo, se ignoran a propósito. */
    sinCantidad: number;
    /** SKUs del archivo que no existen (o están inactivos) en el catálogo. */
    desconocidos: string[];
    /** Filas con cantidad ilegible o negativa. */
    invalidas: number;
  };
}

function celdaTexto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? "").trim();
  }
  if (typeof v === "object" && "richText" in (v as Record<string, unknown>)) {
    const partes = (v as { richText: { text: string }[] }).richText;
    return partes.map((p) => p.text).join("").trim();
  }
  if (typeof v === "object" && "result" in (v as Record<string, unknown>)) {
    return String((v as { result: unknown }).result ?? "").trim();
  }
  return String(v).trim();
}

function celdaNumero(v: unknown): number | null {
  const texto = celdaTexto(v);
  if (!texto) return null;
  const n = Number(texto.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee el .xlsx de la plantilla y devuelve las líneas para llenar la grilla.
 *
 * **No crea nada**: el resultado aterriza en el formulario de Nueva Solicitud, el
 * comprador revisa —ahí se ven stock, precios y totales— y recién al enviar corre
 * `crearSolicitudes` con las validaciones de siempre. Subir el archivo equivale a
 * teclear rápido, no a saltarse la revisión.
 *
 * La plantilla baja con el catálogo completo, así que la regla de lectura es una sola:
 * manda la columna Cantidad. Fila sin cantidad = producto que no se pide.
 */
export async function cargarSolicitudExcel(
  _prev: CargaExcelState,
  formData: FormData,
): Promise<CargaExcelState> {
  try {
    await requireInventario();

    const archivo = formData.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { error: "Selecciona un archivo .xlsx." };
    }

    const workbook = new ExcelJS.Workbook();
    try {
      // El .d.ts de exceljs declara su propio tipo `Buffer` (shim para cuando no
      // hay @types/node), que no coincide estructuralmente con el Buffer real.
      const buffer = Buffer.from(await archivo.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
    } catch {
      return {
        error:
          "No pude leer el archivo. Debe ser el .xlsx de la plantilla, sin convertirlo a otro formato.",
      };
    }

    const hoja = workbook.getWorksheet("Solicitud") ?? workbook.worksheets[0];
    if (!hoja) return { error: "El archivo no tiene hojas con datos." };

    const indice: Record<string, number> = {};
    hoja.getRow(1).eachCell((cell, colNumber) => {
      indice[celdaTexto(cell.value).toLowerCase()] = colNumber;
    });
    const colSku = indice["sku"];
    const colCantidad = indice["cantidad"];
    // El precio se busca por nombre flexible: "Precio compra (neto)", "Precio", etc.
    const colPrecio = Object.entries(indice).find(([h]) => h.startsWith("precio"))?.[1];
    if (!colSku || !colCantidad) {
      return {
        error: "El archivo no tiene las columnas SKU y Cantidad. Descarga la plantilla nuevamente.",
      };
    }

    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, sku: true },
    });
    const porSku = new Map(productos.map((p) => [p.sku.toUpperCase(), p.id]));

    // Se acumula por producto: si el mismo SKU aparece dos veces, las cantidades se
    // suman y queda el último precio informado. Es lo que la persona quiso decir.
    const acumulado = new Map<string, { cantidad: number; precio: number | null }>();
    const desconocidos: string[] = [];
    let sinCantidad = 0;
    let invalidas = 0;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const sku = celdaTexto(row.getCell(colSku).value).toUpperCase();
      const cantidadRaw = celdaTexto(row.getCell(colCantidad).value);
      const cantidad = celdaNumero(row.getCell(colCantidad).value);

      if (!sku) return; // fila en blanco
      if (cantidadRaw === "") {
        sinCantidad++;
        return;
      }
      if (cantidad === null || cantidad < 0 || !Number.isInteger(cantidad) || cantidad > 1_000_000) {
        invalidas++;
        return;
      }
      if (cantidad === 0) {
        sinCantidad++;
        return;
      }

      const productoId = porSku.get(sku);
      if (!productoId) {
        if (!desconocidos.includes(sku)) desconocidos.push(sku);
        return;
      }

      const precioRaw = colPrecio ? celdaNumero(row.getCell(colPrecio).value) : null;
      const precio = precioRaw !== null && precioRaw >= 0 ? Math.round(precioRaw) : null;

      const previo = acumulado.get(productoId);
      acumulado.set(productoId, {
        cantidad: (previo?.cantidad ?? 0) + cantidad,
        precio: precio ?? previo?.precio ?? null,
      });
    });

    const lineas: LineaExcel[] = [...acumulado.entries()].map(([productoId, v]) => ({
      productoId,
      cantidad: v.cantidad,
      precio: v.precio,
    }));

    if (lineas.length === 0) {
      return {
        error:
          desconocidos.length > 0
            ? `Ninguna fila válida: ${desconocidos.length} SKU no existen en el catálogo (${desconocidos.slice(0, 5).join(", ")}${desconocidos.length > 5 ? "…" : ""}).`
            : "El archivo no trae ninguna fila con cantidad. Completa la columna Cantidad en los productos que quieres pedir.",
      };
    }
    if (lineas.length > MAX_LINEAS_EXCEL) {
      return {
        error: `El archivo trae ${lineas.length} líneas y el máximo por solicitud es ${MAX_LINEAS_EXCEL}. Divide el pedido.`,
      };
    }

    return {
      lineas,
      resumen: {
        cargadas: lineas.length,
        sinCantidad,
        desconocidos,
        invalidas,
      },
    };
  } catch (e) {
    console.error("[cargarSolicitudExcel] fallo inesperado:", e);
    return { error: "Error al leer el archivo." };
  }
}

/** Crea una solicitud de reposición hacia la casa matriz. */
export async function crearSolicitud(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();
    const productoId = String(formData.get("productoId") ?? "");
    const localId =
      esRolGlobal(session.rol)
        ? String(formData.get("localId") ?? "")
        : session.localId!;
    const cantidad = Math.trunc(Number(formData.get("cantidad") ?? 0));
    const nota = String(formData.get("nota") ?? "").trim() || null;

    if (!productoId || !localId || cantidad <= 0) {
      return { error: "Cantidad inválida." };
    }

    const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });
    if (!matriz) return { error: "No hay casa matriz definida (módulo Locales)." };
    if (matriz.id === localId) {
      return { error: "La casa matriz no puede solicitarse a sí misma." };
    }

    // Evitar duplicados pendientes del mismo producto/local
    const existente = await prisma.solicitudReposicion.findFirst({
      where: { productoId, localId, estado: "PENDIENTE" },
    });
    if (existente) {
      return { error: "Ya existe una solicitud pendiente de este producto." };
    }

    const max = await prisma.solicitudReposicion.aggregate({ _max: { correlativo: true } });
    const folio = (max._max?.correlativo ?? 0) + 1;
    await prisma.solicitudReposicion.create({
      data: { correlativo: folio, productoId, localId, cantidad, nota, solicitanteId: session.sub },
    });

    revalidatePath("/dashboard/solicitudes");
    return { ok: `Solicitud SOL-${String(folio).padStart(6, "0")} enviada a casa matriz.` };
  } catch {
    return { error: "Error al crear la solicitud." };
  }
}

/** Crea varias solicitudes de una vez (pedido consolidado). */
export async function crearSolicitudes(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();
    let lineas: {
      productoId: string;
      localId: string;
      cantidad: number;
      costoUnitario?: number;
    }[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Pedido inválido." };
    }
    const nota = String(formData.get("nota") ?? "").trim() || null;
    const proveedorId = String(formData.get("proveedorId") ?? "") || null;
    const destino = proveedorId ? "PROVEEDOR" : "MATRIZ";

    // Fecha requerida de entrega (solo compra a proveedor), formato YYYY-MM-DD
    let fechaRequerida: Date | null = null;
    const fechaRaw = String(formData.get("fechaRequerida") ?? "").trim();
    if (destino === "PROVEEDOR" && /^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
      // Mediodía UTC para que la fecha no se corra al formatear en Chile
      fechaRequerida = new Date(`${fechaRaw}T12:00:00Z`);
      if (Number.isNaN(fechaRequerida.getTime())) fechaRequerida = null;
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "Selecciona al menos un producto." };
    }

    let matrizId: string | null = null;
    if (destino === "MATRIZ") {
      const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });
      if (!matriz) return { error: "No hay casa matriz definida (módulo Locales)." };
      matrizId = matriz.id;
    } else {
      const proveedor = await prisma.socioNegocio.findUnique({ where: { id: proveedorId! } });
      if (!proveedor || !proveedor.activo || proveedor.tipo !== "PROVEEDOR") {
        return { error: "Proveedor inválido." };
      }
    }

    let creadas = 0;
    let consolidadas = 0;
    let omitidas = 0;
    let folio = 0;

    await prisma.$transaction(async (tx) => {
      // Correlativo interno del documento (compartido por todas las líneas del envío)
      const max = await tx.solicitudReposicion.aggregate({ _max: { correlativo: true } });
      folio = (max._max?.correlativo ?? 0) + 1;

      for (const l of lineas) {
        const cantidad = Math.trunc(Number(l.cantidad));
        const localId =
          esRolGlobal(session.rol) ? l.localId : session.localId!;
        if (!l.productoId || !localId || cantidad <= 0 || localId === matrizId) {
          omitidas++;
          continue;
        }
        const existente = await tx.solicitudReposicion.findFirst({
          where: {
            productoId: l.productoId,
            localId,
            estado: "PENDIENTE",
            destino,
            proveedorId,
          },
        });
        if (existente) {
          // Ya venía en una OC: esa línea tiene dueño, no se toca.
          if (existente.ordenCompraId) {
            omitidas++;
            continue;
          }
          // Antes esto se omitía en silencio y el documento nuevo aparecía con menos
          // líneas de las que la persona pidió — parecía que la pantalla se las comía.
          // Ahora la línea pendiente se CONSOLIDA: se trae a este folio sumando
          // cantidades, con el precio y la fecha recién informados. Sigue sin haber
          // duplicados, pero lo pedido queda completo en el documento que se acaba
          // de crear, que es donde la persona lo va a buscar.
          await tx.solicitudReposicion.update({
            where: { id: existente.id },
            data: {
              correlativo: folio,
              cantidad: existente.cantidad + cantidad,
              costoUnitario:
                destino === "PROVEEDOR" && l.costoUnitario != null
                  ? Math.max(Math.trunc(l.costoUnitario), 0)
                  : existente.costoUnitario,
              fechaRequerida: fechaRequerida ?? existente.fechaRequerida,
              nota: nota ?? existente.nota,
            },
          });
          consolidadas++;
          continue;
        }
        await tx.solicitudReposicion.create({
          data: {
            correlativo: folio,
            productoId: l.productoId,
            localId,
            cantidad,
            costoUnitario:
              destino === "PROVEEDOR" && l.costoUnitario != null
                ? Math.max(Math.trunc(l.costoUnitario), 0)
                : null,
            fechaRequerida,
            nota,
            destino,
            proveedorId,
            solicitanteId: session.sub,
          },
        });
        creadas++;
      }
    });

    revalidatePath("/dashboard/solicitudes");
    if (creadas + consolidadas === 0) {
      return { error: "No se creó ninguna solicitud (revisa cantidades y líneas)." };
    }
    const partes = [
      `${creadas + consolidadas} producto${creadas + consolidadas === 1 ? "" : "s"}`,
      consolidadas > 0
        ? `${consolidadas} venía${consolidadas === 1 ? "" : "n"} pendiente${consolidadas === 1 ? "" : "s"} de antes y se consolidó acá sumando cantidades`
        : null,
      omitidas > 0 ? `${omitidas} omitido${omitidas === 1 ? "" : "s"} (inválidos o ya en OC)` : null,
    ].filter(Boolean);
    return {
      ok: `Solicitud SOL-${String(folio).padStart(6, "0")} creada: ${partes.join(" · ")}.`,
    };
  } catch {
    return { error: "Error al enviar el pedido." };
  }
}

/**
 * Elimina líneas de solicitud. Solo pendientes, sin OC vinculada.
 * Puede: admin, encargado de matriz, el solicitante o el local que la creó.
 */
export async function eliminarSolicitudes(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();
    let ids: string[] = [];
    try {
      const raw = JSON.parse(String(formData.get("ids") ?? "[]"));
      if (Array.isArray(raw)) ids = raw.filter((x) => typeof x === "string");
    } catch {
      return { error: "Datos inválidos." };
    }
    if (ids.length === 0) return { error: "Nada que eliminar." };

    const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });
    const esEncargado =
      esRolGlobal(session.rol) || (matriz !== null && session.localId === matriz.id);

    const solicitudes = await prisma.solicitudReposicion.findMany({
      where: { id: { in: ids } },
    });
    if (solicitudes.length === 0) return { error: "Solicitudes no encontradas." };

    for (const s of solicitudes) {
      if (s.estado !== "PENDIENTE" && s.estado !== "COTIZADA") {
        return { error: "Solo se pueden eliminar solicitudes pendientes o cotizadas." };
      }
      if (s.ordenCompraId) {
        return { error: "No se puede eliminar: ya fue copiada a una Orden de Compra." };
      }
      const puede =
        esEncargado || s.solicitanteId === session.sub || s.localId === session.localId;
      if (!puede) return { error: "No autorizado para eliminar esta solicitud." };
    }

    await prisma.solicitudReposicion.deleteMany({ where: { id: { in: ids } } });
    revalidatePath("/dashboard/solicitudes");
    const n = solicitudes.length;
    return { ok: `${n} línea${n === 1 ? "" : "s"} eliminada${n === 1 ? "" : "s"}.` };
  } catch {
    return { error: "Error al eliminar la solicitud." };
  }
}

/** Rechaza todas las líneas pendientes de una solicitud (ej: proveedor no cotiza). */
export async function rechazarSolicitudes(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();
    let ids: string[] = [];
    try {
      const raw = JSON.parse(String(formData.get("ids") ?? "[]"));
      if (Array.isArray(raw)) ids = raw.filter((x) => typeof x === "string");
    } catch {
      return { error: "Datos inválidos." };
    }
    if (ids.length === 0) return { error: "Nada que rechazar." };

    const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });
    const esEncargado =
      esRolGlobal(session.rol) || (matriz !== null && session.localId === matriz.id);

    const solicitudes = await prisma.solicitudReposicion.findMany({
      where: { id: { in: ids } },
    });
    for (const s of solicitudes) {
      if (s.estado !== "PENDIENTE" && s.estado !== "COTIZADA") {
        return { error: "Solo se rechazan líneas pendientes o cotizadas." };
      }
      if (s.ordenCompraId) return { error: "Ya fue copiada a una Orden de Compra." };
      const puede =
        esEncargado || s.solicitanteId === session.sub || s.localId === session.localId;
      if (!puede) return { error: "No autorizado." };
    }

    await prisma.solicitudReposicion.updateMany({
      where: { id: { in: ids } },
      data: { estado: "RECHAZADA", resueltoPorId: session.sub, resueltoEn: new Date() },
    });
    revalidatePath("/dashboard/solicitudes");
    return { ok: "Solicitud rechazada." };
  } catch {
    return { error: "Error al rechazar la solicitud." };
  }
}

/**
 * Actualiza una solicitud (solo líneas pendientes, sin OC vinculada):
 * cantidades, precios referenciales y fecha requerida.
 */
export async function actualizarSolicitud(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();

    let lineas: { id: string; cantidad: number; precio: number | null }[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Datos inválidos." };
    }
    if (!Array.isArray(lineas) || lineas.length === 0) return { error: "Nada que actualizar." };

    // Fecha requerida (opcional) — mediodía UTC evita corrimiento de día
    let fechaRequerida: Date | null | undefined;
    const fechaRaw = String(formData.get("fechaRequerida") ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(fechaRaw)) {
      fechaRequerida = new Date(`${fechaRaw}T12:00:00Z`);
      if (Number.isNaN(fechaRequerida.getTime())) fechaRequerida = undefined;
    }

    const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });
    const esEncargado =
      esRolGlobal(session.rol) || (matriz !== null && session.localId === matriz.id);

    const existentes = await prisma.solicitudReposicion.findMany({
      where: { id: { in: lineas.map((l) => l.id) } },
    });
    if (existentes.length === 0) return { error: "Solicitud no encontrada." };

    for (const s of existentes) {
      if (s.estado !== "PENDIENTE" && s.estado !== "COTIZADA") {
        return { error: "Solo se pueden editar líneas pendientes o cotizadas." };
      }
      if (s.ordenCompraId) {
        return { error: "No se puede editar: ya fue copiada a una Orden de Compra." };
      }
      const puede =
        esEncargado || s.solicitanteId === session.sub || s.localId === session.localId;
      if (!puede) return { error: "No autorizado para editar esta solicitud." };
    }

    const porId = new Map(lineas.map((l) => [l.id, l]));
    await prisma.$transaction(
      existentes.map((s) => {
        const l = porId.get(s.id)!;
        const cantidad = Math.max(1, Math.trunc(Number(l.cantidad)) || 1);
        const precio =
          l.precio != null && Number.isFinite(Number(l.precio))
            ? Math.max(0, Math.trunc(Number(l.precio)))
            : s.costoUnitario;
        return prisma.solicitudReposicion.update({
          where: { id: s.id },
          data: {
            cantidad,
            costoUnitario: precio,
            ...(fechaRequerida !== undefined ? { fechaRequerida } : {}),
          },
        });
      }),
    );

    revalidatePath("/dashboard/solicitudes");
    return { ok: "Solicitud actualizada." };
  } catch {
    return { error: "Error al actualizar la solicitud." };
  }
}

/** Envía por correo la cotización (solicitudes pendientes) a un proveedor. */
export async function enviarCotizacion(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireInventario();
    const proveedorId = String(formData.get("proveedorId") ?? "");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const comentario = String(formData.get("comentario") ?? "").trim();

    if (!proveedorId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "Ingresa un correo válido." };
    }

    const proveedor = await prisma.socioNegocio.findUnique({ where: { id: proveedorId } });
    if (!proveedor) return { error: "Proveedor no encontrado." };

    const solicitudes = await prisma.solicitudReposicion.findMany({
      where: {
        proveedorId,
        destino: "PROVEEDOR",
        estado: { in: ["PENDIENTE", "COTIZADA"] },
      },
      include: { producto: true, local: true },
      orderBy: { creadoEn: "asc" },
    });
    if (solicitudes.length === 0) {
      return { error: "No hay solicitudes abiertas para este proveedor." };
    }

    const conPrecio = solicitudes.some((s) => s.costoUnitario != null);
    const clp = (n: number) => `$${n.toLocaleString("es-CL")}`;
    const fmtFechaReq = new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeZone: "UTC" });
    // Fecha requerida más próxima entre las solicitudes del envío
    const fechasReq = solicitudes
      .map((s) => s.fechaRequerida)
      .filter((f): f is Date => f !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const entregaRequerida = fechasReq[0] ? fmtFechaReq.format(fechasReq[0]) : null;
    const neto = solicitudes.reduce(
      (t, s) => t + (s.costoUnitario ?? 0) * s.cantidad,
      0,
    );
    const iva = Math.round(neto * 0.19);

    // Número de referencia: folio(s) SOL del envío
    const folios = [
      ...new Set(
        solicitudes
          .filter((s) => s.correlativo != null)
          .map((s) => `SOL-${String(s.correlativo).padStart(6, "0")}`),
      ),
    ];
    const numeroRef =
      folios.length === 0
        ? ""
        : folios.length === 1
          ? folios[0]
          : `${folios[0]} (+${folios.length - 1})`;
    const fmtCorta = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "UTC" });
    const hoy = new Intl.DateTimeFormat("es-CL", { dateStyle: "long" }).format(new Date());

    // Logo: requiere URL pública del sitio (NEXT_PUBLIC_SITE_URL); si no, marca tipográfica
    const sitio = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
    const logo = sitio
      ? `<img src="${sitio}/logo-fenix.png?v=2" width="44" height="44" alt="" style="display:block;border-radius:50%;background:#ffffff;">`
      : `<div style="width:44px;height:44px;border-radius:50%;background:#ffffff;color:#0e518d;font-weight:bold;font-size:16px;text-align:center;line-height:44px;">PF</div>`;

    const celda = "padding:10px 12px;border-top:1px solid #e8edf4;vertical-align:top;";
    const filas = solicitudes
      .map(
        (s, i) => `<tr style="background:${i % 2 === 0 ? "#ffffff" : "#f7fafc"};">
          <td style="${celda}font-family:monospace;font-size:12px;color:#64748b;white-space:nowrap;">${s.producto.sku}</td>
          <td style="${celda}">
            <span style="font-weight:bold;color:#0b0f17;">${s.producto.nombre}</span><br>
            <span style="color:#94a3b8;font-size:12px;">
              ${s.correlativo != null ? `Ref. SOL-${String(s.correlativo).padStart(6, "0")} · ` : ""}
              Entregar en ${s.local.nombre} — ${s.local.direccion}, ${s.local.comuna}
              ${s.fechaRequerida ? `<br>📦 <b style="color:#0e518d;">Requerida: ${fmtCorta.format(s.fechaRequerida)}</b>` : ""}
            </span>
          </td>
          <td style="${celda}text-align:center;font-weight:bold;color:#0b0f17;">${s.cantidad}</td>
          ${
            conPrecio
              ? `<td style="${celda}text-align:right;color:#475569;">${
                  s.costoUnitario != null ? clp(s.costoUnitario) : "—"
                }</td>
          <td style="${celda}text-align:right;font-weight:bold;color:#0b0f17;">${
            s.costoUnitario != null ? clp(s.costoUnitario * s.cantidad) : "—"
          }</td>`
              : ""
          }
        </tr>`,
      )
      .join("");

    const totales = conPrecio
      ? `<table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:4px;">
          <tr><td style="text-align:right;padding:3px 12px;color:#64748b;">Neto ref.</td><td style="text-align:right;padding:3px 12px;width:120px;color:#0b0f17;">${clp(neto)}</td></tr>
          <tr><td style="text-align:right;padding:3px 12px;color:#64748b;">IVA 19%</td><td style="text-align:right;padding:3px 12px;color:#0b0f17;">${clp(iva)}</td></tr>
          <tr><td style="text-align:right;padding:8px 12px;font-weight:bold;border-top:2px solid #0e518d;color:#0b0f17;">Total ref.</td><td style="text-align:right;padding:8px 12px;font-weight:bold;border-top:2px solid #0e518d;color:#0e518d;font-size:16px;">${clp(neto + iva)}</td></tr>
        </table>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:12px;">* Precios referenciales según nuestro último costo. Favor confirmar.</p>`
      : "";

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:620px;margin:0 auto;color:#0b0f17;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <!-- Encabezado corporativo -->
        <table style="width:100%;border-collapse:collapse;background:#0e518d;">
          <tr>
            <td style="padding:18px 24px;width:56px;">${logo}</td>
            <td style="padding:18px 8px;">
              <span style="display:block;color:#ffffff;font-size:19px;font-weight:bold;letter-spacing:0.5px;">PINTURAS FENIX</span>
              <span style="display:block;color:#bcd6ec;font-size:13px;">Solicitud de cotización</span>
            </td>
            <td style="padding:18px 24px;text-align:right;">
              ${numeroRef ? `<span style="display:block;color:#ffffff;font-family:monospace;font-size:15px;font-weight:bold;">${numeroRef}</span>` : ""}
              <span style="display:block;color:#bcd6ec;font-size:12px;">${hoy}</span>
            </td>
          </tr>
        </table>

        <div style="padding:20px 24px;">
          <p style="margin:0 0 14px;color:#334155;font-size:14px;">
            Estimados <b>${proveedor.nombreFantasia ?? proveedor.razonSocial}</b>:<br>
            Solicitamos cotización por los siguientes productos:
          </p>
          ${
            entregaRequerida
              ? `<p style="margin:0 0 14px;padding:10px 14px;background:#eaf2f9;border-left:4px solid #0e518d;border-radius:6px;color:#0e518d;font-size:14px;">
                  📦 <b>Entrega requerida:</b> ${entregaRequerida}
                </p>`
              : ""
          }
          ${
            comentario
              ? `<p style="margin:0 0 14px;padding:10px 14px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:6px;color:#7c5307;font-size:14px;">
                  💬 ${comentario.replaceAll("<", "&lt;").replaceAll(">", "&gt;")}
                </p>`
              : ""
          }
          <table style="width:100%;border-collapse:collapse;font-size:14px;">
            <tr style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;text-align:left;background:#f1f5f9;">
              <th style="padding:8px 12px;">SKU</th><th style="padding:8px 12px;">Producto</th><th style="padding:8px 12px;text-align:center;">Cant.</th>${
                conPrecio
                  ? `<th style="padding:8px 12px;text-align:right;">Precio ref.</th><th style="padding:8px 12px;text-align:right;">Total</th>`
                  : ""
              }
            </tr>
            ${filas}
          </table>
          ${totales}
          <p style="margin:20px 0 0;color:#475569;font-size:14px;">
            Favor indicar precios, disponibilidad y plazo de entrega respondiendo a este correo.
          </p>
        </div>

        <!-- Pie -->
        <div style="padding:14px 24px;background:#f7fafc;border-top:1px solid #e2e8f0;">
          <span style="color:#334155;font-size:13px;font-weight:bold;">Pinturas Fenix</span>
          <span style="color:#94a3b8;font-size:12px;"> · San Bernardo / Buin · WhatsApp +56 9 3390 8415</span>
        </div>
      </div>`;

    const envio = await enviarCorreo({
      para: email,
      asunto: `Solicitud de cotización${numeroRef ? ` ${numeroRef}` : ""} · Pinturas Fenix (${solicitudes.length} productos)`,
      html,
    });
    // El motivo real ya viene traducido desde lib/email.ts (credenciales, host, etc.).
    if (!envio.ok) return { error: envio.error };

    // Marcar como COTIZADA: sale de la cola "Pendientes de cotizar"
    await prisma.solicitudReposicion.updateMany({
      where: { id: { in: solicitudes.map((s) => s.id) } },
      data: { estado: "COTIZADA" },
    });
    revalidatePath("/dashboard/solicitudes");

    return { ok: `Cotización enviada a ${email} (${solicitudes.length} productos).` };
  } catch {
    return { error: "Error al enviar la cotización." };
  }
}

/** El encargado de matriz (o admin) despacha o rechaza una solicitud. */
export async function resolverSolicitud(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();
    const id = String(formData.get("id") ?? "");
    const accion = String(formData.get("accion") ?? ""); // "despachar" | "rechazar"
    const notaResolucion = String(formData.get("notaResolucion") ?? "").trim() || null;

    const solicitud = await prisma.solicitudReposicion.findUnique({
      where: { id },
      include: { producto: true, local: true },
    });
    if (!solicitud || solicitud.estado !== "PENDIENTE") {
      return { error: "Solicitud no encontrada o ya resuelta." };
    }

    const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });

    // Matriz: resuelve admin o usuarios de la casa matriz.
    // Proveedor: resuelve admin, matriz o el propio local que solicitó (al recibir la mercadería).
    const esEncargado =
      esRolGlobal(session.rol) ||
      (matriz !== null && session.localId === matriz.id) ||
      (solicitud.destino === "PROVEEDOR" && session.localId === solicitud.localId);
    if (!esEncargado) return { error: "No autorizado para resolver esta solicitud." };
    if (solicitud.destino === "MATRIZ" && !matriz) {
      return { error: "No hay casa matriz definida." };
    }

    if (accion === "rechazar") {
      await prisma.solicitudReposicion.update({
        where: { id },
        data: {
          estado: "RECHAZADA",
          resueltoPorId: session.sub,
          resueltoEn: new Date(),
          notaResolucion,
        },
      });
      revalidatePath("/dashboard/solicitudes");
      return { ok: "Solicitud rechazada." };
    }

    if (accion !== "despachar") return { error: "Acción inválida." };

    // Solicitud a proveedor: marcar recibida (el stock entra con movimiento de Entrada)
    if (solicitud.destino === "PROVEEDOR") {
      await prisma.solicitudReposicion.update({
        where: { id },
        data: {
          estado: "DESPACHADA",
          resueltoPorId: session.sub,
          resueltoEn: new Date(),
          notaResolucion,
        },
      });
      revalidatePath("/dashboard/solicitudes");
      return {
        ok: `Marcada como recibida. Recuerda ingresar el stock con un movimiento de Entrada.`,
      };
    }

    // Despachar = transferencia matriz → local solicitante (transaccional)
    if (!matriz) return { error: "No hay casa matriz definida." };
    await prisma.$transaction(async (tx) => {
      const stockMatriz = await tx.stockLocal.findUnique({
        where: { productoId_localId: { productoId: solicitud.productoId, localId: matriz.id } },
      });
      if (!stockMatriz || stockMatriz.cantidad < solicitud.cantidad) {
        throw new Error(`STOCK:${stockMatriz?.cantidad ?? 0}`);
      }
      await tx.stockLocal.update({
        where: { productoId_localId: { productoId: solicitud.productoId, localId: matriz.id } },
        data: { cantidad: { decrement: solicitud.cantidad } },
      });
      await tx.stockLocal.upsert({
        where: {
          productoId_localId: { productoId: solicitud.productoId, localId: solicitud.localId },
        },
        update: { cantidad: { increment: solicitud.cantidad } },
        create: {
          productoId: solicitud.productoId,
          localId: solicitud.localId,
          cantidad: solicitud.cantidad,
        },
      });
      const salida = await tx.movimientoInventario.create({
        data: {
          tipo: "TRANSFERENCIA_SALIDA",
          productoId: solicitud.productoId,
          localId: matriz.id,
          cantidad: -solicitud.cantidad,
          usuarioId: session.sub,
          nota: `Solicitud de ${solicitud.local.nombre}`,
        },
      });
      await tx.movimientoInventario.create({
        data: {
          tipo: "TRANSFERENCIA_ENTRADA",
          productoId: solicitud.productoId,
          localId: solicitud.localId,
          cantidad: solicitud.cantidad,
          usuarioId: session.sub,
          transferenciaPar: salida.id,
          nota: "Reposición desde casa matriz",
        },
      });
      await tx.solicitudReposicion.update({
        where: { id },
        data: {
          estado: "DESPACHADA",
          resueltoPorId: session.sub,
          resueltoEn: new Date(),
          notaResolucion,
        },
      });
    });

    revalidatePath("/dashboard/solicitudes");
    revalidatePath("/dashboard/inventario");
    return { ok: `Despachado: ${solicitud.cantidad}x ${solicitud.producto.nombre} → ${solicitud.local.nombre}.` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("STOCK:")) {
      return { error: `Stock insuficiente en matriz (disponible: ${msg.slice(6)}).` };
    }
    return { error: "Error al resolver la solicitud." };
  }
}
