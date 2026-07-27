import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { BoletasLista, type BoletaRow } from "@/features/pos/components/BoletasLista";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function BoletasPage() {
  const session = await requireSeccion("ventas.boletas");

  const ventas = await prisma.venta.findMany({
    where: esRolGlobal(session.rol) ? {} : { localId: session.localId! },
    include: {
      local: true,
      usuario: true,
      _count: { select: { detalle: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  const rows: BoletaRow[] = ventas.map((v) => ({
    id: v.id,
    folio: `${v.local.codigo}-${String(v.correlativo).padStart(6, "0")}`,
    fecha: fmt.format(v.creadoEn),
    local: v.local.comuna,
    vendedor: v.usuario.nombre,
    medio: v.medioPago,
    items: v._count.detalle,
    total: v.total,
    anulada: v.estado === "ANULADA",
  }));

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard/pos" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Volver al POS
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Boletas</h1>
        <p className="mt-1 text-slate-500">
          Últimas {rows.length} ventas
          {!esRolGlobal(session.rol) ? " de tu local" : " de todos los locales"}.
        </p>
      </div>

      <BoletasLista rows={rows} />
    </div>
  );
}
