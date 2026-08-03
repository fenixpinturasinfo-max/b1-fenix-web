/**
 * Fechas en horario de Chile continental.
 *
 * El servidor de Vercel corre en UTC, así que `new Date().setHours(0,0,0,0)`
 * empieza "hoy" a las 20:00/21:00 hora de Chile del día anterior y las ventas
 * de la tarde se cuentan en el día equivocado. Todo cálculo de "hoy", "este mes"
 * o "últimos N días" debe pasar por acá.
 */

export const TZ = "America/Santiago";

interface PartesFecha {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const dtfPartes = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Descompone un instante en sus partes de calendario según la hora de Chile. */
export function partesSantiago(fecha: Date = new Date()): PartesFecha {
  const p = Object.fromEntries(
    dtfPartes.formatToParts(fecha).map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // "24" en hour12:false significa medianoche
    hour: Number(p.hour) % 24,
    minute: Number(p.minute),
    second: Number(p.second),
  };
}

/** Minutos de desfase de Chile respecto de UTC en ese instante (−240 o −180). */
function desfaseMin(fecha: Date): number {
  const p = partesSantiago(fecha);
  const comoUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // formatToParts no entrega milisegundos: truncamos el instante al segundo
  return (comoUtc - Math.floor(fecha.getTime() / 1000) * 1000) / 60000;
}

/** Instante UTC que corresponde a una hora de pared chilena. */
export function instanteSantiago(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  // Date.UTC normaliza desbordes (día 32 → mes siguiente, día 0 → mes anterior)
  const objetivo = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const candidato1 = new Date(objetivo.getTime() - desfaseMin(objetivo) * 60000);
  // Segunda pasada: resuelve el desfase con el huso ya correcto
  const candidato2 = new Date(objetivo.getTime() - desfaseMin(candidato1) * 60000);

  const coincide = (d: Date) => {
    const p = partesSantiago(d);
    return (
      p.year === objetivo.getUTCFullYear() &&
      p.month === objetivo.getUTCMonth() + 1 &&
      p.day === objetivo.getUTCDate() &&
      p.hour === objetivo.getUTCHours() &&
      p.minute === objetivo.getUTCMinutes()
    );
  };
  if (coincide(candidato2)) return candidato2;
  if (coincide(candidato1)) return candidato1;

  // Hora inexistente: el primer domingo de septiembre el reloj salta de 24:00 a 01:00,
  // así que la medianoche de ese día nunca ocurre. Devolvemos el primer instante que sí
  // existe (01:00), para que "inicio del día" no retroceda al sábado.
  return new Date(Math.max(candidato1.getTime(), candidato2.getTime()));
}

/** Medianoche chilena del día al que pertenece `ref`. */
export function inicioDia(ref: Date = new Date()): Date {
  const p = partesSantiago(ref);
  return instanteSantiago(p.year, p.month, p.day);
}

/**
 * Medianoche chilena del día siguiente (límite superior exclusivo).
 * Se calcula sobre el calendario, no sumando 24 h, para que los días de 23 y 25 horas
 * del cambio de horario midan lo que realmente duraron.
 */
export function finDia(ref: Date = new Date()): Date {
  const p = partesSantiago(ref);
  return instanteSantiago(p.year, p.month, p.day + 1);
}

/** Inicio del mes chileno al que pertenece `ref`. */
export function inicioMes(ref: Date = new Date()): Date {
  const p = partesSantiago(ref);
  return instanteSantiago(p.year, p.month, 1);
}

/** Inicio del mes anterior. */
export function inicioMesAnterior(ref: Date = new Date()): Date {
  const p = partesSantiago(ref);
  return p.month === 1
    ? instanteSantiago(p.year - 1, 12, 1)
    : instanteSantiago(p.year, p.month - 1, 1);
}

/**
 * Mismo día del mes anterior, a la misma hora del día.
 * Sirve para comparar "mes a la fecha" contra "mes anterior a la misma altura".
 */
export function mismoInstanteMesAnterior(ref: Date = new Date()): Date {
  const p = partesSantiago(ref);
  const mes = p.month === 1 ? 12 : p.month - 1;
  const anio = p.month === 1 ? p.year - 1 : p.year;
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return instanteSantiago(anio, mes, Math.min(p.day, diasDelMes), p.hour, p.minute, p.second);
}

export function sumarDias(fecha: Date, dias: number): Date {
  const p = partesSantiago(fecha);
  return instanteSantiago(p.year, p.month, p.day + dias, p.hour, p.minute, p.second);
}

/**
 * Rango del mismo día de la semana pasada, **recortado a la misma hora del día**.
 * Comparar las 3 horas que van del día de hoy contra las 24 h completas de la semana
 * pasada mostraría una caída falsa toda la mañana.
 */
export function mismoDiaSemanaPasada(ref: Date = new Date()): [Date, Date] {
  const p = partesSantiago(ref);
  return [
    instanteSantiago(p.year, p.month, p.day - 7),
    instanteSantiago(p.year, p.month, p.day - 7, p.hour, p.minute, p.second),
  ];
}

export interface DiaCalendario {
  /** Límite inferior inclusivo */
  inicio: Date;
  /** Límite superior exclusivo */
  fin: Date;
  /** dd/mm para tooltips */
  etiqueta: string;
}

/**
 * Los últimos `n` días chilenos, del más antiguo al más reciente (incluye hoy).
 * Los tramos son contiguos y sin solapes incluso en los cambios de horario.
 */
export function ultimosDias(n: number, ref: Date = new Date()): DiaCalendario[] {
  const p = partesSantiago(ref);
  const dias: DiaCalendario[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const inicio = instanteSantiago(p.year, p.month, p.day - i);
    const fin = instanteSantiago(p.year, p.month, p.day - i + 1);
    const pi = partesSantiago(inicio);
    dias.push({
      inicio,
      fin,
      etiqueta: `${String(pi.day).padStart(2, "0")}/${String(pi.month).padStart(2, "0")}`,
    });
  }
  return dias;
}

/** Hora chilena (0–23), para saludos y validaciones de turno. */
export function horaActual(ref: Date = new Date()): number {
  return partesSantiago(ref).hour;
}

/**
 * Días de calendario chilenos entre dos instantes, positivo si `hasta` es posterior.
 *
 * Se comparan medianoches, no se divide la diferencia bruta por 24 h: los dos días del
 * cambio de horario duran 23 y 25 horas, y el redondeo absorbe ese resto.
 */
export function diasEntre(desde: Date, hasta: Date = new Date()): number {
  const a = inicioDia(desde).getTime();
  const b = inicioDia(hasta).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ─────────────────────────────── Formatos ───────────────────────────────
// Usar `fmtFechaHora` / `fmtFecha` para campos de timestamp (creadoEn, cerradaEn…)
// y `fmtFechaSola` para campos de fecha pura (fechaRequerida, fechaEmision…), que el
// sistema guarda a MEDIODÍA UTC (ver features/purchases/actions.ts) justamente para que
// ningún huso las corra de día. Formatearlas en UTC evita el corrimiento.

const dtfFechaHora = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: TZ,
});
const dtfFecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: TZ });
const dtfFechaSola = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "UTC" });
const dtfHora = new Intl.DateTimeFormat("es-CL", { timeStyle: "short", timeZone: TZ });
const dtfDiaMes = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: TZ,
});

export const fmtFechaHora = (d: Date) => dtfFechaHora.format(d);
export const fmtFecha = (d: Date) => dtfFecha.format(d);
export const fmtFechaSola = (d: Date) => dtfFechaSola.format(d);
export const fmtHora = (d: Date) => dtfHora.format(d);
export const fmtDiaMes = (d: Date) => dtfDiaMes.format(d);
