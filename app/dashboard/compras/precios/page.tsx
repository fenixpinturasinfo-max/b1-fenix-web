import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getProveedoresActivos } from "@/lib/cache";
import { PreciosCompra, type PrecioRow } from "@/features/purchases/components/PreciosCompra";
import { ImportPreciosCompra } from "@/features/purchases/components/ImportPreciosCompra";

const fmtFecha = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeZone: "America/Santiago",
});

export default async function PreciosCompraPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string }>;
}) {
  await requireSeccion("inventario.precios-compra");
  const { proveedor: proveedorParam } = await searchParams;

  const proveedores = await getProveedoresActivos();
  const proveedor =
    proveedores.find((p) => p.id === proveedorParam) ?? proveedores[0] ?? null;

  const [productos, precios] = proveedor
    ? await Promise.all([
        prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
        prisma.precioCompraProveedor.findMany({ where: { proveedorId: proveedor.id } }),
      ])
    : [[], []];

  const precioDe = new Map(precios.map((p) => [p.productoId, p]));
  const rows: PrecioRow[] = productos.map((p) => {
    const pc = precioDe.get(p.id);
    return {
      productoId: p.id,
      sku: p.sku,
      nombre: p.nombre,
      marca: p.marca,
      cpp: p.precioCosto,
      precio: pc?.precio ?? null,
      origen: pc?.origen ?? null,
      actualizadoEn: pc ? fmtFecha.format(pc.actualizadoEn) : null,
    };
  });

  const preciosPorSku = Object.fromEntries(
    rows.map((r) => [r.sku.toUpperCase(), { nombre: r.nombre, precio: r.precio }]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Lista de precios · Compra</h1>
          <p className="mt-1 text-slate-500">
            Último precio pactado por proveedor. Se actualiza solo con cada recepción o factura, y
            se usa como sugerencia en solicitudes y órdenes de compra.
          </p>
        </div>
        {proveedor && (
          <div className="flex gap-2">
            <a
              href={`/dashboard/compras/precios/export?proveedor=${proveedor.id}`}
              className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold leading-10 text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
            >
              ⬇ Exportar CSV
            </a>
            <ImportPreciosCompra
              proveedorId={proveedor.id}
              proveedorNombre={proveedor.nombreFantasia ?? proveedor.razonSocial}
              precios={preciosPorSku}
            />
          </div>
        )}
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
        <>
          {/* Selector de proveedor */}
          <nav className="flex flex-wrap gap-2" aria-label="Proveedor">
            {proveedores.map((p) => {
              const activo = p.id === proveedor?.id;
              return (
                <a
                  key={p.id}
                  href={`/dashboard/compras/precios?proveedor=${p.id}`}
                  aria-current={activo ? "page" : undefined}
                  className={`flex h-11 items-center rounded-xl px-5 font-bold transition ${
                    activo
                      ? "bg-electric-600 text-white"
                      : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
                  }`}
                >
                  🚚 {p.nombreFantasia ?? p.razonSocial}
                </a>
              );
            })}
          </nav>

          {proveedor && <PreciosCompra rows={rows} proveedorId={proveedor.id} />}
        </>
      )}
    </div>
  );
}
