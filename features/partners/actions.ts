"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { exigirEscritura } from "@/lib/auth/guards";
import { normalizarRut } from "@/lib/rut";
import { COLUMNAS_SOCIOS, condicionPagoDesdeTexto, rutDesdeExcel } from "./importacion";

export interface ActionState {
  error?: string;
  ok?: string;
}

const TIPOS = ["CLIENTE", "PROVEEDOR"] as const;
type Tipo = (typeof TIPOS)[number];

async function requireAdmin() {
  return exigirEscritura("socios.socios");
}

export async function guardarSocio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const id = String(formData.get("id") ?? "") || null;
    const tipo = String(formData.get("tipo") ?? "") as Tipo;
    const rutRaw = String(formData.get("rut") ?? "").trim();
    const razonSocial = String(formData.get("razonSocial") ?? "").trim();
    const nombreFantasia = String(formData.get("nombreFantasia") ?? "").trim() || null;
    const giro = String(formData.get("giro") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
    const telefono = String(formData.get("telefono") ?? "").trim() || null;
    const direccion = String(formData.get("direccion") ?? "").trim() || null;
    const comuna = String(formData.get("comuna") ?? "").trim() || null;
    const condicionPago = String(formData.get("condicionPago") ?? "").trim() || null;
    // Descuento pactado (%). Solo tiene efecto en fichas CLIENTE: en un proveedor se
    // guarda 0 aunque el formulario mande algo, para que nunca aparezca de rebote.
    const descuentoRaw = Math.trunc(Number(formData.get("descuentoPorcentaje") ?? 0));
    const descuentoPorcentaje = tipo === "CLIENTE" && Number.isFinite(descuentoRaw) ? descuentoRaw : 0;
    // Igual que el descuento: en un proveedor no significa nada y se guarda apagado.
    const cuentaAbierta = tipo === "CLIENTE" && formData.get("cuentaAbierta") === "on";

    if (!TIPOS.includes(tipo) || !rutRaw || !razonSocial) {
      return { error: "Completa tipo, RUT y razón social." };
    }
    if (descuentoPorcentaje < 0 || descuentoPorcentaje > 100) {
      return { error: "El descuento del cliente debe estar entre 0 y 100%." };
    }
    const rut = normalizarRut(rutRaw);
    if (!rut) return { error: "RUT inválido. Formato: 12345678-9." };

    // Único por RUT + tipo (una empresa puede existir como cliente Y como proveedor)
    const existente = await prisma.socioNegocio.findFirst({ where: { rut, tipo } });
    if (existente && existente.id !== id) {
      return {
        error: `El RUT ya está registrado como ${tipo.toLowerCase()} (${existente.razonSocial}).`,
      };
    }

    const data = { tipo, rut, razonSocial, nombreFantasia, giro, email, telefono, direccion, comuna, condicionPago, descuentoPorcentaje, cuentaAbierta };
    if (id) {
      await prisma.socioNegocio.update({ where: { id }, data });
    } else {
      await prisma.socioNegocio.create({ data });
    }

    revalidatePath("/dashboard/socios");
  revalidateTag("socios", "max"); // cache compartido de lookups (lib/cache.ts)
    revalidatePath("/dashboard/solicitudes");
    return { ok: id ? "Socio actualizado." : `Socio ${razonSocial} creado.` };
  } catch {
    return { error: "No autorizado o error al guardar." };
  }
}

export async function toggleSocioActivo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const socio = await prisma.socioNegocio.findUnique({ where: { id } });
  if (!socio) return;
  await prisma.socioNegocio.update({ where: { id }, data: { activo: !socio.activo } });
  revalidatePath("/dashboard/socios");
  revalidateTag("socios", "max"); // cache compartido de lookups (lib/cache.ts)
}

// ─────────────────────────── Importación masiva desde Excel ───────────────────────────
//
// Mismo patrón que "Importar productos": la vista previa valida todo sin guardar nada y
// devuelve las filas listas en `payload`; "aplicar" las recibe de vuelta y recién ahí
// escribe. La clave es RUT + tipo, igual que la ficha: un RUT existente actualiza.

const MAX_FILAS_IMPORT = 500;

export interface FilaSocioPreview {
  fila: number;
  rut: string;
  razonSocial: string;
  estado: "NUEVO" | "ACTUALIZA" | "SIN_CAMBIO" | "ERROR";
  motivo?: string;
}

export interface PreviewSociosState {
  error?: string;
  filas?: FilaSocioPreview[];
  payload?: string;
  resumen?: { nuevos: number; actualiza: number; sinCambio: number; errores: number };
}

interface FilaSocioAplicar {
  tipo: Tipo;
  rut: string;
  razonSocial: string;
  nombreFantasia: string | null;
  giro: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
  condicionPago: string | null;
  descuentoPorcentaje: number;
  cuentaAbierta: boolean;
  esNuevo: boolean;
}

function celdaTexto(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "text" in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text ?? "").trim();
  }
  if (typeof v === "object" && "richText" in (v as Record<string, unknown>)) {
    return (v as { richText: { text: string }[] }).richText.map((p) => p.text).join("").trim();
  }
  if (typeof v === "object" && "result" in (v as Record<string, unknown>)) {
    return String((v as { result: unknown }).result ?? "").trim();
  }
  return String(v).trim();
}

function esSi(v: string): boolean {
  const t = v.toLowerCase();
  return t === "sí" || t === "si" || t === "s" || t === "true" || t === "x" || t === "1";
}

/** Lee el .xlsx, valida cada fila y arma la vista previa (nada se guarda todavía). */
export async function previsualizarImportacionSocios(
  _prev: PreviewSociosState,
  formData: FormData,
): Promise<PreviewSociosState> {
  try {
    await requireAdmin();

    const tipo = String(formData.get("tipo") ?? "") as Tipo;
    if (!TIPOS.includes(tipo)) return { error: "Tipo de socio no indicado." };
    const esCliente = tipo === "CLIENTE";

    const archivo = formData.get("archivo");
    if (!(archivo instanceof File) || archivo.size === 0) return { error: "Selecciona un archivo .xlsx." };

    const workbook = new ExcelJS.Workbook();
    try {
      const buffer = Buffer.from(await archivo.arrayBuffer());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await workbook.xlsx.load(buffer as any);
    } catch {
      return { error: "No pude leer el archivo. Debe ser el .xlsx de la plantilla, sin convertirlo a otro formato." };
    }

    const hoja = workbook.getWorksheet("Socios") ?? workbook.worksheets[0];
    if (!hoja) return { error: "El archivo no tiene una hoja de socios." };

    const indice: Record<string, number> = {};
    hoja.getRow(1).eachCell((cell, colNumber) => {
      indice[celdaTexto(cell.value)] = colNumber;
    });
    const col = (nombre: string) => indice[nombre];
    const leer = (row: ExcelJS.Row, nombre: string) => (col(nombre) ? celdaTexto(row.getCell(col(nombre)).value) : "");
    if (!col(COLUMNAS_SOCIOS.rut) || !col(COLUMNAS_SOCIOS.razonSocial)) {
      return { error: "El archivo no tiene las columnas RUT y Razón social. Descarga la plantilla nuevamente." };
    }

    const existentes = await prisma.socioNegocio.findMany({ where: { tipo } });
    const porRut = new Map(existentes.map((s) => [s.rut, s]));
    const rutsEnArchivo = new Set<string>();

    const filas: FilaSocioPreview[] = [];
    const aplicar: FilaSocioAplicar[] = [];
    let nuevos = 0;
    let actualiza = 0;
    let sinCambio = 0;
    let errores = 0;

    hoja.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const rutRaw = leer(row, COLUMNAS_SOCIOS.rut);
      const razonSocial = leer(row, COLUMNAS_SOCIOS.razonSocial);
      if (!rutRaw && !razonSocial) return; // fila vacía

      const marcarError = (motivo: string) => {
        errores++;
        filas.push({ fila: rowNumber, rut: rutRaw, razonSocial, estado: "ERROR", motivo });
      };

      const rut = normalizarRut(rutDesdeExcel(rutRaw));
      if (!rut) {
        marcarError("RUT inválido. Formato: 12345678-9.");
        return;
      }
      if (!razonSocial) {
        marcarError("Falta la razón social.");
        return;
      }
      if (rutsEnArchivo.has(rut)) {
        marcarError(`El RUT ${rut} está repetido en el archivo.`);
        return;
      }
      rutsEnArchivo.add(rut);

      const condicionTexto = leer(row, COLUMNAS_SOCIOS.condicionPago);
      const condicionPago = condicionPagoDesdeTexto(condicionTexto);
      if (condicionPago === undefined) {
        marcarError(`Condición de pago no reconocida: "${condicionTexto}". Usa Contado, 30, 60 o 90 días.`);
        return;
      }

      let descuentoPorcentaje = 0;
      let cuentaAbierta = false;
      if (esCliente) {
        const dctoTexto = leer(row, COLUMNAS_SOCIOS.descuento);
        if (dctoTexto) {
          const n = Number(dctoTexto.replace(/[^\d.-]/g, ""));
          if (!Number.isInteger(n) || n < 0 || n > 100) {
            marcarError("El descuento debe ser un entero entre 0 y 100.");
            return;
          }
          descuentoPorcentaje = n;
        }
        cuentaAbierta = esSi(leer(row, COLUMNAS_SOCIOS.cuentaAbierta));
      }

      const email = leer(row, COLUMNAS_SOCIOS.email).toLowerCase() || null;
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        marcarError(`Email inválido: ${email}`);
        return;
      }

      const datos = {
        tipo,
        rut,
        razonSocial,
        nombreFantasia: leer(row, COLUMNAS_SOCIOS.nombreFantasia) || null,
        giro: leer(row, COLUMNAS_SOCIOS.giro) || null,
        email,
        telefono: leer(row, COLUMNAS_SOCIOS.telefono) || null,
        direccion: leer(row, COLUMNAS_SOCIOS.direccion) || null,
        comuna: leer(row, COLUMNAS_SOCIOS.comuna) || null,
        condicionPago,
        descuentoPorcentaje,
        cuentaAbierta,
      };

      const existente = porRut.get(rut);
      const esNuevo = !existente;
      if (existente) {
        const igual =
          existente.razonSocial === datos.razonSocial &&
          existente.nombreFantasia === datos.nombreFantasia &&
          existente.giro === datos.giro &&
          existente.email === datos.email &&
          existente.telefono === datos.telefono &&
          existente.direccion === datos.direccion &&
          existente.comuna === datos.comuna &&
          existente.condicionPago === datos.condicionPago &&
          existente.descuentoPorcentaje === datos.descuentoPorcentaje &&
          existente.cuentaAbierta === datos.cuentaAbierta;
        if (igual) {
          sinCambio++;
          filas.push({ fila: rowNumber, rut, razonSocial, estado: "SIN_CAMBIO" });
          return;
        }
      }

      if (esNuevo) nuevos++;
      else actualiza++;
      filas.push({ fila: rowNumber, rut, razonSocial, estado: esNuevo ? "NUEVO" : "ACTUALIZA" });
      aplicar.push({ ...datos, esNuevo });
    });

    if (filas.length === 0) return { error: "El archivo no tiene filas con datos." };
    if (filas.length > MAX_FILAS_IMPORT) return { error: `Máximo ${MAX_FILAS_IMPORT} filas por importación.` };
    return { filas, payload: JSON.stringify(aplicar), resumen: { nuevos, actualiza, sinCambio, errores } };
  } catch {
    return { error: "No autorizado o error al leer el archivo." };
  }
}

/** Aplica en la BD las filas ya validadas en la vista previa (crea o actualiza por RUT + tipo). */
export async function aplicarImportacionSocios(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    let filas: FilaSocioAplicar[];
    try {
      filas = JSON.parse(String(formData.get("filas") ?? "[]"));
    } catch {
      return { error: "Datos inválidos." };
    }
    if (!Array.isArray(filas) || filas.length === 0) return { error: "No hay filas para aplicar." };
    if (filas.length > MAX_FILAS_IMPORT) return { error: `Máximo ${MAX_FILAS_IMPORT} filas por importación.` };

    let creados = 0;
    let actualizados = 0;
    let fallidos = 0;
    for (let i = 0; i < filas.length; i += 10) {
      const lote = filas.slice(i, i + 10);
      const resultados = await Promise.allSettled(
        lote.map((f) => {
          if (!TIPOS.includes(f.tipo)) throw new Error("tipo");
          const data = {
            razonSocial: f.razonSocial,
            nombreFantasia: f.nombreFantasia,
            giro: f.giro,
            email: f.email,
            telefono: f.telefono,
            direccion: f.direccion,
            comuna: f.comuna,
            condicionPago: f.condicionPago,
            // Igual que en la ficha: en un proveedor estos dos no significan nada
            descuentoPorcentaje: f.tipo === "CLIENTE" ? f.descuentoPorcentaje : 0,
            cuentaAbierta: f.tipo === "CLIENTE" ? f.cuentaAbierta : false,
          };
          return prisma.socioNegocio.upsert({
            where: { rut_tipo: { rut: f.rut, tipo: f.tipo } },
            create: { tipo: f.tipo, rut: f.rut, ...data },
            update: data,
          });
        }),
      );
      resultados.forEach((r, idx) => {
        if (r.status === "fulfilled") {
          if (lote[idx].esNuevo) creados++;
          else actualizados++;
        } else {
          console.error("[socios] importar:", r.reason);
          fallidos++;
        }
      });
    }

    revalidatePath("/dashboard/socios");
    revalidateTag("socios", "max");
    revalidatePath("/dashboard/solicitudes");
    const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);
    return {
      ok: `${creados} ${plural(creados, "creado", "creados")} · ${actualizados} ${plural(actualizados, "actualizado", "actualizados")}${
        fallidos > 0 ? ` · ${fallidos} con error` : ""
      }.`,
    };
  } catch {
    return { error: "No autorizado o error al aplicar la importación." };
  }
}
