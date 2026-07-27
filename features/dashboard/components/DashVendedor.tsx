import Link from "next/link";
import { formatCLP } from "@/lib/format";
import { fmtHora } from "@/lib/fechas";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelDash } from "@/components/ui/PanelDash";
import { Sparkline } from "@/components/ui/Sparkline";
import { IconCart, IconCash, IconChart, IconReceipt, IconTrendingUp } from "@/components/ui/icons";
import type { DatosVendedor } from "../queries";

/**
 * Dashboard del vendedor.
 * Zona primaria = su caja: tiene una sola decisión (abrir / vender / cerrar) y no
 * debe competir con los indicadores.
 */
export function DashVendedor({ datos }: { datos: DatosVendedor }) {
  const { caja, ventas, serie, pedidosPendientes } = datos;
  const ticketTurno =
    caja && caja.boletasTurno > 0 ? Math.round(caja.ventasTurno / caja.boletasTurno) : 0;

  return (
    <div className="space-y-5">
      {/* Z1 · Estado de caja */}
      {caja ? (
        <section className="rounded-2xl border border-lime-400/40 bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-[#4d7c0f]">
            <span className="flex h-2.5 w-2.5 rounded-full bg-lime-400" aria-hidden="true" />
            Caja abierta desde las {fmtHora(caja.abiertaEn)}
          </p>
          <p className="mt-2 text-3xl font-black tabular-nums text-navy-950">
            {formatCLP(caja.ventasTurno)}
          </p>
          <p className="text-sm text-slate-500">
            {caja.boletasTurno} {caja.boletasTurno === 1 ? "boleta" : "boletas"} en el turno
            {ticketTurno > 0 && <> · ticket {formatCLP(ticketTurno)}</>} · apertura{" "}
            {formatCLP(caja.montoApertura)}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard/pos"
              className="bg-flame flex h-14 flex-1 items-center justify-center rounded-xl px-6 text-base font-black text-white transition hover:opacity-90 sm:flex-none"
            >
              IR AL POS
            </Link>
            <Link
              href="/dashboard/pos?accion=cerrar"
              className="flex h-14 items-center justify-center rounded-xl border border-slate-300 px-6 text-sm font-bold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
            >
              Cerrar caja
            </Link>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-bold text-slate-500">
            <span className="flex h-2.5 w-2.5 rounded-full bg-slate-300" aria-hidden="true" />
            No tienes caja abierta
          </p>
          <p className="mt-1 text-sm text-slate-500">Abre tu caja para empezar a vender.</p>
          <Link
            href="/dashboard/pos"
            className="bg-flame mt-4 flex h-14 w-full items-center justify-center rounded-xl px-6 text-base font-black text-white transition hover:opacity-90 sm:w-auto sm:px-10"
          >
            ABRIR CAJA
          </Link>
        </section>
      )}

      {/* Z3 · KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Mis ventas de hoy"
          valor={formatCLP(ventas.hoyTotal)}
          sub={`${ventas.hoyN} ${ventas.hoyN === 1 ? "boleta" : "boletas"}`}
          delta={
            ventas.deltaDia === null
              ? undefined
              : { pct: ventas.deltaDia, contra: "mismo día semana pasada" }
          }
          icon={<IconTrendingUp size={20} />}
        />
        <KpiCard
          label="Ticket promedio"
          valor={ventas.ticketHoy > 0 ? formatCLP(ventas.ticketHoy) : "—"}
          sub={ventas.ticketHoy > 0 ? "por boleta, hoy" : "aún sin ventas hoy"}
          icon={<IconReceipt size={20} />}
        />
        <KpiCard
          label="Mi mes"
          valor={formatCLP(ventas.mesTotal)}
          sub={`${ventas.mesN} boletas`}
          delta={
            ventas.deltaMes === null
              ? undefined
              : { pct: ventas.deltaMes, contra: "mes anterior a la fecha" }
          }
          icon={<IconCash size={20} />}
        />
      </div>

      {/* Z2 · Pendiente (franja simple: el vendedor solo tiene uno) */}
      {pedidosPendientes > 0 && (
        <Link
          href="/dashboard/ventas/pedidos?estado=PENDIENTE"
          className="flex items-center gap-3 rounded-2xl border border-[#f59e0b]/40 bg-white px-4 py-3 text-sm transition hover:shadow-card"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f59e0b]/15 text-[#b45309]">
            <IconCart size={18} />
          </span>
          <span className="font-bold text-navy-950">
            {pedidosPendientes} {pedidosPendientes === 1 ? "pedido" : "pedidos"} por preparar en tu
            local
          </span>
          <span className="ml-auto text-xs font-bold text-electric-600">Ver →</span>
        </Link>
      )}

      {/* Z4 · Tendencia */}
      <PanelDash titulo="Mis ventas · últimos 14 días" icon={<IconChart size={18} />}>
        <Sparkline
          puntos={serie.valores}
          etiquetas={serie.etiquetas}
          titulo="Mis ventas de los últimos 14 días"
        />
        <div className="mt-1 flex justify-between text-[11px] text-slate-400">
          <span>{serie.etiquetas[0]}</span>
          <span>{serie.etiquetas[serie.etiquetas.length - 1]}</span>
        </div>
      </PanelDash>
    </div>
  );
}
