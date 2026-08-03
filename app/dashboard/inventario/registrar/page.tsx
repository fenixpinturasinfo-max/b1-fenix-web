import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos } from "@/lib/cache";
import { MovementForm } from "@/features/inventory/components/MovementForm";

export default async function RegistrarDocumentoPage({
  searchParams,
}: {
  searchParams: Promise<{ producto?: string }>;
}) {
  const session = await requireSeccion("inventario.registrar");
  const { producto: productoParam } = await searchParams;

  const [productos, locales, stockRows] = await Promise.all([
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    getLocalesActivos(),
    prisma.stockLocal.findMany({
      where: { local: { activo: true } },
      select: { productoId: true, localId: true, cantidad: true },
    }),
  ]);

  // productoId → localId → stock
  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stockRows) (stocks[s.productoId] ??= {})[s.localId] = s.cantidad;

  const productoDefault = productos.find((p) => p.id === productoParam)?.id;

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/dashboard/inventario"
          className="text-sm font-semibold text-slate-500 hover:text-electric-600"
        >
          ← Volver a inventario
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Nuevo documento de movimiento</h1>
        <p className="mt-1 text-slate-500">
          Un documento, un tipo, varios artículos: entradas, ajustes de conteo, mermas y
          transferencias entre locales. Todo queda en el historial de movimientos.
        </p>
      </div>

      {productos.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          ⚠️ No hay productos activos en el catálogo. Créalos en{" "}
          <a href="/dashboard/inventario" className="font-bold text-electric-600 hover:underline">
            Inventario
          </a>{" "}
          primero.
        </p>
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <MovementForm
            productos={productos.map((p) => ({
              id: p.id,
              sku: p.sku,
              nombre: p.nombre,
              marca: p.marca,
              codigoBarra: p.codigoBarra,
              costo: p.precioCosto,
            }))}
            locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
            localFijo={esRolGlobal(session.rol) ? null : session.localId}
            productoDefault={productoDefault}
            stocks={stocks}
          />
        </section>
      )}

      <p className="text-sm text-slate-400">
        💡 Las compras a proveedor no se registran aquí: usa el flujo{" "}
        <a
          href="/dashboard/solicitudes?tab=compra"
          className="font-bold text-electric-600 hover:underline"
        >
          Solicitud → Orden de Compra → Entrada
        </a>{" "}
        para que el stock y el costo promedio se actualicen con trazabilidad al documento.
      </p>
    </div>
  );
}
