"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import {
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
      data: { contado, contadoEn: new Date(), saltada: false },
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
    include: { lineas: { select: { contado: true } } },
  });
  if (!toma || toma.estado !== "ABIERTA") return;
  if (!validaLocal(session, toma.localId)) return;
  // Sin ninguna línea contada no hay nada que revisar
  if (toma.lineas.every((l) => l.contado === null)) return;

  await prisma.tomaInventario.update({
    where: { id: tomaId },
    data: { estado: "CONTADA", cerradaEn: new Date() },
  });
  revalidatePath("/dashboard/inventario/tomas");
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
      data: { contado: null, contadoEn: null, saltada: false },
    }),
    prisma.tomaInventario.update({
      where: { id: tomaId },
      data: { estado: "ABIERTA", cerradaEn: null },
    }),
  ]);
  revalidatePath("/dashboard/inventario/tomas");
}

export async function anularToma(formData: FormData) {
  const tomaId = String(formData.get("tomaId") ?? "");
  const previa = await prisma.tomaInventario.findUnique({ where: { id: tomaId } });
  if (!previa || previa.estado === "APLICADA" || previa.estado === "ANULADA") return;

  // Anular un conteo ya cerrado borraría el rastro antes de que nadie lo revise:
  // eso lo decide quien aprueba, no quien contó.
  const session = await exigirEscritura(
    previa.estado === "CONTADA" ? "inventario.toma-aprobar" : "inventario.toma",
  );
  const toma = previa;
  if (!validaLocal(session, toma.localId)) return;

  await prisma.tomaInventario.update({ where: { id: tomaId }, data: { estado: "ANULADA" } });
  revalidatePath("/dashboard/inventario/tomas");
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
