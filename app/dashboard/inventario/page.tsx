import Link from "next/link";
import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getCategorias, getLocalesActivos } from "@/lib/cache";
import {
  StockTable,
  type EstadoStock,
  type ProductoStock,
} from "@/features/inventory/components/StockTable";
import { ProductForm } from "@/features/inventory/components/ProductForm";
import { ImportProductos } from "@/features/inventory/components/ImportProductos";

const ESTADOS: EstadoStock[] = ["TODOS", "SIN", "BAJO", "OK"];

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  // En solo lectura consulta el stock, pero no define mínimos ni ubicaciones
  const { session, escribe: ajusta } = await requireSeccionConNivel("inventario.productos");
  const { estado } = await searchParams;
  const estadoInicial = ESTADOS.includes(estado as EstadoStock)
    ? (estado as EstadoStock)
    : "TODOS";

  const [locales, productos, categorias] = await Promise.all([
    getLocalesActivos(),
    prisma.producto.findMany({
      where: { activo: true },
      include: { stocks: true },
      orderBy: { nombre: "asc" },
    }),
    getCategorias(),
  ]);

  const items: ProductoStock[] = productos.map((p) => ({
    productoId: p.id,
    sku: p.sku,
    nombre: p.nombre,
    marca: p.marca,
    categoriaId: p.categoriaId,
    codigoBarra: p.codigoBarra,
    precioCosto: p.precioCosto,
    precioVenta: p.precioVenta,
    imagen: p.imagen,
    activo: p.activo,
    porLocal: Object.fromEntries(
      p.stocks.map((s) => [
        s.localId,
        {
          cantidad: s.cantidad,
          stockMin: s.stockMin,
          stockMax: s.stockMax,
          ubicacion: s.ubicacion,
        },
      ]),
    ),
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Inventario</h1>
          <p className="mt-1 text-slate-500">
            {ajusta
              ? "Stock por local, parámetros de reposición y catálogo"
              : "Consulta del stock de tu local"}{" "}
            · {items.length} productos activos
          </p>
          {!ajusta && (
            <p className="mt-1 text-sm text-slate-400">
              Para mover stock usa{" "}
              <Link
                href="/dashboard/inventario/registrar"
                className="font-bold text-electric-600 hover:underline"
              >
                Registrar documento
              </Link>
              . Los mínimos y ubicaciones los define bodega o administración.
            </p>
          )}
        </div>
        {ajusta && (
          <div className="flex flex-wrap gap-2">
            <ImportProductos />
            <ProductForm categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))} />
          </div>
        )}
      </div>

      <StockTable
        productos={items}
        locales={locales.map((l) => ({ id: l.id, comuna: l.comuna }))}
        localFijo={esRolGlobal(session.rol) ? null : session.localId}
        categorias={categorias.map((c) => ({ id: c.id, nombre: c.nombre }))}
        esAdmin={ajusta}
        puedeAjustar={ajusta}
        estadoInicial={estadoInicial}
      />
    </div>
  );
}
