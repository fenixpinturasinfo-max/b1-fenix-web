"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal, type SessionPayload } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import { instanteSantiago } from "@/lib/fechas";
import ExcelJS from "exceljs";
import {
  HORA_CONTEO_POR_DEFECTO,
  objetivoDeStock,
  TOP_ALTO_VALOR,
  type AlcanceToma,
  type MotivoAjuste,
} from "./toma";

export interface ActionState {
  error?: string;
  ok?: string;
  tomaId?: string;
}

const ALCANCES_VALIDOS = ["TOTAL", "CATEGORIA", "UBICACION", "MARCA", "ALTO_VALOR"];
const MOTIVOS_VALIDOS = [
  "MERMA",
  "ROBO",
  "ERROR_RECEPCION",
  "ERROR_CONTEO",
  "VENCIDO",
  "OTRO",
];

function validaLocal(session: { rol: string; localId: string | null }, localId: string) {
  return esRolGlobal(session.rol) || session.localId === localId;
}

/**
 * Abre una toma y congela el esperado de cada producto del alcance.
 *
 * Los alcances TOTAL, CATEGORIA y MARCA incluyen el catálogo activo completo, aunque el
 * producto no tenga fila de `StockLocal`: ahí es justo donde puede haber mercadería no
 * registrada, y dejarlo fuera sería no contar el caso que más interesa.
 *
 * UBICACION y ALTO_VALOR sí dependen de la ficha de stock, porque se definen por ella:
 * un producto sin ubicación cargada no está en ese pasillo, y uno sin stock no puede
 * estar entre los de mayor valor.
 */
export async function abrirToma(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.toma");
    const localId = esRolGlobal(session.rol)
      ? String(formData.get("localId") ?? "")
      : (session.localId ?? "");
    const alcance = String(formData.get("alcance") ?? "") as AlcanceToma;
    const filtro = String(formData.get("filtro") ?? "").trim() || null;
    const nota = String(formData.get("nota") ?? "").trim() || null;
    const ciego = formData.get("ciego") === "on";

    if (!localId) return { error: "Selecciona el local." };
    if (!validaLocal(session, localId)) return { error: "No puedes operar otro local." };
    if (!ALCANCES_VALIDOS.includes(alcance)) return { error: "Alcance inválido." };
    if (alcance !== "TOTAL" && alcance !== "ALTO_VALOR" && !filtro) {
      return { error: "Elige qué vas a contar." };
    }
    // Para categoría llega el id, pero el filtro se muestra en pantalla: guardamos el nombre
    let etiqueta = filtro;
    if (alcance === "CATEGORIA" && filtro) {
      const cat = await prisma.categoria.findUnique({
        where: { id: filtro },
        select: { nombre: true },
      });
      if (!cat) return { error: "Categoría no encontrada." };
      etiqueta = cat.nombre;
    }

    // Dos personas contando el mismo pasillo generan dos verdades
    const abierta = await prisma.tomaInventario.findFirst({
      where: { localId, estado: "ABIERTA" },
      select: { correlativo: true },
    });
    if (abierta) {
      return {
        error: `Ya hay una toma en conteo en este local (TI-${String(abierta.correlativo).padStart(6, "0")}). Ciérrala antes de abrir otra.`,
      };
    }

    const stocks = await prisma.stockLocal.findMany({
      where: { localId },
      select: { productoId: true, cantidad: true, ubicacion: true },
    });
    const stockPor = new Map(stocks.map((s) => [s.productoId, s]));

    let productos = await prisma.producto.findMany({
      where: {
        activo: true,
        ...(alcance === "CATEGORIA" ? { categoriaId: filtro! } : {}),
        ...(alcance === "MARCA" ? { marca: filtro! } : {}),
      },
      select: { id: true, precioCosto: true },
      orderBy: { nombre: "asc" },
    });

    if (alcance === "UBICACION") {
      productos = productos.filter((p) => stockPor.get(p.id)?.ubicacion === filtro);
    }
    if (alcance === "ALTO_VALOR") {
      productos = [...productos]
        .sort(
          (a, b) =>
            (stockPor.get(b.id)?.cantidad ?? 0) * b.precioCosto -
            (stockPor.get(a.id)?.cantidad ?? 0) * a.precioCosto,
        )
        .slice(0, TOP_ALTO_VALOR);
    }

    if (productos.length === 0) {
      return { error: "No hay productos activos en ese alcance." };
    }

    const toma = await prisma.$transaction(async (tx) => {
      const max = await tx.tomaInventario.aggregate({ _max: { correlativo: true } });
      const creada = await tx.tomaInventario.create({
        data: {
          correlativo: (max._max.correlativo ?? 0) + 1,
          localId,
          alcance,
          filtro: etiqueta,
          nota,
          ciego,
          creadoPorId: session.sub,
          lineas: {
            create: productos.map((p) => ({
              productoId: p.id,
              esperado: stockPor.get(p.id)?.cantidad ?? 0,
            })),
          },
        },
        select: { id: true, correlativo: true },
      });
      return creada;
    });

    revalidatePath("/dashboard/inventario/tomas");
    return {
      ok: `Toma TI-${String(toma.correlativo).padStart(6, "0")} abierta con ${productos.length} productos.`,
      tomaId: toma.id,
    };
  } catch {
    return { error: "No autorizado o error al abrir la toma." };
  }
}

/** Guarda el conteo de una línea. Se graba al momento: una interrupción no borra la hora de trabajo. */
export async function contarLinea(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.toma");
    const lineaId = String(formData.get("lineaId") ?? "");
    const saltar = formData.get("saltar") === "1";
    const contadoRaw = String(formData.get("contado") ?? "");

    const linea = await prisma.tomaLinea.findUnique({
      where: { id: lineaId },
      include: { toma: { select: { estado: true, localId: true } } },
    });
    if (!linea) return { error: "Línea no encontrada." };
    if (linea.toma.estado !== "ABIERTA") return { error: "La toma ya no está en conteo." };
    if (!validaLocal(session, linea.toma.localId)) {
      return { error: "No puedes contar en otro local." };
    }

    if (saltar) {
      await prisma.tomaLinea.update({ where: { id: lineaId }, data: { saltada: true } });
      revalidatePath(`/dashboard/inventario/tomas`);
      return { ok: "Saltado." };
    }

    const contado = Math.trunc(Number(contadoRaw));
    if (contadoRaw === "" || !Number.isFinite(contado) || contado < 0) {
      return { error: "Ingresa una cantidad de 0 o más." };
    }

    await prisma.tomaLinea.update({
      where: { id: lineaId },
      data: {
        contado,
        // Contando en el móvil el instante del tecleo *es* el del conteo
        contadoEn: new Date(),
        contadoPorId: session.sub,
        origenConteo: "MOVIL",
        saltada: false,
      },
    });

    revalidatePath(`/dashboard/inventario/tomas`);
    return { ok: "Contado." };
  } catch {
    return { error: "Error al guardar el conteo." };
  }
}

/** Cierra el conteo y lo deja listo para revisión. */
export async function cerrarConteo(formData: FormData) {
  const session = await exigirEscritura("inventario.toma");
  const tomaId = String(formData.get("tomaId") ?? "");

  const toma = await prisma.tomaInventario.findUnique({
    where: { id: tomaId },
    include: { lineas: { select: { contado: true, contadoEn: true } } },
  });
  if (!toma || toma.estado !== "ABIERTA") return;
  if (!validaLocal(session, toma.localId)) return;
  // Sin ninguna línea contada no hay nada que revisar
  if (toma.lineas.every((l) => l.contado === null)) return;

  // Si nadie declaró la fecha del conteo (caso del contador móvil), se deduce del último
  // conteo grabado. Sirve para mostrarla y para avisar cuando el conteo ya está viejo.
  const fechas = toma.lineas.map((l) => l.contadoEn).filter((f): f is Date => f !== null);
  const fechaConteo =
    toma.fechaConteo ??
    (fechas.length > 0 ? new Date(Math.max(...fechas.map((f) => f.getTime()))) : null);

  await prisma.tomaInventario.update({
    where: { id: tomaId },
    data: { estado: "CONTADA", cerradaEn: new Date(), fechaConteo },
  });
  revalidatePath("/dashboard/inventario/tomas");
  revalidatePath(`/dashboard/inventario/tomas/${tomaId}`);
}

/** Devuelve la toma a conteo para recontar las diferencias. */
export async function pedirRecuento(formData: FormData) {
  const session = await exigirEscritura("inventario.toma-aprobar");
  const tomaId = String(formData.get("tomaId") ?? "");

  const toma = await prisma.tomaInventario.findUnique({ where: { id: tomaId } });
  if (!toma || toma.estado !== "CONTADA") return;
  if (!validaLocal(session, toma.localId)) return;

  // Vuelve a la cola solo lo que difiere del stock actual: recontar lo que ya cuadró
  // es perder el tiempo, y dejarlo todo contado haría que el contador no viera nada.
  const stocks = await prisma.stockLocal.findMany({
    where: { localId: toma.localId },
    select: { productoId: true, cantidad: true },
  });
  const stockPor = new Map(stocks.map((s) => [s.productoId, s.cantidad]));
  const lineas = await prisma.tomaLinea.findMany({
    where: { tomaId, contado: { not: null } },
    select: { id: true, productoId: true, contado: true },
  });
  const aRecontar = lineas
    .filter((l) => l.contado !== (stockPor.get(l.productoId) ?? 0))
    .map((l) => l.id);

  await prisma.$transaction([
    prisma.tomaLinea.updateMany({
      where: { id: { in: aRecontar } },
      data: {
        contado: null,
        contadoEn: null,
        contadoPorId: null,
        origenConteo: null,
        saltada: false,
      },
    }),
    prisma.tomaInventario.update({
      where: { id: tomaId },
      data: { estado: "ABIERTA", cerradaEn: null },
    }),
  ]);
  revalidatePath("/dashboard/inventario/tomas");
}

const MIN_MOTIVO_ANULACION = 5;

/**
 * Anula una toma: descarta el conteo sin tocar el stock.
 *
 * El motivo es obligatorio, a diferencia de anular una OC. Anular una toma bota trabajo de
 * bodega ya hecho —a veces cientos de líneas contadas a mano— y el conteo descartado es
 * justamente la evidencia de lo que faltaba. Sin un motivo escrito no hay forma de
 * distinguir después un error de digitación de un faltante que alguien prefirió no aplicar.
 */
export async function anularToma(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const tomaId = String(formData.get("tomaId") ?? "");
    const motivo = String(formData.get("motivo") ?? "").trim();

    const previa = await prisma.tomaInventario.findUnique({
      where: { id: tomaId },
      select: { id: true, estado: true, localId: true, correlativo: true },
    });
    if (!previa) return { error: "Toma no encontrada." };
    if (previa.estado === "APLICADA") {
      return {
        error:
          "Esta toma ya fue aplicada y su ajuste está en el stock. Para revertirlo registra un movimiento de ajuste.",
      };
    }
    if (previa.estado === "ANULADA") return { error: "Esta toma ya está anulada." };

    // Anular un conteo ya cerrado borraría el rastro antes de que nadie lo revise:
    // eso lo decide quien aprueba, no quien contó.
    const cerrada = previa.estado === "CONTADA";
    let session: SessionPayload;
    try {
      session = await exigirEscritura(cerrada ? "inventario.toma-aprobar" : "inventario.toma");
    } catch {
      // Distinguir el permiso del resto: "no autorizado o error" no le sirve a nadie
      return {
        error: cerrada
          ? "Este conteo ya está cerrado: solo quien aprueba tomas puede anularlo."
          : "No tienes permiso para anular tomas de inventario.",
      };
    }
    if (!validaLocal(session, previa.localId)) {
      return { error: "No puedes anular una toma de otro local." };
    }

    if (motivo.length < MIN_MOTIVO_ANULACION) {
      return { error: "Escribe el motivo de la anulación (mínimo 5 caracteres)." };
    }

    // Condicionado por estado: dos clics simultáneos pasarían los dos el chequeo de arriba
    const anulada = await prisma.tomaInventario.updateMany({
      where: { id: tomaId, estado: previa.estado },
      data: {
        estado: "ANULADA",
        anuladaPorId: session.sub,
        anuladaEn: new Date(),
        motivoAnulacion: motivo,
      },
    });
    if (anulada.count !== 1) {
      return { error: "La toma cambió de estado mientras la anulabas. Recarga la página." };
    }

    revalidatePath("/dashboard/inventario/tomas");
    revalidatePath(`/dashboard/inventario/tomas/${tomaId}`);
    return {
      ok: `Toma TI-${String(previa.correlativo).padStart(6, "0")} anulada. El stock no se modificó.`,
    };
  } catch (e) {
    // Sin esto, una columna que falta o un FK roto se ven igual que un permiso denegado
    console.error("[anularToma] fallo inesperado:", e);
    return {
      error:
        "No se pudo anular la toma por un error del servidor. Revisa el log del proceso para ver la causa.",
    };
  }
}

// ─────────────── Conteo por planilla: vista previa e importación ───────────────

/** Fila de la planilla, ya clasificada. Nada se escribe hasta que el usuario confirme. */
export interface FilaConteo {
  fila: number;
  sku: string;
  nombre: string;
  contado: number | null;
  estado: "CARGA" | "SIN_CONTAR" | "NUEVA" | "SOBREESCRIBE" | "ERROR";
  motivo?: string;
}

export interface PreviewConteoState {
  error?: string;
  filas?: FilaConteo[];
  payload?: string;
  /** Fecha declarada en la planilla, en formato aaaa-mm-dd, para confirmar en pantalla */
  fechaConteo?: string;
  resumen?: {
    carga: number;
    nuevas: number;
    sobreescribe: number;
    sinContar: number;
    errores: number;
  };
}

/** Conteo listo para escribir: la línea existente o el producto a agregar. */
interface ConteoAplicar {
  lineaId: string | null;
  productoId: string;
  contado: number;
}

const MAX_FILAS_CONTEO = 2000;
const FILA_CABECERA_PLANILLA = 7;

function celdaPlano(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? "").trim();
  }
  if (typeof v === "object" && "result" in (v as Record<string, unknown>)) {
    return String((v as { result: unknown }).result ?? "").trim();
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/**
 * Combina la fecha y la hora declaradas en la planilla, **en hora de Chile**.
 *
 * Va por `instanteSantiago` y no por `new Date(y, m, d, h)`: el servidor de Vercel corre en
 * UTC, así que un conteo declarado a las 09:00 quedaría grabado a las 05:00 chilenas y la
 * ventana de movimientos posteriores arrancaría cuatro horas antes de lo declarado.
 *
 * Sin hora se asume la mañana (`HORA_CONTEO_POR_DEFECTO`): en bodega se cuenta al abrir,
 * antes del movimiento del día, así que los movimientos de esa jornada se suman de vuelta.
 */
function fechaHoraConteo(fecha: string, hora: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return null;
  const [, y, mes, d] = m;
  const hm = /^(\d{1,2})[:.h]?(\d{2})?/.exec(hora.trim());
  const horas = hm ? Math.min(23, Number(hm[1])) : HORA_CONTEO_POR_DEFECTO;
  const minutos = hm && hm[2] ? Math.min(59, Number(hm[2])) : 0;
  const fin = instanteSantiago(Number(y), Number(mes), Number(d), horas, minutos);
  return Number.isNaN(fin.getTime()) ? null : fin;
}

/** Lee la planilla, valida cada fila y arma la vista previa. No escribe nada. */
export async function previsualizarConteo(
  _prev: PreviewConteoState,
  formData: FormData,
): Promise<PreviewConteoState> {
  try {
    const session = await exigirEscritura("inventario.toma");
    const tomaId = String(formData.get("tomaId") ?? "");
    const archivo = formData.get("archivo");

    if (!(archivo instanceof File) || archivo.size === 0) {
      return { error: "Selecciona la planilla .xlsx del conteo." };
    }

    const toma = await prisma.tomaInventario.findUnique({
      where: { id: tomaId },
      include: { lineas: { select: { id: true, productoId: true, contado: true } } },
    });
    if (!toma) return { error: "Toma no encontrada." };
    if (toma.estado !== "ABIERTA") {
      return { error: "Solo se puede importar conteo en una toma en curso." };
    }
    if (!validaLocal(session, toma.localId)) {
      return { error: "No puedes importar conteo de otro local." };
    }

    const workbook = new ExcelJS.Workbook();
    try {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
    } catch {
      return {
        error:
          "No pude leer el archivo. Debe ser la planilla .xlsx descargada de esta toma, sin convertirla a otro formato.",
      };
    }

    const hoja = workbook.getWorksheet("Conteo");
    if (!hoja) {
      return { error: 'El archivo no tiene la hoja "Conteo". Descarga la planilla de nuevo.' };
    }

    // El archivo tiene que ser de ESTA toma: subir la planilla de otra escribiría conteos
    // cruzados en productos que nadie contó acá.
    const idEnArchivo = celdaPlano(hoja.getCell("B6").value);
    if (idEnArchivo && idEnArchivo !== toma.id) {
      const otra = await prisma.tomaInventario.findUnique({
        where: { id: idEnArchivo },
        select: { correlativo: true },
      });
      return {
        error: otra
          ? `Esta planilla es de la toma TI-${String(otra.correlativo).padStart(6, "0")}, no de esta. Descarga la planilla correcta.`
          : "Esta planilla no corresponde a esta toma.",
      };
    }
    if (!idEnArchivo) {
      return {
        error:
          "La planilla no tiene el identificador de la toma (celda B6). Descárgala de nuevo desde esta toma.",
      };
    }

    // Las columnas se ubican por su encabezado, no por posición: la planilla de una toma no
    // ciega trae una columna extra ("Cantidad sistema") y todo lo de la derecha se corre.
    const columna: Record<string, number> = {};
    hoja.getRow(FILA_CABECERA_PLANILLA).eachCell((cell, n) => {
      columna[celdaPlano(cell.value).toLowerCase()] = n;
    });
    const colSku = columna["sku"];
    const colContado = columna["cantidad contada"];
    if (!colSku || !colContado) {
      return {
        error:
          'La planilla no tiene las columnas "SKU" y "Cantidad contada". Descárgala de nuevo desde esta toma.',
      };
    }

    const fechaDeclarada = celdaPlano(hoja.getCell("B4").value).slice(0, 10);
    const horaDeclarada = celdaPlano(hoja.getCell("B5").value);
    if (!fechaHoraConteo(fechaDeclarada, horaDeclarada)) {
      return {
        error:
          'Completa la celda "Fecha del conteo" (B4) con el día en que contaste, en formato aaaa-mm-dd.',
      };
    }

    const lineaPorProducto = new Map(toma.lineas.map((l) => [l.productoId, l]));
    const productos = await prisma.producto.findMany({
      where: { activo: true },
      select: { id: true, sku: true, nombre: true },
    });
    const productoPorSku = new Map(productos.map((p) => [p.sku.toUpperCase(), p]));

    const filas: FilaConteo[] = [];
    const aplicar: ConteoAplicar[] = [];
    const vistos = new Set<string>();
    let carga = 0;
    let nuevas = 0;
    let sobreescribe = 0;
    let sinContar = 0;
    let errores = 0;

    const ultima = hoja.rowCount;
    for (let n = FILA_CABECERA_PLANILLA + 1; n <= ultima; n++) {
      const row = hoja.getRow(n);
      const sku = celdaPlano(row.getCell(colSku).value).toUpperCase();
      const crudo = celdaPlano(row.getCell(colContado).value);

      // Fila en blanco (las 20 libres del final que no se usaron): se ignora en silencio
      if (!sku && !crudo) continue;

      const marcarError = (motivo: string) => {
        errores++;
        filas.push({ fila: n, sku, nombre: "", contado: null, estado: "ERROR", motivo });
      };

      if (!sku) {
        marcarError("Hay una cantidad sin SKU: no sé a qué producto corresponde.");
        continue;
      }
      const producto = productoPorSku.get(sku);
      if (!producto) {
        marcarError(`El SKU ${sku} no existe en el catálogo o está inactivo.`);
        continue;
      }
      if (vistos.has(producto.id)) {
        marcarError(`${sku} está repetido en la planilla. Consolida la cantidad en una fila.`);
        continue;
      }

      // Vacío ≠ 0. Vacío es "no lo conté" y la línea queda pendiente; 0 es "conté y no hay
      // ninguno", que es un faltante total. Confundirlos convertiría cada producto no
      // contado en una merma del 100%.
      if (crudo === "") {
        sinContar++;
        filas.push({
          fila: n,
          sku,
          nombre: producto.nombre,
          contado: null,
          estado: "SIN_CONTAR",
        });
        continue;
      }

      const contado = Number(crudo.replace(",", ".").replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(contado) || contado < 0 || !Number.isInteger(contado)) {
        marcarError(`"${crudo}" no es una cantidad válida: usa un entero de 0 o más.`);
        continue;
      }

      vistos.add(producto.id);
      const existente = lineaPorProducto.get(producto.id);

      if (!existente) {
        nuevas++;
        filas.push({ fila: n, sku, nombre: producto.nombre, contado, estado: "NUEVA" });
        aplicar.push({ lineaId: null, productoId: producto.id, contado });
        continue;
      }

      if (existente.contado !== null) sobreescribe++;
      else carga++;
      filas.push({
        fila: n,
        sku,
        nombre: producto.nombre,
        contado,
        estado: existente.contado !== null ? "SOBREESCRIBE" : "CARGA",
      });
      aplicar.push({ lineaId: existente.id, productoId: producto.id, contado });
    }

    if (filas.length === 0) {
      return { error: "La planilla no tiene ninguna fila con datos." };
    }
    if (filas.length > MAX_FILAS_CONTEO) {
      return { error: `Máximo ${MAX_FILAS_CONTEO} filas por planilla.` };
    }

    return {
      filas,
      payload: JSON.stringify(aplicar),
      fechaConteo: fechaDeclarada,
      resumen: { carga, nuevas, sobreescribe, sinContar, errores },
    };
  } catch {
    return { error: "No autorizado o error al leer la planilla." };
  }
}

/**
 * Escribe los conteos ya validados en la vista previa.
 *
 * `contadoEn` sale de la fecha declarada, **no** de `new Date()`. Es lo que permite que las
 * ventas ocurridas entre el conteo y la importación se sumen de vuelta al aplicar la toma,
 * en vez de aparecer como faltantes que nadie causó.
 */
export async function importarConteo(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.toma");
    const tomaId = String(formData.get("tomaId") ?? "");
    const fecha = String(formData.get("fechaConteo") ?? "");
    const hora = String(formData.get("horaConteo") ?? "");

    const contadoEn = fechaHoraConteo(fecha, hora);
    if (!contadoEn) return { error: "Indica la fecha del conteo (aaaa-mm-dd)." };
    if (contadoEn.getTime() > Date.now() + 60_000) {
      return { error: "La fecha del conteo no puede estar en el futuro." };
    }

    const toma = await prisma.tomaInventario.findUnique({
      where: { id: tomaId },
      select: { id: true, estado: true, localId: true, creadoEn: true },
    });
    if (!toma) return { error: "Toma no encontrada." };
    if (toma.estado !== "ABIERTA") {
      return { error: "Solo se puede importar conteo en una toma en curso." };
    }
    if (!validaLocal(session, toma.localId)) {
      return { error: "No puedes importar conteo de otro local." };
    }

    let conteos: ConteoAplicar[];
    try {
      conteos = JSON.parse(String(formData.get("conteos") ?? "[]"));
    } catch {
      return { error: "Datos inválidos. Vuelve a subir la planilla." };
    }
    if (!Array.isArray(conteos) || conteos.length === 0) {
      return { error: "No hay conteos para importar." };
    }
    if (conteos.length > MAX_FILAS_CONTEO) {
      return { error: `Máximo ${MAX_FILAS_CONTEO} filas por planilla.` };
    }

    let actualizadas = 0;
    let agregadas = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const c of conteos) {
          if (c.lineaId) {
            // Acotado a esta toma: un lineaId manipulado no debe tocar otra toma
            const res = await tx.tomaLinea.updateMany({
              where: { id: c.lineaId, tomaId },
              data: {
                contado: c.contado,
                contadoEn,
                contadoPorId: session.sub,
                origenConteo: "PLANILLA",
                saltada: false,
              },
            });
            actualizadas += res.count;
          } else {
            // Producto que no estaba en el alcance: aparece mercadería que el sistema no
            // tenía en esa lista, que es el hallazgo más valioso de una toma.
            const stock = await tx.stockLocal.findUnique({
              where: { productoId_localId: { productoId: c.productoId, localId: toma.localId } },
              select: { cantidad: true },
            });
            await tx.tomaLinea.upsert({
              where: { tomaId_productoId: { tomaId, productoId: c.productoId } },
              update: {
                contado: c.contado,
                contadoEn,
                contadoPorId: session.sub,
                origenConteo: "PLANILLA",
                saltada: false,
              },
              create: {
                tomaId,
                productoId: c.productoId,
                esperado: stock?.cantidad ?? 0,
                contado: c.contado,
                contadoEn,
                contadoPorId: session.sub,
                origen: "AGREGADA_IMPORT",
                origenConteo: "PLANILLA",
              },
            });
            agregadas++;
          }
        }

        // La fecha del conteo queda en la toma: la revisión la necesita para avisar si el
        // conteo ya está viejo, y para explicar de dónde salieron las diferencias.
        await tx.tomaInventario.update({ where: { id: tomaId }, data: { fechaConteo: contadoEn } });
      },
      { timeout: 120_000 },
    );

    revalidatePath("/dashboard/inventario/tomas");
    revalidatePath(`/dashboard/inventario/tomas/${tomaId}`);
    return {
      ok: `${actualizadas} conteo${actualizadas === 1 ? "" : "s"} cargado${actualizadas === 1 ? "" : "s"}${
        agregadas > 0
          ? ` · ${agregadas} línea${agregadas === 1 ? "" : "s"} nueva${agregadas === 1 ? "" : "s"} agregada${agregadas === 1 ? "" : "s"}`
          : ""
      }. Cierra el conteo cuando termines para que lo revisen.`,
    };
  } catch (e) {
    console.error("[importarConteo] fallo inesperado:", e);
    return {
      error:
        "No se pudo importar el conteo por un error del servidor. Revisa el log del proceso.",
    };
  }
}

/** Guarda el motivo de una diferencia, desde la pantalla de revisión. */
export async function guardarMotivo(formData: FormData) {
  const session = await exigirEscritura("inventario.toma-aprobar");
  const lineaId = String(formData.get("lineaId") ?? "");
  const motivo = String(formData.get("motivo") ?? "");

  const linea = await prisma.tomaLinea.findUnique({
    where: { id: lineaId },
    include: { toma: { select: { estado: true, localId: true } } },
  });
  if (!linea || linea.toma.estado !== "CONTADA") return;
  if (!validaLocal(session, linea.toma.localId)) return;

  await prisma.tomaLinea.update({
    where: { id: lineaId },
    data: { motivo: MOTIVOS_VALIDOS.includes(motivo) ? (motivo as MotivoAjuste) : null },
  });
  revalidatePath("/dashboard/inventario/tomas");
}

/**
 * Aplica la toma: lleva el stock a lo contado y deja el ajuste registrado.
 *
 * El objetivo no es `contado` a secas, sino `contado + movimientos posteriores al conteo`.
 * Entre que el bodeguero contó y que el encargado aplica pueden haber pasado ventas; sin
 * esa corrección aparecerían como faltantes que nadie causó.
 *
 * Lo hace quien tiene `inventario.toma-aprobar`, que no es quien contó: un ajuste cambia la
 * valorización y borra el rastro de lo que faltaba.
 */
export async function aplicarToma(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.toma-aprobar");
    const tomaId = String(formData.get("tomaId") ?? "");

    const toma = await prisma.tomaInventario.findUnique({
      where: { id: tomaId },
      include: { lineas: true },
    });
    if (!toma) return { error: "Toma no encontrada." };
    if (toma.estado !== "CONTADA") return { error: "La toma no está lista para aplicarse." };
    if (!validaLocal(session, toma.localId)) return { error: "No puedes aplicar en otro local." };

    const contadas = toma.lineas.filter((l) => l.contado !== null && l.contadoEn !== null);
    if (contadas.length === 0) return { error: "No hay líneas contadas." };

    let ajustadas = 0;

    await prisma.$transaction(async (tx) => {
      // Toma el estado primero: dos clics simultáneos pasarían los dos el chequeo
      // de arriba, que se hizo fuera de la transacción.
      const tomado = await tx.tomaInventario.updateMany({
        where: { id: tomaId, estado: "CONTADA" },
        data: { estado: "APLICADA", aplicadaPorId: session.sub, aplicadaEn: new Date() },
      });
      if (tomado.count !== 1) throw new Error("YA_APLICADA");

      for (const l of contadas) {
        const [posteriores, stock] = await Promise.all([
          tx.movimientoInventario.aggregate({
            where: {
              productoId: l.productoId,
              localId: toma.localId,
              creadoEn: { gt: l.contadoEn! },
            },
            _sum: { cantidad: true },
          }),
          tx.stockLocal.findUnique({
            where: { productoId_localId: { productoId: l.productoId, localId: toma.localId } },
            select: { cantidad: true },
          }),
        ]);

        // Nunca por debajo de cero: el resto del sistema lo impide y un negativo acá
        // dejaría el inventario en un estado que ninguna otra pantalla sabe mostrar.
        const objetivo = Math.max(0, objetivoDeStock(l.contado!, posteriores._sum.cantidad ?? 0));
        const actual = stock?.cantidad ?? 0;
        const delta = objetivo - actual;
        if (delta === 0) continue;

        // Relativo, no absoluto: una venta que confirme entre la lectura y esta escritura
        // quedaría borrada si pisáramos el valor con un total calculado antes.
        await tx.stockLocal.upsert({
          where: { productoId_localId: { productoId: l.productoId, localId: toma.localId } },
          update: { cantidad: { increment: delta } },
          create: { productoId: l.productoId, localId: toma.localId, cantidad: objetivo },
        });
        await tx.movimientoInventario.create({
          data: {
            tipo: "AJUSTE",
            productoId: l.productoId,
            localId: toma.localId,
            cantidad: delta,
            usuarioId: session.sub,
            tomaLineaId: l.id,
            nota: `Toma TI-${String(toma.correlativo).padStart(6, "0")}${l.motivo ? ` · ${l.motivo.toLowerCase().replace(/_/g, " ")}` : ""}`,
          },
        });
        ajustadas++;
      }
      // Una toma total son cientos de líneas: el default de 5 s no alcanza
    }, { timeout: 120_000 });

    revalidatePath("/dashboard/inventario/tomas");
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    return {
      ok:
        ajustadas === 0
          ? "Toma aplicada: el stock ya estaba correcto, sin ajustes."
          : `Toma aplicada: ${ajustadas} ${ajustadas === 1 ? "producto ajustado" : "productos ajustados"}.`,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "YA_APLICADA") {
      return { error: "Esta toma ya fue aplicada." };
    }
    return { error: "No autorizado o error al aplicar la toma." };
  }
}
