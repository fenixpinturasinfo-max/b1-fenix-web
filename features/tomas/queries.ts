import { prisma } from "@/lib/prisma";
import { objetivoDeStock, type EstadoToma } from "./toma";

export interface TomaResumen {
  id: string;
  folio: string;
  localNombre: string;
  estado: EstadoToma;
  alcance: string;
  filtro: string | null;
  creadoPor: string;
  creadoEn: Date;
  total: number;
  contadas: number;
  conDiferencia: number;
  impacto: number;
}

/** Listado de tomas con su avance y el impacto en pesos ya calculado. */
export async function listaTomas(alcance: {
  esGlobal: boolean;
  localId: string | null;
}): Promise<TomaResumen[]> {
  if (!alcance.esGlobal && !alcance.localId) return [];

  const tomas = await prisma.tomaInventario.findMany({
    where: alcance.localId ? { localId: alcance.localId } : {},
    include: {
      local: { select: { nombre: true } },
      creadoPor: { select: { nombre: true } },
      lineas: {
        select: {
          esperado: true,
          contado: true,
          productoId: true,
          producto: { select: { precioCosto: true } },
        },
      },
    },
    orderBy: { creadoEn: "desc" },
    take: 100,
  });

  // El impacto se mide contra el stock actual, igual que en el detalle y al aplicar:
  // el esperado quedó congelado al abrir y ya no representa lo que hay.
  const stocks = await prisma.stockLocal.findMany({
    where: { localId: alcance.localId ?? undefined },
    select: { localId: true, productoId: true, cantidad: true },
  });
  const stockPor = new Map(stocks.map((s) => [`${s.localId}:${s.productoId}`, s.cantidad]));

  return tomas.map((t) => {
    const contadas = t.lineas.filter((l) => l.contado !== null);
    const dif = contadas
      .map((l) => ({
        l,
        delta: l.contado! - (stockPor.get(`${t.localId}:${l.productoId}`) ?? 0),
      }))
      .filter((x) => x.delta !== 0);
    return {
      id: t.id,
      folio: `TI-${String(t.correlativo).padStart(6, "0")}`,
      localNombre: t.local.nombre,
      estado: t.estado as EstadoToma,
      alcance: t.alcance,
      filtro: t.filtro,
      creadoPor: t.creadoPor.nombre,
      creadoEn: t.creadoEn,
      total: t.lineas.length,
      contadas: contadas.length,
      conDiferencia: dif.length,
      impacto: dif.reduce((n, x) => n + x.delta * x.l.producto.precioCosto, 0),
    };
  });
}

export interface LineaDetalle {
  id: string;
  productoId: string;
  nombre: string;
  marca: string;
  sku: string;
  ubicacion: string | null;
  esperado: number;
  contado: number | null;
  contadoEn: Date | null;
  saltada: boolean;
  motivo: string | null;
  precioCosto: number;
  /** Movimientos del producto posteriores al conteo: explican por qué el stock cambió */
  movPosteriores: number;
  /** Stock que el sistema tiene ahora mismo */
  stockActual: number;
  /** A cuánto quedará el stock si se aplica */
  objetivo: number | null;
  /**
   * Lo que realmente va a cambiar al aplicar: objetivo − stock actual.
   *
   * No es `contado − esperado`. El esperado se congeló al abrir la toma y entre eso y el
   * conteo el local siguió vendiendo, así que esa resta muestra diferencias que la
   * aplicación no va a hacer. Dos números contradictorios en la misma pantalla.
   */
  diferencia: number | null;
  valorDiferencia: number;
}

export interface TomaDetalle {
  id: string;
  folio: string;
  localId: string;
  localNombre: string;
  estado: EstadoToma;
  alcance: string;
  filtro: string | null;
  ciego: boolean;
  nota: string | null;
  creadoPor: string;
  creadoEn: Date;
  aplicadaPor: string | null;
  aplicadaEn: Date | null;
  lineas: LineaDetalle[];
}

/**
 * Detalle de una toma.
 *
 * `paraContar` recorta lo que el contador no debe ver cuando la toma es a ciegas. Ocultarlo
 * solo en la UI no sirve: el dato viaja igual en el payload y basta abrir las herramientas
 * del navegador para verlo, con lo que el conteo ciego sería ciego de mentira.
 */
export async function tomaDetalle(
  id: string,
  opciones: { paraContar?: boolean } = {},
): Promise<TomaDetalle | null> {
  const t = await prisma.tomaInventario.findUnique({
    where: { id },
    include: {
      local: { select: { nombre: true } },
      creadoPor: { select: { nombre: true } },
      aplicadaPor: { select: { nombre: true } },
      lineas: {
        include: {
          producto: {
            select: { id: true, nombre: true, marca: true, sku: true, precioCosto: true },
          },
        },
      },
    },
  });
  if (!t) return null;

  const stocks = await prisma.stockLocal.findMany({
    where: { localId: t.localId, productoId: { in: t.lineas.map((l) => l.productoId) } },
    select: { productoId: true, ubicacion: true, cantidad: true },
  });
  const stockPor = new Map(stocks.map((u) => [u.productoId, u]));

  // Movimientos posteriores a cada conteo: sin esto una venta hecha después de contar
  // se vería como faltante. Solo importa en las líneas ya contadas.
  const contadas = t.lineas.filter((l) => l.contadoEn !== null);
  const posteriores = new Map<string, number>();
  // Una vez aplicada, la corrección ya no aplica: el stock es el resultado de la toma
  if (contadas.length > 0 && t.estado !== "APLICADA") {
    const minFecha = new Date(Math.min(...contadas.map((l) => l.contadoEn!.getTime())));
    const movs = await prisma.movimientoInventario.findMany({
      where: {
        localId: t.localId,
        productoId: { in: contadas.map((l) => l.productoId) },
        creadoEn: { gt: minFecha },
      },
      select: { productoId: true, cantidad: true, creadoEn: true },
    });
    // Indexado por producto: cruzar con filter por cada línea es O(líneas × movimientos)
    const porProducto = new Map<string, { cantidad: number; creadoEn: Date }[]>();
    for (const m of movs) {
      porProducto.set(m.productoId, [...(porProducto.get(m.productoId) ?? []), m]);
    }
    for (const l of contadas) {
      const suma = (porProducto.get(l.productoId) ?? [])
        .filter((m) => m.creadoEn > l.contadoEn!)
        .reduce((n, m) => n + m.cantidad, 0);
      if (suma !== 0) posteriores.set(l.id, suma);
    }
  }

  const lineas: LineaDetalle[] = t.lineas
    .map((l) => {
      const mov = posteriores.get(l.id) ?? 0;
      const stockActual = stockPor.get(l.productoId)?.cantidad ?? 0;
      const objetivo = l.contado === null ? null : objetivoDeStock(l.contado, mov);
      const diferencia = objetivo === null ? null : objetivo - stockActual;
      return {
        id: l.id,
        productoId: l.productoId,
        nombre: l.producto.nombre,
        marca: l.producto.marca,
        sku: l.producto.sku,
        ubicacion: stockPor.get(l.productoId)?.ubicacion ?? null,
        esperado: l.esperado,
        contado: l.contado,
        contadoEn: l.contadoEn,
        saltada: l.saltada,
        motivo: l.motivo,
        precioCosto: l.producto.precioCosto,
        movPosteriores: mov,
        stockActual,
        objetivo,
        diferencia,
        valorDiferencia: (diferencia ?? 0) * l.producto.precioCosto,
      };
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // A ciegas: el contador recibe el producto y nada más
  const oculta = opciones.paraContar === true && t.ciego;
  const expuestas = oculta
    ? lineas.map((l) => ({
        ...l,
        esperado: 0,
        stockActual: 0,
        objetivo: null,
        diferencia: null,
        valorDiferencia: 0,
        precioCosto: 0,
      }))
    : lineas;

  return {
    id: t.id,
    folio: `TI-${String(t.correlativo).padStart(6, "0")}`,
    localId: t.localId,
    localNombre: t.local.nombre,
    estado: t.estado as EstadoToma,
    alcance: t.alcance,
    filtro: t.filtro,
    ciego: t.ciego,
    nota: t.nota,
    creadoPor: t.creadoPor.nombre,
    creadoEn: t.creadoEn,
    aplicadaPor: t.aplicadaPor?.nombre ?? null,
    aplicadaEn: t.aplicadaEn,
    lineas: expuestas,
  };
}

/**
 * Opciones para abrir una toma.
 *
 * Categorías y marcas son del catálogo, que es único para toda la cadena: no dependen del
 * local. Solo las ubicaciones sí, así que vienen agrupadas por local para que gerencia
 * pueda elegir la sucursal dentro del formulario y ver las de esa sucursal.
 */
export async function opcionesDeAlcance(localId: string | null) {
  const [categorias, productos, stocks] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    prisma.producto.findMany({ where: { activo: true }, select: { marca: true } }),
    prisma.stockLocal.findMany({
      where: { ubicacion: { not: null }, ...(localId ? { localId } : {}) },
      select: { localId: true, ubicacion: true },
    }),
  ]);

  const ubicacionesPorLocal: Record<string, string[]> = {};
  for (const s of stocks) {
    const actuales = ubicacionesPorLocal[s.localId] ?? [];
    if (!actuales.includes(s.ubicacion!)) {
      ubicacionesPorLocal[s.localId] = [...actuales, s.ubicacion!].sort();
    }
  }

  return {
    categorias,
    marcas: [...new Set(productos.map((p) => p.marca))].sort(),
    ubicacionesPorLocal,
  };
}
