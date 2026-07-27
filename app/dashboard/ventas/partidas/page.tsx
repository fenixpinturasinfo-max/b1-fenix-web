import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  ListaPartidasVentas,
  type PartidaVenta,
} from "@/features/sales/components/ListaPartidasVentas";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function PartidasVentasPage() {
  const session = await requireSeccion("ventas.partidas");
  const esAdmin = esRolGlobal(session.rol);

  const [pedidos, ventas] = await Promise.all([
    prisma.pedidoCliente.findMany({
      where: esAdmin ? {} : { localId: session.localId! },
      include: { local: true, lineas: true },
      orderBy: { creadoEn: "desc" },
      take: 200,
    }),
    prisma.venta.findMany({
      where: esAdmin ? {} : { localId: session.localId! },
      include: { local: true, usuario: true, _count: { select: { detalle: true } } },
      orderBy: { creadoEn: "desc" },
      take: 200,
    }),
  ]);

  const partidas: (PartidaVenta & { ts: number })[] = [
    ...pedidos.map((p) => ({
      ts: p.creadoEn.getTime(),
      key: `ped-${p.id}`,
      tipo: "PED" as const,
      folio: `PED-${String(p.correlativo).padStart(6, "0")}`,
      fecha: fmt.format(p.creadoEn),
      contraparte: p.nombreCliente,
      local: p.local.comuna,
      detalle: `${p.lineas.reduce((n, l) => n + l.cantidad, 0)} un.`,
      total: p.total,
      estado:
        p.estado === "PENDIENTE"
          ? "Pendiente"
          : p.estado === "PREPARADO"
            ? "Preparado"
            : p.estado === "ENTREGADO"
              ? "Entregado"
              : "Anulado",
      tono:
        p.estado === "PENDIENTE"
          ? ("warn" as const)
          : p.estado === "PREPARADO"
            ? ("info" as const)
            : p.estado === "ENTREGADO"
              ? ("ok" as const)
              : ("error" as const),
      abierto: p.estado === "PENDIENTE" || p.estado === "PREPARADO",
      href: "/dashboard/ventas/pedidos",
    })),
    ...ventas.map((v) => ({
      ts: v.creadoEn.getTime(),
      key: `bol-${v.id}`,
      tipo: "BOL" as const,
      folio: `${v.local.codigo}-${String(v.correlativo).padStart(6, "0")}`,
      fecha: fmt.format(v.creadoEn),
      contraparte: v.usuario.nombre,
      local: v.local.comuna,
      detalle: `${v._count.detalle} ítem${v._count.detalle === 1 ? "" : "s"}`,
      total: v.total,
      estado: v.estado === "ANULADA" ? "Anulada" : "Completada",
      tono: v.estado === "ANULADA" ? ("error" as const) : ("ok" as const),
      abierto: false,
      href: `/dashboard/pos/boletas/${v.id}`,
    })),
  ];
  partidas.sort((a, b) => b.ts - a.ts);
  const lista: PartidaVenta[] = partidas.map(({ ts: _ts, ...p }) => p);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Lista de partidas · Ventas</h1>
        <p className="mt-1 text-slate-500">
          Todos los documentos de ventas en un solo lugar: pedidos de clientes y boletas.
        </p>
      </div>

      <ListaPartidasVentas partidas={lista} />
    </div>
  );
}
