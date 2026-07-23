import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { modulosDe, type Modulo } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import {
  IconAlert,
  IconBox,
  IconCash,
  IconChart,
  IconReceipt,
  IconStore,
  IconTag,
  IconTrendingUp,
  IconUsers,
} from "@/components/ui/icons";

const moduloCards: Record<
  Modulo,
  { href: string; icon: React.ReactNode; title: string; desc: string }
> = {
  pos: {
    href: "/dashboard/pos",
    icon: <IconReceipt size={22} />,
    title: "POS / Ventas",
    desc: "Registrar ventas y hacer arqueo de caja",
  },
  inventario: {
    href: "/dashboard/inventario",
    icon: <IconBox size={22} />,
    title: "Inventario",
    desc: "Stock, mínimos/máximos, ubicaciones y movimientos",
  },
  precios: {
    href: "/dashboard/precios",
    icon: <IconTag size={22} />,
    title: "Precios",
    desc: "Lista de precios unificada, márgenes y ofertas",
  },
  locales: {
    href: "/dashboard/locales",
    icon: <IconStore size={22} />,
    title: "Locales",
    desc: "Crear y administrar sucursales",
  },
  reportes: {
    href: "/dashboard/reportes",
    icon: <IconChart size={22} />,
    title: "Reportes",
    desc: "Ventas por local, top productos y descuadres",
  },
  usuarios: {
    href: "/dashboard/usuarios",
    icon: <IconUsers size={22} />,
    title: "Usuarios",
    desc: "Cuentas, roles y locales del equipo",
  },
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const esAdmin = session.rol === "ADMINISTRADOR";
  const whereLocal = esAdmin ? {} : { localId: session.localId! };

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [ventasHoy, ventasPorLocal, locales, stocks, cajasAbiertas] = await Promise.all([
    prisma.venta.aggregate({
      where: { ...whereLocal, estado: "COMPLETADA", creadoEn: { gte: hoy } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.groupBy({
      by: ["localId"],
      where: { estado: "COMPLETADA", creadoEn: { gte: hoy } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.stockLocal.findMany({
      where: esAdmin ? {} : { localId: session.localId! },
      select: { cantidad: true, stockMin: true },
    }),
    prisma.cajaSesion.count({ where: { ...whereLocal, estado: "ABIERTA" } }),
  ]);

  const bajoMinimo = stocks.filter((s) => s.cantidad <= s.stockMin).length;
  const modulos = modulosDe(session.rol);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  const maxLocal = Math.max(1, ...ventasPorLocal.map((v) => v._sum.total ?? 0));

  const kpis = [
    {
      label: "Ventas de hoy",
      value: formatCLP(ventasHoy._sum.total ?? 0),
      sub: `${ventasHoy._count} transacciones`,
      icon: <IconTrendingUp size={20} />,
      tone: "text-electric-600 bg-electric-50",
    },
    {
      label: "Bajo stock mínimo",
      value: String(bajoMinimo),
      sub: bajoMinimo > 0 ? "productos por reponer" : "todo en orden",
      icon: <IconAlert size={20} />,
      tone: bajoMinimo > 0 ? "text-fenix-600 bg-fenix-600/10" : "text-[#4d7c0f] bg-lime-400/15",
    },
    {
      label: "Cajas abiertas",
      value: String(cajasAbiertas),
      sub: cajasAbiertas > 0 ? "turnos activos ahora" : "sin turnos activos",
      icon: <IconCash size={20} />,
      tone: "text-electric-600 bg-electric-50",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-navy-950 sm:text-3xl">
          {saludo}, {session.nombre.split(" ")[0]}
        </h1>
        <p className="mt-1 text-slate-500">
          {session.localNombre ?? "Vista consolidada · Todos los locales"}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{k.label}</p>
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${k.tone}`}>
                {k.icon}
              </span>
            </div>
            <p className="mt-2 text-2xl font-black tabular-nums text-navy-950">{k.value}</p>
            <p className="text-sm text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Ventas por local (admin) */}
      {esAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-50 text-electric-600">
              <IconStore size={18} />
            </span>
            <h2 className="text-lg font-bold text-navy-950">Ventas de hoy por local</h2>
          </div>
          <div className="space-y-4">
            {locales.map((l) => {
              const v = ventasPorLocal.find((x) => x.localId === l.id);
              const total = v?._sum.total ?? 0;
              const pct = Math.round((total / maxLocal) * 100);
              return (
                <div key={l.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-navy-950">{l.nombre}</span>
                    <span className="tabular-nums text-slate-600">
                      {formatCLP(total)} · {v?._count ?? 0} ventas
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-cloud">
                    <div
                      className="h-full rounded-full bg-[linear-gradient(90deg,#2e5bff,#1e4fe8)]"
                      style={{ width: `${Math.max(pct, total > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Módulos */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Módulos</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {modulos.map((m) => {
            const card = moduloCards[m];
            return (
              <a
                key={m}
                href={card.href}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-electric-500 hover:shadow-card"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-50 text-electric-600 transition group-hover:bg-electric-600 group-hover:text-white">
                  {card.icon}
                </span>
                <h2 className="mt-3 font-bold text-navy-950">{card.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{card.desc}</p>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
