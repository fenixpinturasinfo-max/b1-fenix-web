import Link from "next/link";
import { requireSeccion } from "@/lib/auth/guards";
import { miTurno } from "@/features/pos/queries";
import { esDescuadre, movLabel } from "@/features/pos/caja";
import { formatCLP } from "@/lib/format";
import { fmtFecha, fmtHora } from "@/lib/fechas";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelDash } from "@/components/ui/PanelDash";
import { Sparkline } from "@/components/ui/Sparkline";
import { IconCash, IconChart, IconReceipt, IconTrendingUp } from "@/components/ui/icons";

export default async function MiTurnoPage() {
  const session = await requireSeccion("reportes.mi-turno");
  const d = await miTurno(session.sub);

  // El día va corriendo: comparar lo que lleva contra días completos diría "22% de tu
  // día normal" todas las mañanas. Se prorratea el promedio por la jornada transcurrida.
  const pctDelNormal =
    d.promedioDiario > 0 && d.fraccionDelDia > 0
      ? Math.round((d.ventasHoy / (d.promedioDiario * d.fraccionDelDia)) * 100)
      : null;
  const ticketHoy = d.boletasHoy > 0 ? Math.round(d.ventasHoy / d.boletasHoy) : 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Mi turno</h1>
        <p className="mt-1 text-slate-500">
          Tus ventas y tus cierres de caja · {session.localNombre ?? "sin local asignado"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Mis ventas de hoy"
          valor={formatCLP(d.ventasHoy)}
          sub={`${d.boletasHoy} ${d.boletasHoy === 1 ? "boleta" : "boletas"}`}
          icon={<IconTrendingUp size={20} />}
        />
        <KpiCard
          label="Mi promedio"
          valor={d.promedioDiario > 0 ? formatCLP(d.promedioDiario) : "—"}
          sub="por día, últimas 4 semanas"
          icon={<IconChart size={20} />}
          nota="Cuenta solo los días en que vendiste: incluir los libres hundiría el promedio."
        />
        <KpiCard
          label="Ticket promedio"
          valor={ticketHoy > 0 ? formatCLP(ticketHoy) : "—"}
          sub={ticketHoy > 0 ? "por boleta, hoy" : "aún sin ventas hoy"}
          icon={<IconReceipt size={20} />}
        />
      </div>

      {/* La referencia es su propio promedio, nunca sus compañeros */}
      {pctDelNormal !== null && (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
          {d.ventasHoy === 0 ? (
            <span className="text-slate-500">Todavía no registras ventas hoy.</span>
          ) : (
            <span className="text-slate-600">
              Vas en{" "}
              <b className={pctDelNormal >= 100 ? "text-[#4d7c0f]" : "text-navy-950"}>
                {pctDelNormal}%
              </b>{" "}
              de tu ritmo normal para esta hora.
            </span>
          )}
        </p>
      )}

      {d.actual && (
        <PanelDash titulo="Caja abierta" icon={<IconCash size={18} />}>
          <div className="grid gap-3 sm:grid-cols-4">
            <Dato label="Desde" valor={fmtHora(d.actual.abiertaEn)} />
            <Dato label="Apertura" valor={formatCLP(d.actual.montoApertura)} />
            <Dato label="Ventas en efectivo" valor={formatCLP(d.actual.ventasEfectivo)} />
            <Dato
              label="Efectivo esperado"
              valor={formatCLP(d.actual.esperado)}
              destacado
            />
          </div>
          {d.actual.movimientos.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {d.actual.movimientos.map((m) => (
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
          <Link
            href="/dashboard/pos"
            className="mt-3 inline-block text-sm font-bold text-electric-600 hover:underline"
          >
            Ir al POS →
          </Link>
        </PanelDash>
      )}

      <PanelDash titulo="Mis ventas · últimos 30 días" icon={<IconChart size={18} />}>
        <Sparkline
          puntos={d.serie.valores}
          etiquetas={d.serie.etiquetas}
          titulo="Mis ventas de los últimos 30 días"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{d.serie.etiquetas[0]}</span>
          <span>{d.serie.etiquetas[d.serie.etiquetas.length - 1]}</span>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          En estos 30 días: <b className="text-navy-950">{formatCLP(d.ventas30)}</b> ·{" "}
          {d.boletas30} boletas
        </p>
      </PanelDash>

      <PanelDash titulo="Mis últimos cierres de caja" icon={<IconCash size={18} />}>
        {d.cierres.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Aún no tienes cierres registrados.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {d.cierres.map((c) => {
              const malo = esDescuadre(c.diferencia);
              return (
                <li key={c.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                  <span className="w-24 shrink-0 text-slate-500">
                    {c.cerradaEn ? fmtFecha(c.cerradaEn) : "—"}
                  </span>
                  <span className="text-slate-500">
                    {c.nVentas} boletas · esperado {formatCLP(c.esperado)}
                  </span>
                  <span className="ml-auto tabular-nums">
                    {c.diferencia === null ? (
                      <span className="text-slate-400">—</span>
                    ) : malo ? (
                      <span className="font-bold text-fenix-600">
                        {c.diferencia > 0 ? "Sobró " : "Faltó "}
                        {formatCLP(Math.abs(c.diferencia))}
                      </span>
                    ) : (
                      <span className="font-semibold text-[#4d7c0f]">Cuadrada</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
          Las diferencias chicas son normales: un vuelto mal dado o un billete pegado. Solo se
          marcan las que se salen del margen.
        </p>
      </PanelDash>
    </div>
  );
}

function Dato({
  label,
  valor,
  destacado,
}: {
  label: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p
        className={`tabular-nums ${destacado ? "text-lg font-black text-navy-950" : "font-semibold text-navy-950"}`}
      >
        {valor}
      </p>
    </div>
  );
}
