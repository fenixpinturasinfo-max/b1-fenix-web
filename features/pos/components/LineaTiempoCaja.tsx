import { formatCLP } from "@/lib/format";
import { fmtHora, partesSantiago } from "@/lib/fechas";
import { esDescuadre, movLabel, TOLERANCIA_DESCUADRE } from "../caja";
import { JORNADA, type DiaDeCaja, type Turno } from "../queries";

// Misma ventana con que se miden los huecos: dibujar una y medir otra sería mentir.
const HORA_INI = JORNADA.desde;
const VENTANA = JORNADA.hasta - JORNADA.desde;

/**
 * Posición horizontal de un instante, en porcentaje de la ventana de operación.
 *
 * Usa la hora de pared chilena, no `setHours`: esto es un Server Component y en Vercel
 * el proceso corre en UTC, así que `setHours(8)` serían las 04:00 en Chile y todo el
 * gráfico quedaría corrido cuatro horas. Es el mismo bug que lib/fechas existe para evitar.
 */
function pos(fecha: Date): number {
  const p = partesSantiago(fecha);
  const horas = p.hour + p.minute / 60 - HORA_INI;
  return Math.max(0, Math.min(100, (horas / VENTANA) * 100));
}

/**
 * Los turnos del día como bloques en el tiempo.
 *
 * Una tabla de cierres dice cuánto descuadró cada turno. Esto muestra además lo que la
 * tabla esconde: los tramos en que nadie tuvo caja abierta y los solapes entre personas.
 */
export function LineaTiempoCaja({ dia }: { dia: DiaDeCaja }) {
  const descuadres = dia.turnos.filter((t) => esDescuadre(t.diferencia));
  const totalDescuadre = descuadres.reduce((n, t) => n + Math.abs(t.diferencia ?? 0), 0);
  const minutosSinCaja = dia.huecos.reduce((n, h) => n + h.minutos, 0);

  // Una fila por persona: si alguien abrió y cerró dos veces, van en la misma línea
  const personas = [...new Set(dia.turnos.map((t) => t.usuarioNombre))];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-base font-bold text-navy-950">{dia.localNombre}</h2>
        <span className="text-sm text-slate-500">
          {dia.turnos.length} {dia.turnos.length === 1 ? "turno" : "turnos"}
        </span>
        {dia.esperadoTotal > 0 && (
          <span className="ml-auto text-sm text-slate-500">
            En cajas abiertas ahora{" "}
            <b className="tabular-nums text-navy-950">{formatCLP(dia.esperadoTotal)}</b>
          </span>
        )}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Diferencia del día"
          valor={totalDescuadre === 0 ? "Cuadrado" : formatCLP(totalDescuadre)}
          sub={
            totalDescuadre === 0
              ? `nada sobre ${formatCLP(TOLERANCIA_DESCUADRE)}`
              : `en ${descuadres.length} de ${dia.turnos.length} turnos`
          }
          tono={totalDescuadre === 0 ? "ok" : "malo"}
        />
        <Kpi
          label="Sin caja abierta"
          valor={minutosSinCaja === 0 ? "Sin huecos" : `${minutosSinCaja} min`}
          sub={
            minutosSinCaja === 0
              ? "cobertura completa"
              : dia.huecos.map((h) => `${fmtHora(h.desde)} a ${fmtHora(h.hasta)}`).join(" · ")
          }
          tono={minutosSinCaja === 0 ? "ok" : "atencion"}
        />
        <Kpi
          label="Ventas del día"
          valor={formatCLP(dia.ventasTotal)}
          sub={`${dia.turnos.reduce((n, t) => n + t.nVentas, 0)} boletas`}
          tono="neutro"
        />
      </div>

      {/* Eje y pistas comparten el mismo track, para que un instante caiga en el mismo píxel */}
      <div className="rounded-xl bg-cloud p-2">
        <div className="flex items-end gap-2">
          <span className="w-24 shrink-0" aria-hidden="true" />
          <div className="relative h-4 flex-1">
            {[8, 11, 14, 17, 20].map((h) => (
              <span
                key={h}
                className="absolute -translate-x-1/2 text-[11px] text-slate-400"
                style={{ left: `${((h - HORA_INI) / VENTANA) * 100}%` }}
              >
                {String(h).padStart(2, "0")}:00
              </span>
            ))}
          </div>
        </div>

        {personas.map((persona) => (
          <div key={persona} className="flex items-center gap-2 py-1">
            <span className="w-24 shrink-0 truncate text-xs text-slate-500">{persona}</span>
            <div className="relative h-7 flex-1">
              {/* Huecos detrás de los bloques, en el mismo track */}
              {dia.huecos.map((h) => (
                <div
                  key={h.desde.toISOString()}
                  aria-hidden="true"
                  className="absolute inset-y-0 rounded bg-[#f59e0b]/20"
                  style={{
                    left: `${pos(h.desde)}%`,
                    width: `${Math.max(0.5, pos(h.hasta) - pos(h.desde))}%`,
                  }}
                />
              ))}
              {dia.turnos
                .filter((t) => t.usuarioNombre === persona)
                .map((t) => (
                  <BloqueTurno key={t.id} turno={t} />
                ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <Chip color="bg-lime-400/25 border-lime-400/50" texto="Turno cuadrado" />
        <Chip color="bg-fenix-600/15 border-fenix-600/40" texto="Con diferencia" />
        <Chip color="bg-[#f59e0b]/20 border-[#f59e0b]/40" texto="Sin caja abierta" />
        <Chip color="bg-electric-50 border-electric-500/40" texto="Abierta ahora" />
        {dia.solapeMin > 0 && (
          <span className="ml-auto font-semibold text-[#b45309]">
            {Math.round(dia.solapeMin / 60) >= 1
              ? `${Math.round(dia.solapeMin / 60)} h`
              : `${dia.solapeMin} min`}{" "}
            con dos cajas abiertas a la vez: si comparten cajón, ambos arqueos quedan mal
          </span>
        )}
      </div>

      {/* Detalle por turno */}
      <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
        {dia.turnos.map((t) => (
          <DetalleTurno key={t.id} turno={t} />
        ))}
      </ul>
    </section>
  );
}

function BloqueTurno({ turno }: { turno: Turno }) {
  const fin = turno.finEfectivo;
  const izq = pos(turno.abiertaEn);
  const ancho = Math.max(2, pos(fin) - izq);
  const malo = esDescuadre(turno.diferencia);

  const clase = turno.abierta
    ? "bg-electric-50 border-electric-500/40 text-electric-600"
    : malo
      ? "bg-fenix-600/15 border-fenix-600/40 text-fenix-600"
      : "bg-lime-400/25 border-lime-400/50 text-[#4d7c0f]";

  return (
    <div
      title={`${turno.usuarioNombre} · ${fmtHora(turno.abiertaEn)} a ${
        turno.cerradaEn ? fmtHora(turno.cerradaEn) : "ahora"
      }`}
      className={`absolute inset-y-0 flex items-center overflow-hidden whitespace-nowrap rounded border px-2 text-[11px] font-semibold ${clase}`}
      style={{ left: `${izq}%`, width: `${ancho}%` }}
    >
      {fmtHora(turno.abiertaEn)}–{turno.cerradaEn ? fmtHora(turno.cerradaEn) : "ahora"}
      {turno.diferencia !== null && !malo && " · cuadrada"}
      {malo && ` · ${turno.diferencia! > 0 ? "+" : "−"}${formatCLP(Math.abs(turno.diferencia!))}`}
    </div>
  );
}

function DetalleTurno({ turno }: { turno: Turno }) {
  const malo = esDescuadre(turno.diferencia);
  return (
    <li className="py-2.5 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-bold text-navy-950">{turno.usuarioNombre}</span>
        <span className="text-xs text-slate-400">
          {fmtHora(turno.abiertaEn)} – {turno.cerradaEn ? fmtHora(turno.cerradaEn) : "en curso"}
        </span>
        <span className="text-slate-500">
          {turno.nVentas} boletas · {formatCLP(turno.ventas)}
        </span>
        <span className="ml-auto tabular-nums">
          {turno.montoCierre === null ? (
            <span className="text-electric-600">Sin cerrar</span>
          ) : malo ? (
            <span className="font-bold text-fenix-600">
              {turno.diferencia! > 0 ? "Sobra " : "Falta "}
              {formatCLP(Math.abs(turno.diferencia!))}
            </span>
          ) : (
            <span className="font-semibold text-[#4d7c0f]">Cuadrada</span>
          )}
        </span>
      </div>

      {turno.movimientos.length > 0 && (
        <ul className="mt-1 space-y-0.5 pl-1 text-xs text-slate-500">
          {turno.movimientos.map((m) => (
            <li key={m.id}>
              {fmtHora(m.creadoEn)} · {movLabel[m.tipo] ?? m.tipo}{" "}
              <span className={m.tipo === "INGRESO" ? "text-[#4d7c0f]" : "text-fenix-600"}>
                {m.tipo === "INGRESO" ? "+" : "−"}
                {formatCLP(m.monto)}
              </span>{" "}
              · {m.motivo}
            </li>
          ))}
        </ul>
      )}

      {turno.notaCierre && (
        <p className="mt-1 text-xs italic text-slate-400">“{turno.notaCierre}”</p>
      )}
    </li>
  );
}

function Kpi({
  label,
  valor,
  sub,
  tono,
}: {
  label: string;
  valor: string;
  sub: string;
  tono: "ok" | "atencion" | "malo" | "neutro";
}) {
  const color =
    tono === "ok"
      ? "text-[#4d7c0f]"
      : tono === "atencion"
        ? "text-[#b45309]"
        : tono === "malo"
          ? "text-fenix-600"
          : "text-navy-950";
  return (
    <div className="rounded-xl bg-cloud px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-black tabular-nums ${color}`}>{valor}</p>
      <p className="truncate text-[11px] text-slate-400">{sub}</p>
    </div>
  );
}

function Chip({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm border ${color}`} aria-hidden="true" />
      {texto}
    </span>
  );
}
