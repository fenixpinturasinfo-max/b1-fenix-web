import { formatCLP } from "@/lib/format";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelDash } from "@/components/ui/PanelDash";
import { Sparkline } from "@/components/ui/Sparkline";
import { BandejaPendientes, type Pendiente } from "@/components/ui/TarjetaPendiente";
import {
  IconAlert,
  IconCart,
  IconCash,
  IconChart,
  IconFile,
  IconPackageX,
  IconReceipt,
  IconTrendingUp,
  IconTruck,
} from "@/components/ui/icons";
import type { DatosJefeLocal } from "../queries";

/** Dashboard del encargado de local: cierre del día, excepciones y resultado de su sucursal. */
export function DashJefeLocal({ datos }: { datos: DatosJefeLocal }) {
  const {
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
  } = datos;

  const pendientes: Pendiente[] = [
    {
      n: cajas.sinCerrarAntiguas,
      titulo: "Cajas sin cerrar",
      descripcion: "Quedaron abiertas de un día anterior",
      href: "/dashboard/pos",
      cta: "Revisar caja",
      tono: "critico",
      icon: <IconCash size={18} />,
    },
    {
      n: stock.quiebres,
      titulo: "Sin stock",
      descripcion: "Se están perdiendo ventas ahora mismo",
      href: "/dashboard/inventario?estado=SIN",
      cta: "Ver productos",
      tono: "critico",
      icon: <IconPackageX size={18} />,
    },
    {
      n: stock.bajos,
      titulo: "Bajo el mínimo",
      descripcion: "Conviene reponer esta semana",
      href: "/dashboard/inventario?estado=BAJO",
      cta: "Solicitar reposición",
      tono: "atencion",
      icon: <IconAlert size={18} />,
    },
    {
      n: pedidosPendientes,
      titulo: "Pedidos por preparar",
      descripcion: "Clientes esperando que se arme su pedido",
      href: "/dashboard/ventas/pedidos?estado=PENDIENTE",
      cta: "Ver pedidos",
      tono: "atencion",
      icon: <IconCart size={18} />,
    },
    {
      n: compras.porRecibir,
      titulo: "OC por recibir",
      descripcion:
        compras.atrasadas > 0
          ? `${compras.atrasadas} pasó la fecha en que la necesitabas`
          : "Mercadería en camino",
      href: "/dashboard/compras?estado=ABIERTAS",
      cta: "Registrar recepción",
      tono: compras.atrasadas > 0 ? "atencion" : "info",
      icon: <IconTruck size={18} />,
    },
    {
      n: solicitudes,
      titulo: resuelveSolicitudes ? "Solicitudes por resolver" : "Solicitudes del local",
      descripcion: resuelveSolicitudes
        ? "Reposiciones de todos los locales esperando tu resolución"
        : "Pedidas a la matriz y aún sin resolver",
      href: "/dashboard/solicitudes?estado=PENDIENTE",
      cta: resuelveSolicitudes ? "Resolver" : "Ver estado",
      tono: "info",
      icon: <IconFile size={18} />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Z1 · Cajas del local */}
      <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <span className="flex items-center gap-2 font-bold text-navy-950">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${cajas.abiertas > 0 ? "bg-lime-400" : "bg-slate-300"}`}
            aria-hidden="true"
          />
          {cajas.abiertas} {cajas.abiertas === 1 ? "caja abierta" : "cajas abiertas"}
        </span>
        <span className="text-slate-500">{cajas.cerradasHoy} cerradas hoy</span>
        <span
          className={`font-semibold tabular-nums ${
            cajas.descuadradasHoy === 0 ? "text-slate-500" : "text-fenix-600"
          }`}
        >
          {cajas.descuadradasHoy === 0
            ? "sin descuadres"
            : `${cajas.descuadradasHoy} descuadradas · ${formatCLP(cajas.descuadreHoy)}`}
        </span>
      </section>

      <BandejaPendientes items={pendientes} vacio="Todo al día · tu local está en orden" />

      {/* Z3 · KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas de hoy"
          valor={formatCLP(ventas.hoyTotal)}
          sub={`${ventas.hoyN} boletas`}
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
          label="Ventas del mes"
          valor={formatCLP(ventas.mesTotal)}
          sub={`${ventas.mesN} boletas`}
          delta={
            ventas.deltaMes === null
              ? undefined
              : { pct: ventas.deltaMes, contra: "mes anterior a la fecha" }
          }
          icon={<IconCash size={20} />}
        />
        <KpiCard
          label="Margen del mes"
          valor={margen === null ? "—" : `${margen.toFixed(1)}%`}
          sub="sobre ventas del mes"
          icon={<IconChart size={20} />}
          nota="Calculado con el costo congelado en cada venta. Las ventas anteriores a julio 2026 usan el costo actual del producto."
        />
      </div>

      {/* Z4 · Tendencia y top */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelDash titulo="Ventas · últimos 14 días" icon={<IconChart size={18} />}>
          <Sparkline
            puntos={serie.valores}
            etiquetas={serie.etiquetas}
            titulo="Ventas del local en los últimos 14 días"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{serie.etiquetas[0]}</span>
            <span>{serie.etiquetas[serie.etiquetas.length - 1]}</span>
          </div>
        </PanelDash>

        <PanelDash
          titulo="Top 5 del mes"
          icon={<IconTrendingUp size={18} />}
          accion={{ href: "/dashboard/reportes", label: "Reportes" }}
        >
          {top.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Sin ventas registradas este mes.
            </p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {top.map((p, i) => (
                <li key={p.id} className="flex items-baseline gap-3 py-2 text-sm">
                  <span className="w-4 shrink-0 font-black text-slate-300">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-navy-950">{p.nombre}</span>
                    <span className="text-xs text-slate-400">
                      {p.marca} · {p.unidades} u.
                    </span>
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-navy-950">
                    {formatCLP(p.total)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </PanelDash>
      </div>
    </div>
  );
}
