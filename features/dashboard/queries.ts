import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { esDescuadre } from "@/features/pos/caja";
import {
  finDia,
  inicioDia,
  inicioMes,
  mismoDiaSemanaPasada,
  mismoInstanteMesAnterior,
  sumarDias,
  ultimosDias,
} from "@/lib/fechas";

/**
 * Consultas del dashboard, una función por perfil.
 *
 * Cada función hace un único `Promise.all` para evitar cascadas de espera, y solo
 * consulta lo que su dashboard muestra. Todos los cortes de fecha pasan por
 * `lib/fechas` para que "hoy" sea el día chileno y no el del servidor.
 */

export interface Contexto {
  usuarioId: string;
  localId: string | null;
  esGlobal: boolean;
}

const VENTA_OK = { estado: "COMPLETADA" } as const;

function alcance(ctx: Contexto) {
  return ctx.esGlobal ? {} : { localId: ctx.localId! };
}

/** Variación porcentual. Devuelve null cuando no hay base de comparación. */
export function variacion(actual: number, previo: number): number | null {
  if (previo <= 0) return null;
  return ((actual - previo) / previo) * 100;
}

/**
 * Solicitudes pendientes contadas **por documento**, no por línea.
 *
 * `SolicitudReposicion` guarda una fila por producto y `/dashboard/solicitudes` las
 * agrupa por correlativo en folios SOL-. Si acá contáramos filas, una solicitud de 6
 * productos aparecería como "6 pendientes" y al hacer clic se vería una sola.
 * Además la lista marca como PARCIAL el documento con estados mezclados, así que
 * solo cuentan los documentos íntegramente pendientes: son los que el filtro muestra.
 */
async function solicitudesPendientesDoc(where: Prisma.SolicitudReposicionWhereInput) {
  const filas = await prisma.solicitudReposicion.findMany({
    where: { ...where, destino: "PROVEEDOR" },
    select: { id: true, correlativo: true, estado: true },
  });

  const porDoc = new Map<string, string[]>();
  for (const f of filas) {
    const clave = f.correlativo != null ? `SOL-${f.correlativo}` : f.id;
    porDoc.set(clave, [...(porDoc.get(clave) ?? []), f.estado]);
  }
  let n = 0;
  for (const estados of porDoc.values()) {
    if (estados.every((e) => e === "PENDIENTE")) n++;
  }
  return n;
}

// ─────────────────────────────── Bloques ───────────────────────────────

export interface BloqueVentas {
  hoyTotal: number;
  hoyN: number;
  deltaDia: number | null;
  mesTotal: number;
  mesN: number;
  deltaMes: number | null;
  ticketHoy: number;
}

/** Ventas de hoy y del mes, con su comparación. `soloPropio` filtra por vendedor. */
async function bloqueVentas(ctx: Contexto, soloPropio: boolean): Promise<BloqueVentas> {
  const where = soloPropio ? { usuarioId: ctx.usuarioId } : alcance(ctx);
  // Ventana recortada a la misma hora: hoy va a medio día, la referencia también
  const [semIni, semFin] = mismoDiaSemanaPasada();

  const [hoy, semanaPasada, mes, mesPrevio] = await Promise.all([
    prisma.venta.aggregate({
      where: { ...where, ...VENTA_OK, creadoEn: { gte: inicioDia() } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.aggregate({
      where: { ...where, ...VENTA_OK, creadoEn: { gte: semIni, lt: semFin } },
      _sum: { total: true },
    }),
    prisma.venta.aggregate({
      where: { ...where, ...VENTA_OK, creadoEn: { gte: inicioMes() } },
      _sum: { total: true },
      _count: true,
    }),
    // Mes anterior recortado al mismo día y hora: comparar un mes completo
    // contra 12 días corridos siempre daría una caída falsa.
    prisma.venta.aggregate({
      where: {
        ...where,
        ...VENTA_OK,
        creadoEn: { gte: inicioMes(mismoInstanteMesAnterior()), lt: mismoInstanteMesAnterior() },
      },
      _sum: { total: true },
    }),
  ]);

  const hoyTotal = hoy._sum.total ?? 0;
  const hoyN = hoy._count;

  return {
    hoyTotal,
    hoyN,
    deltaDia: variacion(hoyTotal, semanaPasada._sum.total ?? 0),
    mesTotal: mes._sum.total ?? 0,
    mesN: mes._count,
    deltaMes: variacion(mes._sum.total ?? 0, mesPrevio._sum.total ?? 0),
    ticketHoy: hoyN > 0 ? Math.round(hoyTotal / hoyN) : 0,
  };
}

export interface SerieDiaria {
  valores: number[];
  etiquetas: string[];
}

/** Serie de ventas por día para el sparkline. Una sola consulta, agrupada en memoria. */
async function serieVentas(ctx: Contexto, dias: number, soloPropio: boolean): Promise<SerieDiaria> {
  const rango = ultimosDias(dias);
  const where = soloPropio ? { usuarioId: ctx.usuarioId } : alcance(ctx);

  const ventas = await prisma.venta.findMany({
    where: { ...where, ...VENTA_OK, creadoEn: { gte: rango[0].inicio } },
    select: { creadoEn: true, total: true },
  });

  const valores = rango.map((d) =>
    ventas
      .filter((v) => v.creadoEn >= d.inicio && v.creadoEn < d.fin)
      .reduce((a, v) => a + v.total, 0),
  );
  return { valores, etiquetas: rango.map((d) => d.etiqueta) };
}

export interface BloqueStock {
  quiebres: number;
  bajos: number;
  valor: number;
  conStock: number;
  total: number;
}

/** Estado del inventario en el alcance del rol. Una consulta, tres métricas. */
async function bloqueStock(ctx: Contexto): Promise<BloqueStock> {
  const filas = await prisma.stockLocal.findMany({
    where: { ...alcance(ctx), producto: { activo: true } },
    select: { cantidad: true, stockMin: true, producto: { select: { precioCosto: true } } },
  });

  return {
    quiebres: filas.filter((f) => f.cantidad <= 0).length,
    bajos: filas.filter((f) => f.cantidad > 0 && f.cantidad <= f.stockMin).length,
    valor: filas.reduce((a, f) => a + f.cantidad * f.producto.precioCosto, 0),
    conStock: filas.filter((f) => f.cantidad > 0).length,
    total: filas.length,
  };
}

export interface BloqueCompras {
  porRecibir: number;
  atrasadas: number;
}

async function bloqueCompras(ctx: Contexto): Promise<BloqueCompras> {
  const where: Prisma.OrdenCompraWhereInput = {
    estado: { in: ["ENVIADA", "RECIBIDA_PARCIAL"] },
    ...(ctx.esGlobal ? {} : { localDestinoId: ctx.localId! }),
  };
  const [porRecibir, atrasadas] = await Promise.all([
    prisma.ordenCompra.count({ where }),
    prisma.ordenCompra.count({ where: { ...where, fechaRequerida: { lt: inicioDia() } } }),
  ]);
  return { porRecibir, atrasadas };
}

export interface BloqueCajas {
  abiertas: number;
  cerradasHoy: number;
  /** Suma de diferencias en valor absoluto: dos descuadres opuestos no deben dar cero */
  descuadreHoy: number;
  descuadradasHoy: number;
  sinCerrarAntiguas: number;
}

async function bloqueCajas(ctx: Contexto): Promise<BloqueCajas> {
  const where = alcance(ctx);
  const [abiertas, cerradasHoy, antiguas] = await Promise.all([
    prisma.cajaSesion.count({ where: { ...where, estado: "ABIERTA" } }),
    prisma.cajaSesion.findMany({
      where: { ...where, estado: "CERRADA", cerradaEn: { gte: inicioDia() } },
      select: { diferencia: true },
    }),
    // Una caja abierta de un día anterior es un cierre que nadie hizo
    prisma.cajaSesion.count({
      where: { ...where, estado: "ABIERTA", abiertaEn: { lt: inicioDia() } },
    }),
  ]);

  return {
    abiertas,
    cerradasHoy: cerradasHoy.length,
    // Mismo umbral que el reporte de caja: dos veredictos distintos sobre el mismo día
    // destruyen la credibilidad de la tolerancia
    descuadreHoy: cerradasHoy
      .filter((c) => esDescuadre(c.diferencia))
      .reduce((a, c) => a + Math.abs(c.diferencia ?? 0), 0),
    descuadradasHoy: cerradasHoy.filter((c) => esDescuadre(c.diferencia)).length,
    sinCerrarAntiguas: antiguas,
  };
}

/**
 * Margen del mes con el costo congelado en cada línea de venta.
 *
 * El ingreso se toma de `Venta.total` (neto de descuento de cabecera) y no de la suma
 * de `DetalleVenta.subtotal`, para que este número use la misma definición de "venta"
 * que el KPI de ventas del mes que va al lado.
 *
 * Pendiente de rendimiento: trae una fila por línea vendida en el mes. Con ~4 locales
 * son unas 30.000 filas de 2 enteros a fin de mes. Si molesta, pasar a SUM en SQL.
 */
async function margenMes(ctx: Contexto): Promise<number | null> {
  const desde = inicioMes();
  const [ingreso, lineas] = await Promise.all([
    prisma.venta.aggregate({
      where: { ...alcance(ctx), ...VENTA_OK, creadoEn: { gte: desde } },
      _sum: { total: true },
    }),
    prisma.detalleVenta.findMany({
      where: { venta: { ...alcance(ctx), ...VENTA_OK, creadoEn: { gte: desde } } },
      select: { cantidad: true, costoUnitario: true },
    }),
  ]);

  const ventas = ingreso._sum.total ?? 0;
  if (ventas <= 0 || lineas.length === 0) return null;

  const costo = lineas.reduce((a, l) => a + l.cantidad * l.costoUnitario, 0);
  return ((ventas - costo) / ventas) * 100;
}

export interface ProductoTop {
  id: string;
  nombre: string;
  marca: string;
  total: number;
  unidades: number;
}

async function topProductos(ctx: Contexto, n: number): Promise<ProductoTop[]> {
  const grupos = await prisma.detalleVenta.groupBy({
    by: ["productoId"],
    where: { venta: { ...alcance(ctx), ...VENTA_OK, creadoEn: { gte: inicioMes() } } },
    _sum: { subtotal: true, cantidad: true },
    orderBy: { _sum: { subtotal: "desc" } },
    take: n,
  });
  if (grupos.length === 0) return [];

  const productos = await prisma.producto.findMany({
    where: { id: { in: grupos.map((g) => g.productoId) } },
    select: { id: true, nombre: true, marca: true },
  });
  const porId = new Map(productos.map((p) => [p.id, p]));

  return grupos.map((g) => ({
    id: g.productoId,
    nombre: porId.get(g.productoId)?.nombre ?? "—",
    marca: porId.get(g.productoId)?.marca ?? "",
    total: g._sum.subtotal ?? 0,
    unidades: g._sum.cantidad ?? 0,
  }));
}

// ───────────────────────────── Por perfil ─────────────────────────────

export interface DatosVendedor {
  caja: {
    id: string;
    abiertaEn: Date;
    montoApertura: number;
    ventasTurno: number;
    boletasTurno: number;
  } | null;
  ventas: BloqueVentas;
  serie: SerieDiaria;
  pedidosPendientes: number;
}

export async function datosVendedor(ctx: Contexto): Promise<DatosVendedor> {
  const cajaAbierta = await prisma.cajaSesion.findFirst({
    where: { usuarioId: ctx.usuarioId, estado: "ABIERTA" },
    orderBy: { abiertaEn: "desc" },
  });

  const [turno, ventas, serie, pedidosPendientes] = await Promise.all([
    cajaAbierta
      ? prisma.venta.aggregate({
          where: { cajaSesionId: cajaAbierta.id, ...VENTA_OK },
          _sum: { total: true },
          _count: true,
        })
      : Promise.resolve(null),
    bloqueVentas(ctx, true),
    serieVentas(ctx, 14, true),
    // Solo PENDIENTE: los PREPARADO ya esperan al cliente, no al local.
    // Además así el contador cuadra con la lista que abre el enlace.
    ctx.localId
      ? prisma.pedidoCliente.count({
          where: { localId: ctx.localId, estado: "PENDIENTE" },
        })
      : Promise.resolve(0),
  ]);

  return {
    caja: cajaAbierta
      ? {
          id: cajaAbierta.id,
          abiertaEn: cajaAbierta.abiertaEn,
          montoApertura: cajaAbierta.montoApertura,
          ventasTurno: turno?._sum.total ?? 0,
          boletasTurno: turno?._count ?? 0,
        }
      : null,
    ventas,
    serie,
    pedidosPendientes,
  };
}

export interface MovimientoReciente {
  id: string;
  tipo: string;
  cantidad: number;
  producto: string;
  usuario: string;
  creadoEn: Date;
}

export interface DatosBodega {
  stock: BloqueStock;
  compras: BloqueCompras;
  solicitudesAbiertas: number;
  movimientosHoy: number;
  ultimosMovimientos: MovimientoReciente[];
}

export async function datosBodega(ctx: Contexto): Promise<DatosBodega> {
  const [stock, compras, solicitudesAbiertas, movimientosHoy, ultimos] = await Promise.all([
    bloqueStock(ctx),
    bloqueCompras(ctx),
    // Del local, no solo las propias: si dos bodegueros se turnan, cada uno
    // debe ver el backlog completo.
    solicitudesPendientesDoc(alcance(ctx)),
    // Sin SALIDA_VENTA: esas las genera el POS solo y no son carga de trabajo de bodega
    prisma.movimientoInventario.count({
      where: {
        ...alcance(ctx),
        creadoEn: { gte: inicioDia() },
        tipo: { not: "SALIDA_VENTA" },
      },
    }),
    prisma.movimientoInventario.findMany({
      where: alcance(ctx),
      orderBy: { creadoEn: "desc" },
      take: 5,
      select: {
        id: true,
        tipo: true,
        cantidad: true,
        creadoEn: true,
        producto: { select: { nombre: true } },
        usuario: { select: { nombre: true } },
      },
    }),
  ]);

  return {
    stock,
    compras,
    solicitudesAbiertas,
    movimientosHoy,
    ultimosMovimientos: ultimos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad: m.cantidad,
      producto: m.producto.nombre,
      usuario: m.usuario.nombre.split(" ")[0],
      creadoEn: m.creadoEn,
    })),
  };
}

export interface DatosJefeLocal {
  cajas: BloqueCajas;
  stock: BloqueStock;
  compras: BloqueCompras;
  pedidosPendientes: number;
  solicitudes: number;
  /** Solo el encargado de la casa matriz resuelve solicitudes; el resto solo las sigue */
  resuelveSolicitudes: boolean;
  ventas: BloqueVentas;
  margen: number | null;
  serie: SerieDiaria;
  top: ProductoTop[];
}

export async function datosJefeLocal(ctx: Contexto): Promise<DatosJefeLocal> {
  const matriz = await prisma.local.findFirst({
    where: { esMatriz: true, activo: true },
    select: { id: true },
  });
  const resuelveSolicitudes = matriz !== null && matriz.id === ctx.localId;

  const [cajas, stock, compras, pedidosPendientes, solicitudes, ventas, margen, serie, top] =
    await Promise.all([
      bloqueCajas(ctx),
      bloqueStock(ctx),
      bloqueCompras(ctx),
      prisma.pedidoCliente.count({ where: { ...alcance(ctx), estado: "PENDIENTE" } }),
      // El encargado de matriz resuelve las de todos los locales; los demás solo ven las suyas
      solicitudesPendientesDoc(resuelveSolicitudes ? {} : alcance(ctx)),
      bloqueVentas(ctx, false),
      margenMes(ctx),
      serieVentas(ctx, 14, false),
      topProductos(ctx, 5),
    ]);

  return {
    cajas,
    stock,
    compras,
    pedidosPendientes,
    solicitudes,
    resuelveSolicitudes,
    ventas,
    margen,
    serie,
    top,
  };
}

export interface FilaLocal {
  id: string;
  nombre: string;
  ventasHoy: number;
  ventasN: number;
  quiebres: number;
  cajasAbiertas: number;
  ocPorRecibir: number;
}

export interface SaludMaestro {
  productosSinCosto: number;
  sociosSinEmail: number;
  usuariosActivos: number;
  locales: number;
  sinMatriz: boolean;
}

export interface DatosGerencia {
  ventas: BloqueVentas;
  margen: number | null;
  serie: SerieDiaria;
  /** Productos sin stock en toda la cadena (mismo criterio que la vista Consolidado) */
  productosEnQuiebre: number;
  compras: BloqueCompras;
  cajas: BloqueCajas;
  pedidosPendientes: number;
  solicitudesPorResolver: number;
  porPagar: { total: number; vencidas: number; montoVencido: number; porVencer: number };
  locales: FilaLocal[];
  salud: SaludMaestro | null;
}

export async function datosGerencia(
  ctx: Contexto,
  opciones: { conSalud: boolean },
): Promise<DatosGerencia> {
  if (!ctx.esGlobal) {
    throw new Error("datosGerencia solo aplica a roles con visión de todos los locales");
  }

  const hoyIni = inicioDia();
  const en7Dias = finDia(sumarDias(new Date(), 6));

  const [
    ventas,
    margen,
    serie,
    compras,
    cajas,
    pedidosPendientes,
    solicitudesPorResolver,
    facturasAbiertas,
    locales,
    ventasPorLocal,
    stocksPorLocal,
    stockConsolidado,
    cajasPorLocal,
    ocPorLocal,
    salud,
  ] = await Promise.all([
    bloqueVentas(ctx, false),
    margenMes(ctx),
    serieVentas(ctx, 14, false),
    bloqueCompras(ctx),
    bloqueCajas(ctx),
    prisma.pedidoCliente.count({ where: { estado: "PENDIENTE" } }),
    solicitudesPendientesDoc({}),
    // Las NC rebajan la deuda pero no modifican FacturaCompra.total, hay que descontarlas
    prisma.facturaCompra.findMany({
      where: { estado: "ABIERTA" },
      select: {
        total: true,
        fechaVencimiento: true,
        notasCredito: { select: { total: true } },
      },
    }),
    prisma.local.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
      select: { id: true, nombre: true },
    }),
    prisma.venta.groupBy({
      by: ["localId"],
      where: { ...VENTA_OK, creadoEn: { gte: hoyIni } },
      _sum: { total: true },
      _count: true,
    }),
    // Quiebres por local, para el semáforo
    prisma.stockLocal.findMany({
      where: { producto: { activo: true }, local: { activo: true }, cantidad: { lte: 0 } },
      select: { localId: true },
    }),
    // Stock consolidado por producto: el mismo criterio con el que abre
    // /dashboard/inventario?estado=SIN en la vista Consolidado
    prisma.stockLocal.groupBy({
      by: ["productoId"],
      where: { producto: { activo: true }, local: { activo: true } },
      _sum: { cantidad: true },
    }),
    prisma.cajaSesion.groupBy({
      by: ["localId"],
      where: { estado: "ABIERTA" },
      _count: true,
    }),
    prisma.ordenCompra.groupBy({
      by: ["localDestinoId"],
      where: { estado: { in: ["ENVIADA", "RECIBIDA_PARCIAL"] } },
      _count: true,
    }),
    opciones.conSalud ? saludMaestro() : Promise.resolve(null),
  ]);

  // "Vencida" = su fecha ya pasó por completo; una que vence hoy todavía es "por vencer".
  // Mismo criterio que usa el listado de facturas.
  const vencidas = facturasAbiertas.filter(
    (f) => f.fechaVencimiento !== null && f.fechaVencimiento < hoyIni,
  );
  const porVencer = facturasAbiertas.filter(
    (f) => f.fechaVencimiento !== null && f.fechaVencimiento >= hoyIni && f.fechaVencimiento < en7Dias,
  );

  const quiebresPorLocal = new Map<string, number>();
  for (const s of stocksPorLocal) {
    quiebresPorLocal.set(s.localId, (quiebresPorLocal.get(s.localId) ?? 0) + 1);
  }
  const productosEnQuiebre = stockConsolidado.filter((p) => (p._sum.cantidad ?? 0) <= 0).length;

  /** Deuda real de la factura: total menos las notas de crédito emitidas contra ella */
  const neto = (f: { total: number; notasCredito: { total: number }[] }) =>
    Math.max(0, f.total - f.notasCredito.reduce((a, nc) => a + nc.total, 0));

  return {
    ventas,
    margen,
    serie,
    productosEnQuiebre,
    compras,
    cajas,
    pedidosPendientes,
    solicitudesPorResolver,
    porPagar: {
      total: facturasAbiertas.reduce((a, f) => a + neto(f), 0),
      vencidas: vencidas.length,
      montoVencido: vencidas.reduce((a, f) => a + neto(f), 0),
      porVencer: porVencer.length,
    },
    locales: locales.map((l) => ({
      id: l.id,
      nombre: l.nombre,
      ventasHoy: ventasPorLocal.find((v) => v.localId === l.id)?._sum.total ?? 0,
      ventasN: ventasPorLocal.find((v) => v.localId === l.id)?._count ?? 0,
      quiebres: quiebresPorLocal.get(l.id) ?? 0,
      cajasAbiertas: cajasPorLocal.find((c) => c.localId === l.id)?._count ?? 0,
      ocPorRecibir: ocPorLocal.find((o) => o.localDestinoId === l.id)?._count ?? 0,
    })),
    salud,
  };
}

/** Errores de datos maestros que rompen flujos en silencio (solo administrador). */
async function saludMaestro(): Promise<SaludMaestro> {
  const [productosSinCosto, sociosSinEmail, usuariosActivos, locales, matrices] = await Promise.all([
    prisma.producto.count({ where: { activo: true, precioCosto: { lte: 0 } } }),
    prisma.socioNegocio.count({
      where: { activo: true, tipo: "PROVEEDOR", OR: [{ email: null }, { email: "" }] },
    }),
    prisma.usuario.count({ where: { activo: true } }),
    prisma.local.count({ where: { activo: true } }),
    prisma.local.count({ where: { activo: true, esMatriz: true } }),
  ]);

  return {
    productosSinCosto,
    sociosSinEmail,
    usuariosActivos,
    locales,
    sinMatriz: matrices === 0,
  };
}
