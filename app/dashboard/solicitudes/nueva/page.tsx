import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos, getProveedoresActivos } from "@/lib/cache";
import { SolicitudCompra } from "@/features/supply/components/SolicitudCompra";

export default async function NuevaSolicitudPage() {
  const session = await requireSeccion("compras.solicitudes");

  const [proveedores, locales, productos, stockRows, precioRows] = await Promise.all([
    getProveedoresActivos(),
    getLocalesActivos(),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.stockLocal.findMany({
      where: { local: { activo: true } },
      select: { productoId: true, localId: true, cantidad: true },
    }),
    prisma.precioCompraProveedor.findMany({
      select: { proveedorId: true, productoId: true, precio: true },
    }),
  ]);

  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stockRows) (stocks[s.productoId] ??= {})[s.localId] = s.cantidad;
  const preciosCompra: Record<string, Record<string, number>> = {};
  for (const p of precioRows) (preciosCompra[p.proveedorId] ??= {})[p.productoId] = p.precio;

  return (
    <div className="space-y-6">
      <div>
        <a
          href="/dashboard/solicitudes"
          className="text-sm font-semibold text-slate-500 hover:text-electric-600"
        >
          ← Volver a solicitudes
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Nueva Solicitud de Compra</h1>
        <p className="mt-1 text-slate-500">
          El precio viene sugerido desde la lista del proveedor (o el costo promedio) — ajústalo
          si cotizaron otro valor.
        </p>
      </div>

      {proveedores.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          ⚠️ No hay proveedores registrados. Crea uno en el módulo{" "}
          <a href="/dashboard/socios" className="font-bold text-electric-600 hover:underline">
            Socios
          </a>{" "}
          primero.
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <SolicitudCompra
            proveedores={proveedores.map((p) => ({
              id: p.id,
              nombre: p.nombreFantasia ?? p.razonSocial,
            }))}
            productos={productos.map((p) => ({
              id: p.id,
              sku: p.sku,
              nombre: p.nombre,
              marca: p.marca,
              codigoBarra: p.codigoBarra,
              precioCosto: p.precioCosto,
            }))}
            locales={locales}
            localFijo={esRolGlobal(session.rol) ? null : session.localId}
            stocks={stocks}
            preciosCompra={preciosCompra}
          />
        </div>
      )}
    </div>
  );
}
