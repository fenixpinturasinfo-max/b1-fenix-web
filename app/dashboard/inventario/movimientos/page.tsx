import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  MovimientosLista,
  type MovimientoRow,
} from "@/features/inventory/components/MovimientosLista";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function MovimientosPage() {
  const session = await requireSeccion("inventario.movimientos");

  const movimientos = await prisma.movimientoInventario.findMany({
    where: esRolGlobal(session.rol) ? {} : { localId: session.localId! },
    include: { producto: true, local: true, usuario: true },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  const rows: MovimientoRow[] = movimientos.map((m) => ({
    id: m.id,
    fecha: fmt.format(m.creadoEn),
    tipo: m.tipo,
    producto: m.producto.nombre,
    local: m.local.comuna,
    cantidad: m.cantidad,
    usuario: m.usuario.nombre,
    nota: m.nota,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Historial de movimientos</h1>
        <p className="mt-1 text-slate-500">
          Últimos {rows.length} movimientos{!esRolGlobal(session.rol) ? " de tu local" : ""}.
        </p>
      </div>

      <MovimientosLista rows={rows} />
    </div>
  );
}
