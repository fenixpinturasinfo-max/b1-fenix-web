import Link from "next/link";
import { formatCLP } from "@/lib/format";
import { KpiCard } from "@/components/ui/KpiCard";
import { PanelDash } from "@/components/ui/PanelDash";
import { Sparkline } from "@/components/ui/Sparkline";
import { BarrasComparativas } from "@/components/ui/BarrasComparativas";
import { BandejaPendientes, type Pendiente } from "@/components/ui/TarjetaPendiente";
import {
  IconAlert,
  IconCart,
  IconCash,
  IconChart,
  IconCheck,
  IconClock,
  IconFile,
  IconPackageX,
  IconReceipt,
  IconStore,
  IconTrendingUp,
  IconTruck,
} from "@/components/ui/icons";
import type { DatosGerencia } from "../queries";

/** Dashboard consolidado de gerencia y administración. */
export function DashGerencia({ datos }: { datos: DatosGerencia }) {
  const {
    ventas,
    margen,
    serie,
    productosEnQuiebre,
    compras,
    cajas,
    pedidosPendientes,
    solicitudesPorResolver,
    porPagar,
    locales,
    salud,
  } = datos;

  const pendientes: Pendiente[] = [
    {
      n: porPagar.vencidas,
      titulo: "Facturas vencidas",
      descripcion: `${formatCLP(porPagar.montoVencido)} pasados de plazo con proveedores`,
      href: "/dashboard/compras/facturas?estado=VENCIDA",
      cta: "Ver facturas",
      tono: "critico",
      icon: <IconFile size={18} />,
    },
    {
      n: cajas.sinCerrarAntiguas,
      titulo: "Cajas sin cerrar",
      descripcion: "Quedaron abiertas de un día anterior",
      href: "/dashboard/reportes",
      cta: "Revisar",
      tono: "critico",
      icon: <IconCash size={18} />,
    },
    {
      n: porPagar.porVencer,
      titulo: "Vencen en 7 días",
      descripcion: "Conviene programar el pago esta semana",
      href: "/dashboard/compras/facturas?estado=POR_PAGAR",
      cta: "Ver vencimientos",
      tono: "atencion",
      icon: <IconClock size={18} />,
    },
    {
      n: compras.atrasadas,
      titulo: "OC atrasadas",
      descripcion: "Pasaron la fecha en que se necesitaban, sin recepción",
      href: "/dashboard/compras?estado=ABIERTAS",
      cta: "Ver órdenes",
      tono: "atencion",
      icon: <IconTruck size={18} />,
    },
    {
      n: productosEnQuiebre,
      titulo: "Productos agotados",
      descripcion: "Sin stock en ninguna sucursal: hay que comprar, no transferir",
      href: "/dashboard/inventario?estado=SIN",
      cta: "Ver inventario",
      tono: "atencion",
      icon: <IconPackageX size={18} />,
    },
    {
      n: solicitudesPorResolver,
      titulo: "Solicitudes",
      descripcion: "Reposiciones esperando cotización",
      href: "/dashboard/solicitudes?estado=PENDIENTE",
      cta: "Resolver",
      tono: "info",
      icon: <IconAlert size={18} />,
    },
    {
      n: pedidosPendientes,
      titulo: "Pedidos por preparar",
      descripcion: "Clientes esperando que se arme su pedido",
      href: "/dashboard/ventas/pedidos?estado=PENDIENTE",
      cta: "Ver pedidos",
      tono: "info",
      icon: <IconCart size={18} />,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Z3 · KPIs (zona primaria para gerencia) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Ventas de hoy"
          valor={formatCLP(ventas.hoyTotal)}
          sub={`${ventas.hoyN} boletas · todos los locales`}
          delta={
            ventas.deltaDia === null
              ? undefined
              : { pct: ventas.deltaDia, contra: "mismo día semana pasada" }
          }
          icon={<IconTrendingUp size={20} />}
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
          sub={`ticket promedio ${ventas.ticketHoy > 0 ? formatCLP(ventas.ticketHoy) : "—"}`}
          icon={<IconReceipt size={20} />}
          nota="Con el costo congelado en cada venta. Las ventas anteriores a julio 2026 usan el costo actual del producto."
        />
        <KpiCard
          label="Cuentas por pagar"
          valor={formatCLP(porPagar.total)}
          sub={porPagar.vencidas > 0 ? `${porPagar.vencidas} vencidas` : "ninguna vencida"}
          tono={porPagar.vencidas > 0 ? "critico" : "ok"}
          icon={<IconFile size={20} />}
          href="/dashboard/compras/facturas?estado=POR_PAGAR"
          nota="Facturas abiertas menos las notas de crédito emitidas contra ellas."
        />
      </div>

      <BandejaPendientes
        items={pendientes}
        titulo="Requiere atención"
        vacio="Todo al día · sin vencimientos, atrasos ni quiebres"
      />

      {/* Z4 · Comparación y tendencia */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PanelDash titulo="Ventas de hoy por local" icon={<IconStore size={18} />}>
          {locales.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">No hay locales activos.</p>
          ) : (
            <BarrasComparativas
              items={locales.map((l) => ({
                id: l.id,
                label: l.nombre,
                valor: l.ventasHoy,
                detalle: `${formatCLP(l.ventasHoy)} · ${l.ventasN} ventas`,
              }))}
            />
          )}
        </PanelDash>

        <PanelDash titulo="Consolidado · últimos 14 días" icon={<IconChart size={18} />}>
          <Sparkline
            puntos={serie.valores}
            etiquetas={serie.etiquetas}
            titulo="Ventas consolidadas de los últimos 14 días"
          />
          <div className="mt-1 flex justify-between text-[11px] text-slate-400">
            <span>{serie.etiquetas[0]}</span>
            <span>{serie.etiquetas[serie.etiquetas.length - 1]}</span>
          </div>
        </PanelDash>
      </div>

      {/* Semáforo operativo */}
      <PanelDash titulo="Semáforo operativo" icon={<IconStore size={18} />}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2 pr-3">Local</th>
                <th className="py-2 pr-3 text-right">Ventas hoy</th>
                <th className="py-2 pr-3 text-center">Quiebres</th>
                <th className="py-2 pr-3 text-center">Cajas</th>
                <th className="py-2 text-center">OC por recibir</th>
              </tr>
            </thead>
            <tbody>
              {locales.map((l) => (
                <tr key={l.id} className="border-t border-slate-100">
                  <td className="py-2 pr-3 font-semibold text-navy-950">{l.nombre}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-600">
                    {formatCLP(l.ventasHoy)}
                  </td>
                  <td className="py-2 pr-3 text-center">
                    <Semaforo
                      n={l.quiebres}
                      bueno={l.quiebres === 0}
                      etiquetaCero="sin quiebres"
                      etiqueta={`${l.quiebres} sin stock`}
                    />
                  </td>
                  <td className="py-2 pr-3 text-center tabular-nums text-slate-600">
                    {l.cajasAbiertas > 0 ? `${l.cajasAbiertas} abierta(s)` : "—"}
                  </td>
                  <td className="py-2 text-center tabular-nums text-slate-600">
                    {l.ocPorRecibir > 0 ? l.ocPorRecibir : "—"}
                  </td>
                </tr>
              ))}
              {locales.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    No hay locales activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PanelDash>

      {/* Salud del maestro (solo administrador) */}
      {salud && <PanelSalud salud={salud} />}
    </div>
  );
}

/** Semáforo con ícono + texto: el color nunca es la única señal. */
function Semaforo({
  n,
  bueno,
  etiqueta,
  etiquetaCero,
}: {
  n: number;
  bueno: boolean;
  etiqueta: string;
  etiquetaCero: string;
}) {
  return (
    <span
      title={bueno ? etiquetaCero : etiqueta}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
        bueno ? "bg-lime-400/15 text-[#4d7c0f]" : "bg-fenix-600/10 text-fenix-600"
      }`}
    >
      <span aria-hidden="true">{bueno ? "✓" : "!"}</span>
      {bueno ? "0" : n}
    </span>
  );
}

function PanelSalud({ salud }: { salud: NonNullable<DatosGerencia["salud"]> }) {
  const alertas: { texto: string; href: string }[] = [];
  if (salud.productosSinCosto > 0)
    alertas.push({
      texto: `${salud.productosSinCosto} productos activos sin precio de costo · distorsionan el margen`,
      href: "/dashboard/precios",
    });
  if (salud.sociosSinEmail > 0)
    alertas.push({
      texto: `${salud.sociosSinEmail} proveedores sin correo · no se les puede pedir cotización`,
      href: "/dashboard/socios?tipo=PROVEEDOR",
    });
  if (salud.sinMatriz)
    alertas.push({
      texto: "Ningún local marcado como casa matriz · las solicitudes no tienen destino",
      href: "/dashboard/configuracion/locales",
    });

  return (
    <PanelDash titulo="Salud del sistema" icon={<IconCheck size={18} />}>
      {alertas.length === 0 ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-[#4d7c0f]">
          <span aria-hidden="true">✓</span>
          Datos maestros completos
        </p>
      ) : (
        <ul className="space-y-2">
          {alertas.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="flex items-start gap-2 text-sm text-slate-600 transition hover:text-electric-600"
              >
                <span className="mt-0.5 shrink-0 text-[#b45309]" aria-hidden="true">
                  <IconAlert size={16} />
                </span>
                {a.texto}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
        {salud.usuariosActivos} usuarios activos · {salud.locales} locales
      </p>
    </PanelDash>
  );
}
