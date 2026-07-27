import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PriceTable, type PriceRow } from "@/features/pricing/components/PriceTable";
import { ImportPrecios } from "@/features/pricing/components/ImportPrecios";

export default async function PreciosPage() {
  await requireSeccion("inventario.precios-venta");

  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { categoria: true },
    orderBy: [{ categoria: { nombre: "asc" } }, { nombre: "asc" }],
  });

  const rows: PriceRow[] = productos.map((p) => ({
    productoId: p.id,
    sku: p.sku,
    nombre: p.nombre,
    marca: p.marca,
    categoria: p.categoria.nombre,
    precioCosto: p.precioCosto,
    precioVenta: p.precioVenta,
    precioAnterior: p.precioAnterior,
    codigoBarra: p.codigoBarra,
    imagen: p.imagen,
  }));

  const categorias = [...new Set(rows.map((r) => r.categoria))];

  const preciosPorSku = Object.fromEntries(
    rows.map((r) => [r.sku.toUpperCase(), { nombre: r.nombre, precioVenta: r.precioVenta }]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Lista de precios · Venta</h1>
          <p className="mt-1 text-slate-500">
            Precios unificados para todos los locales · {rows.length} productos
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/dashboard/precios/export"
            className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold leading-10 text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
          >
            ⬇ Exportar CSV
          </a>
          <ImportPrecios precios={preciosPorSku} />
        </div>
      </div>
      <PriceTable rows={rows} categorias={categorias} />
    </div>
  );
}
