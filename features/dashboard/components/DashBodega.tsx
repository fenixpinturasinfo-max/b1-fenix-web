import { formatCLP } from "@/lib/format";
import { fmtHora } from "@/lib/fechas";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelDash } from "@/components/ui/PanelDash";
import { BandejaPendientes, type Pendiente } from "@/components/ui/TarjetaPendiente";
import {
  IconAlert,
  IconBox,
  IconFile,
  IconPackageX,
  IconTruck,
} from "@/components/ui/icons";
import type { DatosBodega } from "../queries";

const tipoLabel: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA_VENTA: "Venta",
  AJUSTE: "Ajuste",
  MERMA: "Merma",
  TRANSFERENCIA_SALIDA: "Transf. salida",
  TRANSFERENCIA_ENTRADA: "Transf. entrada",
};

/**
 * Dashboard de bodega.
 * Zona primaria = pendientes: el bodeguero trabaja por excepción, no por resumen.
 */
export function DashBodega({ datos }: { datos: DatosBodega }) {
  const { stock, compras, solicitudesAbiertas, movimientosHoy, ultimosMovimientos } = datos;

  const pendientes: Pendiente[] = [
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
      n: compras.porRecibir,
      titulo: "OC por recibir",
      descripcion:
        compras.atrasadas > 0
          ? `${compras.atrasadas} pasó la fecha en que la necesitabas`
          : "Mercadería en camino desde el proveedor",
      href: "/dashboard/compras?estado=ABIERTAS",
      cta: "Registrar recepción",
      tono: compras.atrasadas > 0 ? "atencion" : "info",
      icon: <IconTruck size={18} />,
    },
    {
      n: solicitudesAbiertas,
      titulo: "Solicitudes del local",
      descripcion: "Reposiciones pedidas y aún sin resolver",
      href: "/dashboard/solicitudes?estado=PENDIENTE",
      cta: "Ver estado",
      tono: "info",
      icon: <IconFile size={18} />,
    },
  ];

  return (
    <div className="space-y-5">
      <BandejaPendientes
        items={pendientes}
        vacio="Todo al día · sin quiebres ni recepciones pendientes"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="Valor del inventario"
          valor={formatCLP(stock.valor)}
          sub="a precio de costo"
          icon={<IconBox size={20} />}
          href="/dashboard/inventario"
        />
        <KpiCard
          label="SKUs con stock"
          valor={String(stock.conStock)}
          sub={`de ${stock.total} fichas de stock en tu local`}
          tono={stock.quiebres > 0 ? "atencion" : "ok"}
          icon={<IconPackageX size={20} />}
        />
        <KpiCard
          label="Movimientos de hoy"
          valor={String(movimientosHoy)}
          sub="entradas, ajustes y transferencias"
          icon={<IconTruck size={20} />}
          href="/dashboard/inventario/movimientos"
          nota="No incluye las salidas automáticas por venta del POS."
        />
      </div>

      <PanelDash
        titulo="Últimos movimientos"
        icon={<IconBox size={18} />}
        accion={{ href: "/dashboard/inventario/movimientos", label: "Ver todos" }}
      >
        {ultimosMovimientos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">
            Aún no hay movimientos registrados en tu local.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ultimosMovimientos.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="w-14 shrink-0 tabular-nums text-slate-400">
                  {fmtHora(m.creadoEn)}
                </span>
                <span className="w-28 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {tipoLabel[m.tipo] ?? m.tipo}
                </span>
                <span className="min-w-0 flex-1 truncate text-navy-950">{m.producto}</span>
                <span
                  className={`shrink-0 font-bold tabular-nums ${
                    m.cantidad >= 0 ? "text-[#4d7c0f]" : "text-fenix-600"
                  }`}
                >
                  {m.cantidad > 0 ? "+" : ""}
                  {m.cantidad}
                </span>
                <span className="hidden w-20 shrink-0 truncate text-right text-xs text-slate-400 sm:block">
                  {m.usuario}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelDash>
    </div>
  );
}
