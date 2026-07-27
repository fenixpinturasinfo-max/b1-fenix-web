import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { MovementForm } from "@/features/inventory/components/MovementForm";

export default async function RegistrarDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const session = await requireSeccion("inventario.registrar");
  const { producto: productoParam } = await searchParams;

  const [productos, locales] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);
  const productoDefault = productos.find((p) => p.id === productoParam)?.id;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Registrar documento</h1>
        <p className="mt-1 text-slate-500">
          Movimientos de inventario: entradas, ajustes de conteo, mermas y transferencias entre
          locales. Quedan en el historial de movimientos.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <MovementForm
          productos={productos.map((p) => ({ id: p.id, nombre: `${p.nombre} (${p.sku})` }))}
          locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
          localFijo={esRolGlobal(session.rol) ? null : session.localId}
          productoDefault={productoDefault}
        />
      </section>

      <p className="text-sm text-slate-400">
        💡 Las compras a proveedor no se registran aquí: usa el flujo{" "}
        <a href="/dashboard/solicitudes?tab=compra" className="font-bold text-electric-600 hover:underline">
          Solicitud → Orden de Compra → Entrada
        </a>{" "}
        para que el stock y el costo promedio se actualicen con trazabilidad.
      </p>
    </div>
  );
}
