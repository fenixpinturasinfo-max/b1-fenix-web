import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";
import { finDia, inicioDia, instanteSantiago, partesSantiago, sumarDias, ultimosDias } from "@/lib/fechas";
import { esperadoEnCaja, saldoMovimientos } from "./caja";

/**
 * Turnos de caja para la línea de tiempo del día.
 *
 * En este sistema una "caja" es el turno de una persona, no un cajón físico: `abrirCaja`
 * valida una por usuario y local, así que dos vendedores pueden tener caja abierta a la
 * vez en la misma sucursal. Por eso la vista se arma por persona y no por terminal.
 */

export interface MovTurno {
  id: string;
  tipo: string;
  monto: number;
  motivo: string;
  creadoEn: Date;
}

export interface Turno {
  id: string;
  localId: string;
  localNombre: string;
  usuarioNombre: string;
  abiertaEn: Date;
  cerradaEn: Date | null;
  abierta: boolean;
  /** Cierre real, o el corte del día si sigue abierta. Para dibujar y medir huecos. */
  finEfectivo: Date;
  montoApertura: number;
  montoCierre: number | null;
  /** Recalculado siempre: el guardado puede ser de antes de que existieran los movimientos */
  esperado: number;
  diferencia: number | null;
  ventas: number;
  ventasEfectivo: number;
  nVentas: number;
  saldoMovs: number;
  movimientos: MovTurno[];
  notaCierre: string | null;
}

/** Tramo del día sin ninguna caja abierta en el local: nadie pudo vender. */
export interface Hueco {
  desde: Date;
  hasta: Date;
  minutos: number;
}

export interface DiaDeCaja {
  localId: string;
  localNombre: string;
  turnos: Turno[];
  huecos: Hueco[];
  /** Minutos del solape más largo entre dos turnos. 0 si no hay ninguno relevante. */
  solapeMin: number;
  ventasTotal: number;
  esperadoTotal: number;
}

function aTurno(c: {
  id: string;
  localId: string;
  local: { nombre: string };
  usuario: { nombre: string };
  abiertaEn: Date;
  cerradaEn: Date | null;
  estado: string;
  montoApertura: number;
  montoCierre: number | null;
  diferencia: number | null;
  notaCierre: string | null;
  ventas: { total: number; medioPago: string }[];
  movimientos: MovTurno[];
}, corte: Date): Turno {
  const ventasEfectivo = c.ventas
    .filter((v) => v.medioPago === "EFECTIVO")
    .reduce((n, v) => n + v.total, 0);
  const esperado = esperadoEnCaja(c.montoApertura, ventasEfectivo, c.movimientos);

  return {
    id: c.id,
    localId: c.localId,
    localNombre: c.local.nombre,
    usuarioNombre: c.usuario.nombre,
    abiertaEn: c.abiertaEn,
    cerradaEn: c.cerradaEn,
    abierta: c.estado === "ABIERTA",
    // Una caja que nadie cerró no se estira hasta hoy: se corta al final de su jornada,
    // o taparía los huecos de todos los días siguientes.
    finEfectivo: c.cerradaEn ?? corte,
    montoApertura: c.montoApertura,
    montoCierre: c.montoCierre,
    esperado,
    // Se recalcula en vez de usar el guardado: las cajas cerradas antes de que existieran
    // los movimientos tienen un `diferencia` que ya no refleja la realidad.
    diferencia: c.montoCierre === null ? null : c.montoCierre - esperado,
    ventas: c.ventas.reduce((n, v) => n + v.total, 0),
    ventasEfectivo,
    nVentas: c.ventas.length,
    saldoMovs: saldoMovimientos(c.movimientos),
    movimientos: c.movimientos,
    notaCierre: c.notaCierre,
  };
}

/**
 * Tramos sin ninguna caja abierta, medidos contra la jornada de atención completa.
 *
 * Mirar solo el espacio *entre* turnos deja pasar el caso peor: con un único turno de
 * 30 minutos el reporte diría "cobertura completa". El hueco de las once horas restantes
 * es justamente lo que esta vista promete destapar.
 */
function calcularHuecos(turnos: Turno[], jornada: { desde: Date; hasta: Date }): Hueco[] {
  const tramos = turnos
    .map((t) => ({
      ini: t.abiertaEn < jornada.desde ? jornada.desde : t.abiertaEn,
      fin: t.finEfectivo > jornada.hasta ? jornada.hasta : t.finEfectivo,
    }))
    .filter((t) => t.fin > t.ini)
    .sort((a, b) => a.ini.getTime() - b.ini.getTime());

  const huecos: Hueco[] = [];
  const agregar = (desde: Date, hasta: Date) => {
    const minutos = Math.round((hasta.getTime() - desde.getTime()) / 60000);
    // Bajo 15 minutos es el relevo normal entre turnos, no un hueco de servicio
    if (minutos >= 15) huecos.push({ desde, hasta, minutos });
  };

  let cubiertoHasta = jornada.desde;
  for (const t of tramos) {
    if (t.ini > cubiertoHasta) agregar(cubiertoHasta, t.ini);
    if (t.fin > cubiertoHasta) cubiertoHasta = t.fin;
  }
  if (cubiertoHasta < jornada.hasta) agregar(cubiertoHasta, jornada.hasta);
  return huecos;
}

/**
 * Solape que importa: dos turnos encima por más de lo que dura un relevo.
 *
 * En este modelo dos vendedores pueden tener caja a la vez y eso es normal, así que
 * avisar de cualquier cruce prendería la alerta todos los días y nadie la leería.
 */
const SOLAPE_RELEVANTE_MIN = 30;

function minutosDeSolape(turnos: Turno[]): number {
  const tramos = turnos
    .map((t) => ({ ini: t.abiertaEn.getTime(), fin: t.finEfectivo.getTime() }))
    .sort((a, b) => a.ini - b.ini);
  let total = 0;
  for (let i = 1; i < tramos.length; i++) {
    for (let j = 0; j < i; j++) {
      const cruce = Math.min(tramos[i].fin, tramos[j].fin) - tramos[i].ini;
      if (cruce > 0) total = Math.max(total, Math.round(cruce / 60000));
    }
  }
  return total;
}

const incluir = {
  local: { select: { nombre: true } },
  usuario: { select: { nombre: true } },
  ventas: {
    where: { estado: "COMPLETADA" as const },
    select: { total: true, medioPago: true },
  },
  movimientos: {
    orderBy: { creadoEn: "asc" as const },
    select: { id: true, tipo: true, monto: true, motivo: true, creadoEn: true },
  },
} satisfies Prisma.CajaSesionInclude;

/** Jornada de atención dibujada y medida. Fuera de esto no hay operación. */
export const JORNADA = { desde: 8, hasta: 21 };

/**
 * Turnos de un día, agrupados por local.
 *
 * `esGlobal` es explícito y no se infiere de que `localId` venga null: un usuario de local
 * sin local asignado dejaría el `where` sin filtro y vería los descuadres de toda la cadena.
 * El resto del sistema falla hacia el lado seguro y este no puede ser la excepción.
 */
export async function diasDeCaja(
  fecha: Date,
  alcance: { esGlobal: boolean; localId: string | null },
): Promise<DiaDeCaja[]> {
  if (!alcance.esGlobal && !alcance.localId) return [];

  const desde = inicioDia(fecha);
  const hasta = finDia(fecha);
  const p = partesSantiago(desde);
  const jornada = {
    desde: instanteSantiago(p.year, p.month, p.day, JORNADA.desde),
    // La jornada se corta en "ahora" si el día es hoy: no son huecos las horas que aún no pasan
    hasta: (() => {
      const cierre = instanteSantiago(p.year, p.month, p.day, JORNADA.hasta);
      const ahora = new Date();
      return ahora < cierre ? (ahora > desde ? ahora : desde) : cierre;
    })(),
  };

  const sesiones = await prisma.cajaSesion.findMany({
    where: {
      // Por solapamiento, no por hora de apertura: un turno que cruza la medianoche
      // pertenece a los dos días y no puede desaparecer del segundo.
      abiertaEn: { lt: hasta },
      OR: [{ cerradaEn: null }, { cerradaEn: { gte: desde } }],
      ...(alcance.localId ? { localId: alcance.localId } : {}),
    },
    include: incluir,
    orderBy: { abiertaEn: "asc" },
  });

  const porLocal = new Map<string, Turno[]>();
  for (const s of sesiones) {
    const t = aTurno(s, jornada.hasta);
    porLocal.set(t.localId, [...(porLocal.get(t.localId) ?? []), t]);
  }

  return [...porLocal.values()]
    .map((turnos) => {
      const solape = minutosDeSolape(turnos);
      return {
        localId: turnos[0].localId,
        localNombre: turnos[0].localNombre,
        turnos,
        huecos: calcularHuecos(turnos, jornada),
        solapeMin: solape >= SOLAPE_RELEVANTE_MIN ? solape : 0,
        ventasTotal: turnos.reduce((n, t) => n + t.ventas, 0),
        // Solo lo que debería estar hoy en los cajones abiertos: sumar los turnos ya
        // entregados contaría varias veces el fondo de cambio.
        esperadoTotal: turnos.filter((t) => t.abierta).reduce((n, t) => n + t.esperado, 0),
      };
    })
    .sort((a, b) => a.localNombre.localeCompare(b.localNombre));
}

export interface MiTurno {
  actual: Turno | null;
  cierres: Turno[];
  ventasHoy: number;
  boletasHoy: number;
  ventas30: number;
  boletas30: number;
  /** Promedio diario de las últimas 4 semanas, contando solo días con ventas */
  promedioDiario: number;
  /** Parte de la jornada ya transcurrida (0 a 1), para comparar peras con peras */
  fraccionDelDia: number;
  serie: { valores: number[]; etiquetas: string[] };
}

/**
 * Los datos del propio vendedor. Sin comparación con otras personas: la referencia es
 * su propio promedio. Un tablero que le muestra su puesto frente a sus compañeros empuja
 * a pelear clientes y a esquivar los turnos flojos.
 */
export async function miTurno(usuarioId: string): Promise<MiTurno> {
  const hoy = inicioDia();
  const rango = ultimosDias(30);
  const hace28 = sumarDias(hoy, -28);

  const [abierta, cierres, ventas30, agHoy, agMes] = await Promise.all([
    prisma.cajaSesion.findFirst({
      where: { usuarioId, estado: "ABIERTA" },
      include: incluir,
      orderBy: { abiertaEn: "desc" },
    }),
    prisma.cajaSesion.findMany({
      where: { usuarioId, estado: "CERRADA" },
      include: incluir,
      orderBy: { cerradaEn: "desc" },
      take: 10,
    }),
    prisma.venta.findMany({
      where: { usuarioId, estado: "COMPLETADA", creadoEn: { gte: rango[0].inicio } },
      select: { creadoEn: true, total: true },
    }),
    prisma.venta.aggregate({
      where: { usuarioId, estado: "COMPLETADA", creadoEn: { gte: hoy } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.aggregate({
      where: { usuarioId, estado: "COMPLETADA", creadoEn: { gte: sumarDias(hoy, -30) } },
      _sum: { total: true },
      _count: true,
    }),
  ]);

  const valores = rango.map((d) =>
    ventas30
      .filter((v) => v.creadoEn >= d.inicio && v.creadoEn < d.fin)
      .reduce((a, v) => a + v.total, 0),
  );

  // Promedio sobre los días en que efectivamente vendió: incluir los libres lo hundiría
  const ultimas4 = ventas30.filter((v) => v.creadoEn >= hace28);
  const porDia = new Map<string, number>();
  for (const v of ultimas4) {
    // Por día chileno: agrupar por UTC mandaría las ventas de la tarde al día siguiente
    // e inflaría la cantidad de días, hundiendo el promedio.
    const d = partesSantiago(v.creadoEn);
    porDia.set(`${d.year}-${d.month}-${d.day}`, (porDia.get(`${d.year}-${d.month}-${d.day}`) ?? 0) + v.total);
  }
  const dias = [...porDia.values()];
  const promedioDiario =
    dias.length > 0 ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0;

  // Comparar lo que lleva del día contra días completos daría siempre por debajo
  const ahoraP = partesSantiago();
  const transcurrido = ahoraP.hour + ahoraP.minute / 60 - JORNADA.desde;
  const fraccionDelDia = Math.max(
    0.05,
    Math.min(1, transcurrido / (JORNADA.hasta - JORNADA.desde)),
  );

  return {
    actual: abierta ? aTurno(abierta, new Date()) : null,
    cierres: cierres.map((c) => aTurno(c, new Date())),
    ventasHoy: agHoy._sum.total ?? 0,
    boletasHoy: agHoy._count,
    ventas30: agMes._sum.total ?? 0,
    boletas30: agMes._count,
    promedioDiario,
    fraccionDelDia,
    serie: { valores, etiquetas: rango.map((d) => d.etiqueta) },
  };
}
