import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { PriceTable, type PriceRow } from "@/features/pricing/components/PriceTable";

export default async function PreciosPage() {
  await requireModulo("precios");

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Lista de precios</h1>
        <p className="mt-1 text-slate-500">
          Precios unificados para todos los locales · {rows.length} productos
        </p>
      </div>
      <PriceTable rows={rows} categorias={categorias} />
    </div>
  );
}
