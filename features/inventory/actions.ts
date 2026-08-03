"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

// El permiso lo define el perfil sobre cada sección (Configuración › Perfiles).
// Ocultar el botón no basta: la acción se puede llamar igual desde la consola.

/** Valida que el usuario pueda operar sobre ese local. */
function validaLocal(session: { rol: string; localId: string | null }, localId: string) {
  if (esRolGlobal(session.rol)) return true;
  return session.localId === localId;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Crea un producto nuevo. El catálogo es compartido por todos los locales y la tienda online. */
export async function crearProducto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.productos");

    const nombre = String(formData.get("nombre") ?? "").trim();
    const marca = String(formData.get("marca") ?? "").trim();
    const categoriaId = String(formData.get("categoriaId") ?? "");
    const skuRaw = String(formData.get("sku") ?? "").trim().toUpperCase();
    const codigoBarra = String(formData.get("codigoBarra") ?? "").trim() || null;
    const precioVenta = Math.trunc(Number(formData.get("precioVenta") ?? 0));
    const precioCosto = Math.trunc(Number(formData.get("precioCosto") ?? 0));
    const imagen = String(formData.get("imagen") ?? "").trim() || null;

    if (!nombre || !marca || !categoriaId || precioVenta <= 0) {
      return { error: "Completa nombre, marca, categoría y precio de venta." };
    }
    if (precioCosto < 0) return { error: "El precio costo no puede ser negativo." };
    if (imagen && !imagen.startsWith("http") && !imagen.startsWith("/")) {
      return { error: "La imagen debe ser una URL (https://…) o ruta local (/productos/…)." };
    }

    // SKU: usa el ingresado o genera uno a partir de marca + correlativo
    let sku = skuRaw;
    if (!sku) {
      const prefijo = marca.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PRD";
      const count = await prisma.producto.count({ where: { sku: { startsWith: prefijo } } });
      sku = `${prefijo}-${String(count + 1).padStart(3, "0")}`;
    }
    const skuExiste = await prisma.producto.findUnique({ where: { sku } });
    if (skuExiste) return { error: `El SKU ${sku} ya existe (${skuExiste.nombre}).` };

    if (codigoBarra) {
      const cbExiste = await prisma.producto.findUnique({ where: { codigoBarra } });
      if (cbExiste) return { error: `El código de barra ya está asignado a ${cbExiste.nombre}.` };
    }

    // Slug único
    let slug = slugify(nombre);
    if (await prisma.producto.findUnique({ where: { slug } })) {
      slug = `${slug}-${sku.toLowerCase()}`;
    }

    const producto = await prisma.producto.create({
      data: { nombre, marca, categoriaId, sku, codigoBarra, slug, precioVenta, precioCosto, imagen },
    });

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    revalidatePath("/dashboard/pos"); // el POS cachea la grilla de precios
    return { ok: `Producto creado: ${producto.nombre} (SKU ${producto.sku}). Ingresa su stock con un movimiento de Entrada.` };
  } catch {
    return { error: "Error al crear el producto." };
  }
}

/** Edita la ficha maestra. Afecta a todos los locales y a la tienda online. */
export async function editarProducto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.productos");

    const productoId = String(formData.get("productoId") ?? "");
    const nombre = String(formData.get("nombre") ?? "").trim();
    const marca = String(formData.get("marca") ?? "").trim();
    const categoriaId = String(formData.get("categoriaId") ?? "");
    const codigoBarra = String(formData.get("codigoBarra") ?? "").trim() || null;
    const precioVenta = Math.trunc(Number(formData.get("precioVenta") ?? 0));
    const precioCosto = Math.trunc(Number(formData.get("precioCosto") ?? 0));
    const imagen = String(formData.get("imagen") ?? "").trim() || null;
    const activo = formData.get("activo") === "on";

    if (!productoId) return { error: "Producto no indicado." };
    if (!nombre || !marca || !categoriaId || precioVenta <= 0) {
      return { error: "Completa nombre, marca, categoría y precio de venta." };
    }
    if (precioCosto < 0) return { error: "El precio costo no puede ser negativo." };
    if (imagen && !imagen.startsWith("http") && !imagen.startsWith("/")) {
      return { error: "La imagen debe ser una URL (https://…) o ruta local (/productos/…)." };
    }

    if (codigoBarra) {
      const cbExiste = await prisma.producto.findUnique({ where: { codigoBarra } });
      if (cbExiste && cbExiste.id !== productoId) {
        return { error: `El código de barra ya está asignado a ${cbExiste.nombre}.` };
      }
    }

    await prisma.producto.update({
      where: { id: productoId },
      data: { nombre, marca, categoriaId, codigoBarra, precioVenta, precioCosto, imagen, activo },
    });

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    revalidatePath("/dashboard/pos"); // el POS cachea la grilla de precios
    revalidatePath("/");
    return { ok: `Producto actualizado${activo ? "" : " y desactivado (oculto en POS y tienda)"}.` };
  } catch {
    return { error: "Error al editar el producto." };
  }
}

export async function actualizarParametros(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.productos");
    const productoId = String(formData.get("productoId") ?? "");
    const localId = String(formData.get("localId") ?? "");
    const stockMin = Number(formData.get("stockMin") ?? 0);
    const stockMaxRaw = String(formData.get("stockMax") ?? "");
    const ubicacion = String(formData.get("ubicacion") ?? "").trim() || null;

    if (!productoId || !localId) return { error: "Datos incompletos." };
    if (!validaLocal(session, localId)) return { error: "No puedes editar otro local." };
    if (stockMin < 0) return { error: "El stock mínimo no puede ser negativo." };
    const stockMax = stockMaxRaw === "" ? null : Number(stockMaxRaw);
    if (stockMax !== null && stockMax < stockMin) {
      return { error: "El stock máximo debe ser mayor o igual al mínimo." };
    }

    await prisma.stockLocal.upsert({
      where: { productoId_localId: { productoId, localId } },
      update: { stockMin, stockMax, ubicacion },
      create: { productoId, localId, cantidad: 0, stockMin, stockMax, ubicacion },
    });

    revalidatePath("/dashboard/inventario");
    return { ok: "Parámetros guardados." };
  } catch {
    return { error: "Error al guardar." };
  }
}

// ──────────────── Documento de movimiento (multi-línea, estilo OC) ────────────────

/** Una línea del documento: un artículo con su cantidad y costo unitario. */
export interface LineaMovimiento {
  productoId: string;
  cantidad: number;
  costoUnitario: number;
}

const MAX_LINEAS_MOVIMIENTO = 100;

const TIPOS_MOVIMIENTO = [
  "ENTRADA",
  "AJUSTE_POSITIVO",
  "AJUSTE_NEGATIVO",
  "MERMA",
  "TRANSFERENCIA",
] as const;
type TipoDocumento = (typeof TIPOS_MOVIMIENTO)[number];

const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  ENTRADA: "Entrada",
  AJUSTE_POSITIVO: "Ajuste +",
  AJUSTE_NEGATIVO: "Ajuste −",
  MERMA: "Merma",
  TRANSFERENCIA: "Transferencia",
};

/** true si el tipo suma stock en el local de origen. */
const suma = (tipo: TipoDocumento) => tipo === "ENTRADA" || tipo === "AJUSTE_POSITIVO";

function parseLineas(raw: string): LineaMovimiento[] | null {
  let datos: unknown;
  try {
    datos = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(datos)) return null;
  const lineas: LineaMovimiento[] = [];
  for (const item of datos) {
    if (typeof item !== "object" || item === null) return null;
    const l = item as Record<string, unknown>;
    const productoId = String(l.productoId ?? "");
    const cantidad = Math.trunc(Number(l.cantidad ?? 0));
    const costoUnitario = Math.max(0, Math.trunc(Number(l.costoUnitario ?? 0)));
    if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) return null;
    lineas.push({ productoId, cantidad, costoUnitario });
  }
  return lineas;
}

/**
 * Registra un documento de movimiento con N líneas en una sola transacción:
 * entradas, ajustes +/−, mermas y transferencias entre locales.
 * Todas las líneas comparten tipo, local y nota — igual que una Orden de Compra.
 */
export async function registrarDocumentoMovimiento(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.registrar");

    const tipo = String(formData.get("tipo") ?? "") as TipoDocumento;
    const localId = String(formData.get("localId") ?? "");
    const localDestinoId = String(formData.get("localDestinoId") ?? "");
    const nota = String(formData.get("nota") ?? "").trim() || null;

    if (!TIPOS_MOVIMIENTO.includes(tipo)) return { error: "Tipo de movimiento inválido." };
    if (!localId) return { error: "Selecciona el local." };
    if (!validaLocal(session, localId)) return { error: "No puedes operar otro local." };

    const lineas = parseLineas(String(formData.get("lineas") ?? "[]"));
    if (!lineas) return { error: "Hay líneas con datos inválidos. Revisa las cantidades." };
    if (lineas.length === 0) return { error: "Agrega al menos un artículo al documento." };
    if (lineas.length > MAX_LINEAS_MOVIMIENTO) {
      return { error: `Máximo ${MAX_LINEAS_MOVIMIENTO} líneas por documento.` };
    }
    if (new Set(lineas.map((l) => l.productoId)).size !== lineas.length) {
      return { error: "Hay un artículo repetido en el documento. Consolida sus cantidades." };
    }

    if (tipo === "TRANSFERENCIA") {
      if (!localDestinoId) return { error: "Selecciona el local de destino." };
      if (localDestinoId === localId) {
        return { error: "El local de destino debe ser distinto al de origen." };
      }
      const destino = await prisma.local.findFirst({
        where: { id: localDestinoId, activo: true },
        select: { id: true },
      });
      if (!destino) return { error: "El local de destino no existe o está inactivo." };
    }

    // Los productos deben existir y estar activos
    const productos = await prisma.producto.findMany({
      where: { id: { in: lineas.map((l) => l.productoId) }, activo: true },
      select: { id: true, nombre: true, sku: true, precioCosto: true },
    });
    if (productos.length !== lineas.length) {
      return { error: "Alguno de los artículos ya no está disponible. Recarga la página." };
    }
    const porId = new Map(productos.map((p) => [p.id, p]));

    // Pre-validación de stock: mejor un error completo que una transacción a medias
    if (!suma(tipo)) {
      const stocks = await prisma.stockLocal.findMany({
        where: { localId, productoId: { in: lineas.map((l) => l.productoId) } },
        select: { productoId: true, cantidad: true },
      });
      const disponible = new Map(stocks.map((s) => [s.productoId, s.cantidad]));
      const faltantes = lineas
        .filter((l) => (disponible.get(l.productoId) ?? 0) < l.cantidad)
        .map(
          (l) =>
            `${porId.get(l.productoId)!.sku} (pide ${l.cantidad}, hay ${disponible.get(l.productoId) ?? 0})`,
        );
      if (faltantes.length > 0) {
        return { error: `Stock insuficiente en ${faltantes.length} línea${faltantes.length === 1 ? "" : "s"}: ${faltantes.join(" · ")}.` };
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const l of lineas) {
        if (tipo === "ENTRADA" || tipo === "AJUSTE_POSITIVO") {
          await tx.stockLocal.upsert({
            where: { productoId_localId: { productoId: l.productoId, localId } },
            update: { cantidad: { increment: l.cantidad } },
            create: { productoId: l.productoId, localId, cantidad: l.cantidad },
          });
          await tx.movimientoInventario.create({
            data: {
              tipo: tipo === "ENTRADA" ? "ENTRADA" : "AJUSTE",
              productoId: l.productoId,
              localId,
              cantidad: l.cantidad,
              usuarioId: session.sub,
              nota,
            },
          });
          // Solo una entrada con costo recalcula el CPP (mismo criterio que la recepción de OC).
          // Un ajuste de conteo no aporta costo nuevo, así que no lo toca.
          if (tipo === "ENTRADA" && l.costoUnitario > 0) {
            const agg = await tx.stockLocal.aggregate({
              where: { productoId: l.productoId },
              _sum: { cantidad: true },
            });
            // El stock ya incluye esta entrada: descontarla para obtener el saldo previo
            const stockPrevio = Math.max((agg._sum.cantidad ?? 0) - l.cantidad, 0);
            const costoActual = porId.get(l.productoId)!.precioCosto;
            const nuevoCosto =
              stockPrevio <= 0 || costoActual <= 0
                ? l.costoUnitario
                : Math.round(
                    (stockPrevio * costoActual + l.cantidad * l.costoUnitario) /
                      (stockPrevio + l.cantidad),
                  );
            await tx.producto.update({
              where: { id: l.productoId },
              data: { precioCosto: nuevoCosto },
            });
          }
        } else if (tipo === "AJUSTE_NEGATIVO" || tipo === "MERMA") {
          const actual = await tx.stockLocal.findUnique({
            where: { productoId_localId: { productoId: l.productoId, localId } },
            select: { cantidad: true },
          });
          if (!actual || actual.cantidad < l.cantidad) {
            throw new Error(
              `Stock insuficiente de ${porId.get(l.productoId)!.sku} (disponible: ${actual?.cantidad ?? 0}).`,
            );
          }
          await tx.stockLocal.update({
            where: { productoId_localId: { productoId: l.productoId, localId } },
            data: { cantidad: { decrement: l.cantidad } },
          });
          await tx.movimientoInventario.create({
            data: {
              tipo: tipo === "MERMA" ? "MERMA" : "AJUSTE",
              productoId: l.productoId,
              localId,
              cantidad: -l.cantidad,
              usuarioId: session.sub,
              nota,
            },
          });
        } else {
          const actual = await tx.stockLocal.findUnique({
            where: { productoId_localId: { productoId: l.productoId, localId } },
            select: { cantidad: true },
          });
          if (!actual || actual.cantidad < l.cantidad) {
            throw new Error(
              `Stock insuficiente de ${porId.get(l.productoId)!.sku} para transferir (disponible: ${actual?.cantidad ?? 0}).`,
            );
          }
          await tx.stockLocal.update({
            where: { productoId_localId: { productoId: l.productoId, localId } },
            data: { cantidad: { decrement: l.cantidad } },
          });
          await tx.stockLocal.upsert({
            where: {
              productoId_localId: { productoId: l.productoId, localId: localDestinoId },
            },
            update: { cantidad: { increment: l.cantidad } },
            create: { productoId: l.productoId, localId: localDestinoId, cantidad: l.cantidad },
          });
          const salida = await tx.movimientoInventario.create({
            data: {
              tipo: "TRANSFERENCIA_SALIDA",
              productoId: l.productoId,
              localId,
              cantidad: -l.cantidad,
              usuarioId: session.sub,
              nota,
            },
          });
          await tx.movimientoInventario.create({
            data: {
              tipo: "TRANSFERENCIA_ENTRADA",
              productoId: l.productoId,
              localId: localDestinoId,
              cantidad: l.cantidad,
              usuarioId: session.sub,
              transferenciaPar: salida.id,
              nota,
            },
          });
        }
      }
    });

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    revalidatePath("/dashboard/inventario/registrar");
    if (tipo === "ENTRADA") revalidatePath("/dashboard/precios");
    revalidatePath("/"); // la landing muestra disponibilidad por local

    const unidades = lineas.reduce((t, l) => t + l.cantidad, 0);
    return {
      ok: `${ETIQUETA_TIPO[tipo]} registrada: ${lineas.length} línea${lineas.length === 1 ? "" : "s"} · ${unidades} unidad${unidades === 1 ? "" : "es"}${
        tipo === "ENTRADA" ? " · costo promedio actualizado" : ""
      }.`,
    };
  } catch (e) {
    // Los errores de stock lanzados dentro de la transacción sí son informativos
    const msg = e instanceof Error && e.message.startsWith("Stock insuficiente") ? e.message : null;
    return { error: msg ?? "Error al registrar el documento de movimiento." };
  }
}

// ─────────────────────── Carga masiva de productos (.xlsx) ───────────────────────

const MAX_FILAS_IMPORT = 500;

export interface FilaPreview {
  fila: number;
  sku: string;
  nombre: string;
  marca: string;
  categoria: string;
  precioVenta: number;
  estado: "NUEVO" | "ACTUALIZA" | "SIN_CAMBIO" | "ERROR";
  motivo?: string;
}

export interface PreviewState {
  error?: string;
  filas?: FilaPreview[];
  payload?: string;
  resumen?: { nuevos: number; actualiza: number; sinCambio: number; errores: number };
}

/** Fila ya validada y normalizada, lista para crear o actualizar en la BD. */
interface FilaAplicar {
  sku: string;
  slug: string;
  nombre: string;
  marca: string;
  categoriaId: string;
  codigoBarra: string | null;
  precioVenta: number;
  precioCosto: number;
  precioAnterior: number | null;
  imagen: string | null;
  destacado: boolean;
  esNuevo: boolean;
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
  return String(v).trim();
}

function celdaNumero(v: unknown): number | null {
  const texto = celdaTexto(v);
  if (!texto) return null;
  const n = Number(texto.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const COL = {
  sku: "SKU",
  codigoBarra: "Código de barra",
  nombre: "Nombre",
  marca: "Marca",
  categoria: "Categoría",
  precioCosto: "Precio costo",
  precioVenta: "Precio venta",
  precioAnterior: "Precio anterior (oferta)",
  imagen: "Imagen (URL)",
  destacado: "Destacado (Sí/No)",
} as const;

/** Lee el .xlsx subido, valida cada fila y arma la vista previa (nada se guarda todavía). */
export async function previsualizarImportacionProductos(
  _prev: PreviewState,
  formData: FormData,
): Promise<PreviewState> {
  try {
    await exigirEscritura("inventario.productos");

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

    const hoja = workbook.getWorksheet("Productos") ?? workbook.worksheets[0];
    if (!hoja) return { error: "El archivo no tiene una hoja de productos." };

    const indice: Record<string, number> = {};
    hoja.getRow(1).eachCell((cell, colNumber) => {
      indice[celdaTexto(cell.value)] = colNumber;
    });
    const col = (nombre: string) => indice[nombre];
    if (!col(COL.nombre) || !col(COL.marca) || !col(COL.categoria) || !col(COL.precioVenta)) {
      return { error: "El archivo no tiene las columnas esperadas. Descarga la plantilla nuevamente." };
    }

    const [categorias, productosExistentes] = await Promise.all([
      prisma.categoria.findMany(),
      prisma.producto.findMany({
        select: {
          id: true,
          sku: true,
          slug: true,
          nombre: true,
          marca: true,
          categoriaId: true,
          codigoBarra: true,
          precioCosto: true,
          precioVenta: true,
          precioAnterior: true,
          imagen: true,
          destacado: true,
        },
      }),
    ]);
    const catPorNombre = new Map(categorias.map((c) => [c.nombre.toLowerCase(), c]));
    const porSku = new Map(productosExistentes.map((p) => [p.sku.toUpperCase(), p]));
    const dueñoDeCodigo = new Map(
      productosExistentes.filter((p) => p.codigoBarra).map((p) => [p.codigoBarra as string, p]),
    );
    const slugsUsados = new Set(productosExistentes.map((p) => p.slug));
    const skusUsadosEnArchivo = new Set<string>();
    const codigosUsadosEnArchivo = new Set<string>();
    const contadorPorPrefijo = new Map<string, number>();

    const filas: FilaPreview[] = [];
    const aplicar: FilaAplicar[] = [];
    let nuevos = 0;
    let actualiza = 0;
    let sinCambio = 0;
    let errores = 0;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const nombre = celdaTexto(row.getCell(col(COL.nombre)).value);
      const marca = celdaTexto(row.getCell(col(COL.marca)).value);
      const categoriaNombre = celdaTexto(row.getCell(col(COL.categoria)).value);
      const precioVenta = celdaNumero(row.getCell(col(COL.precioVenta)).value);
      const skuRaw = col(COL.sku) ? celdaTexto(row.getCell(col(COL.sku)).value).toUpperCase() : "";
      const precioCostoRaw = col(COL.precioCosto) ? celdaNumero(row.getCell(col(COL.precioCosto)).value) : 0;
      const precioAnteriorRaw = col(COL.precioAnterior)
        ? celdaNumero(row.getCell(col(COL.precioAnterior)).value)
        : null;
      const codigoBarraRaw = col(COL.codigoBarra) ? celdaTexto(row.getCell(col(COL.codigoBarra)).value) : "";
      const imagenRaw = col(COL.imagen) ? celdaTexto(row.getCell(col(COL.imagen)).value) : "";
      const destacadoRaw = col(COL.destacado)
        ? celdaTexto(row.getCell(col(COL.destacado)).value).toLowerCase()
        : "";

      // Fila en blanco (sobrante del rango con desplegables): se ignora en silencio.
      if (!nombre && !marca && !categoriaNombre && precioVenta === null && !skuRaw) return;

      const marcarError = (motivo: string) => {
        errores++;
        filas.push({
          fila: rowNumber,
          sku: skuRaw,
          nombre,
          marca,
          categoria: categoriaNombre,
          precioVenta: precioVenta ?? 0,
          estado: "ERROR",
          motivo,
        });
      };

      if (!nombre || !marca || !categoriaNombre || precioVenta === null || precioVenta <= 0) {
        marcarError("Faltan datos obligatorios (Nombre, Marca, Categoría, Precio venta > 0).");
        return;
      }
      const categoria = catPorNombre.get(categoriaNombre.toLowerCase());
      if (!categoria) {
        marcarError(`La categoría "${categoriaNombre}" no existe. Usa el desplegable de la plantilla.`);
        return;
      }
      if (precioAnteriorRaw !== null && precioAnteriorRaw <= precioVenta) {
        marcarError("El precio anterior (oferta) debe ser mayor al precio de venta.");
        return;
      }
      const imagen = imagenRaw || null;
      if (imagen && !imagen.startsWith("http") && !imagen.startsWith("/")) {
        marcarError("La imagen debe ser una URL (https://…) o ruta local (/productos/…).");
        return;
      }
      const codigoBarra = codigoBarraRaw || null;
      if (codigoBarra && codigosUsadosEnArchivo.has(codigoBarra)) {
        marcarError(`El código de barra ${codigoBarra} está repetido en el archivo.`);
        return;
      }
      if (skuRaw && skusUsadosEnArchivo.has(skuRaw)) {
        marcarError(`El SKU ${skuRaw} está repetido en el archivo.`);
        return;
      }
      if (codigoBarra) {
        const dueño = dueñoDeCodigo.get(codigoBarra);
        if (dueño && dueño.sku.toUpperCase() !== skuRaw) {
          marcarError(`El código de barra ${codigoBarra} ya está asignado a ${dueño.nombre}.`);
          return;
        }
      }

      let sku = skuRaw;
      if (!sku) {
        const prefijo = marca.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PRD";
        const base =
          contadorPorPrefijo.get(prefijo) ??
          productosExistentes.filter((p) => p.sku.startsWith(prefijo)).length;
        let n = base + 1;
        let candidato = `${prefijo}-${String(n).padStart(3, "0")}`;
        while (porSku.has(candidato) || skusUsadosEnArchivo.has(candidato)) {
          n++;
          candidato = `${prefijo}-${String(n).padStart(3, "0")}`;
        }
        sku = candidato;
        contadorPorPrefijo.set(prefijo, n);
      }
      skusUsadosEnArchivo.add(sku);
      if (codigoBarra) codigosUsadosEnArchivo.add(codigoBarra);

      const precioCosto = precioCostoRaw ?? 0;
      const existente = porSku.get(sku);
      const esNuevo = !existente;

      let slug = existente?.slug ?? slugify(nombre);
      if (esNuevo && slugsUsados.has(slug)) slug = `${slug}-${sku.toLowerCase()}`;
      slugsUsados.add(slug);

      if (!esNuevo) {
        const sinCambios =
          existente!.nombre === nombre &&
          existente!.marca === marca &&
          existente!.categoriaId === categoria.id &&
          (existente!.codigoBarra ?? null) === codigoBarra &&
          existente!.precioCosto === precioCosto &&
          existente!.precioVenta === precioVenta &&
          (existente!.precioAnterior ?? null) === precioAnteriorRaw &&
          (existente!.imagen ?? null) === imagen &&
          existente!.destacado === destacado(destacadoRaw);
        if (sinCambios) {
          sinCambio++;
          filas.push({
            fila: rowNumber,
            sku,
            nombre,
            marca,
            categoria: categoriaNombre,
            precioVenta,
            estado: "SIN_CAMBIO",
          });
          return;
        }
      }

      if (esNuevo) nuevos++;
      else actualiza++;
      filas.push({
        fila: rowNumber,
        sku,
        nombre,
        marca,
        categoria: categoriaNombre,
        precioVenta,
        estado: esNuevo ? "NUEVO" : "ACTUALIZA",
      });
      aplicar.push({
        sku,
        slug,
        nombre,
        marca,
        categoriaId: categoria.id,
        codigoBarra,
        precioVenta,
        precioCosto,
        precioAnterior: precioAnteriorRaw,
        imagen,
        destacado: destacado(destacadoRaw),
        esNuevo,
      });
    });

    if (filas.length === 0) return { error: "El archivo no tiene filas con datos." };
    if (filas.length > MAX_FILAS_IMPORT) {
      return { error: `Máximo ${MAX_FILAS_IMPORT} filas por importación.` };
    }

    return { filas, payload: JSON.stringify(aplicar), resumen: { nuevos, actualiza, sinCambio, errores } };
  } catch {
    return { error: "Error al leer el archivo." };
  }
}

function destacado(valor: string): boolean {
  return valor === "sí" || valor === "si" || valor === "s" || valor === "true" || valor === "x";
}

/** Aplica en la BD las filas ya validadas en la vista previa (crea o actualiza por SKU). */
export async function aplicarImportacionProductos(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.productos");

    let filas: FilaAplicar[];
    try {
      filas = JSON.parse(String(formData.get("filas") ?? "[]"));
    } catch {
      return { error: "Datos inválidos." };
    }
    if (!Array.isArray(filas) || filas.length === 0) {
      return { error: "No hay filas para aplicar." };
    }
    if (filas.length > MAX_FILAS_IMPORT) {
      return { error: `Máximo ${MAX_FILAS_IMPORT} filas por importación.` };
    }

    let creados = 0;
    let actualizados = 0;
    let fallidos = 0;

    for (let i = 0; i < filas.length; i += 10) {
      const lote = filas.slice(i, i + 10);
      const resultados = await Promise.allSettled(
        lote.map((f) =>
          f.esNuevo
            ? prisma.producto.create({
                data: {
                  sku: f.sku,
                  slug: f.slug,
                  nombre: f.nombre,
                  marca: f.marca,
                  categoriaId: f.categoriaId,
                  codigoBarra: f.codigoBarra,
                  precioVenta: f.precioVenta,
                  precioCosto: f.precioCosto,
                  precioAnterior: f.precioAnterior,
                  imagen: f.imagen,
                  destacado: f.destacado,
                },
              })
            : prisma.producto.update({
                where: { sku: f.sku },
                data: {
                  nombre: f.nombre,
                  marca: f.marca,
                  categoriaId: f.categoriaId,
                  codigoBarra: f.codigoBarra,
                  precioVenta: f.precioVenta,
                  precioCosto: f.precioCosto,
                  precioAnterior: f.precioAnterior,
                  imagen: f.imagen,
                  destacado: f.destacado,
                },
              }),
        ),
      );
      resultados.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          if (lote[idx].esNuevo) creados++;
          else actualizados++;
        } else {
          fallidos++;
        }
      });
    }

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    revalidatePath("/dashboard/pos");
    revalidatePath("/");

    return {
      ok: `${creados} producto${creados === 1 ? "" : "s"} creado${creados === 1 ? "" : "s"} · ${actualizados} actualizado${
        actualizados === 1 ? "" : "s"
      }${fallidos > 0 ? ` · ${fallidos} con error` : ""}.`,
    };
  } catch {
    return { error: "Error al aplicar la importación." };
  }
}
