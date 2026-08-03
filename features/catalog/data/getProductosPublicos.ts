import { prisma } from "@/lib/prisma";
import { products as productosRespaldo } from "./products";
import type { CategoryId, Product } from "../types";

/**
 * El catálogo público identifica los locales por su slug heredado del mock
 * inicial ("san-bernardo", "buin"). El código del Local en la BD ("SB", "BU")
 * es el puente estable entre ambos mundos — ver prisma/seed.ts.
 */
const CODIGO_A_SLUG: Record<string, string> = { SB: "san-bernardo", BU: "buin" };

/**
 * Productos del catálogo público, leídos en vivo desde Prisma.
 * Así el precio que se edita en /dashboard/precios (o /dashboard/inventario)
 * se refleja en la landing sin pasos manuales.
 *
 * Si la BD no responde o aún no tiene productos cargados, cae al mock de
 * respaldo para que la landing nunca se caiga.
 */
export async function getProductosPublicos(): Promise<Product[]> {
  try {
    const [productos, locales] = await Promise.all([
      prisma.producto.findMany({
        where: { activo: true },
        include: { categoria: true, stocks: true },
        orderBy: { creadoEn: "asc" },
      }),
      prisma.local.findMany({ select: { id: true, codigo: true } }),
    ]);
    if (productos.length === 0) return productosRespaldo;

    const localIdASlug = new Map(
      locales.map((l) => [l.id, CODIGO_A_SLUG[l.codigo] ?? l.codigo.toLowerCase()]),
    );

    return productos.map((p) => ({
      sku: p.sku,
      slug: p.slug,
      nombre: p.nombre,
      marca: p.marca,
      categoria: p.categoria.slug as CategoryId,
      precioVenta: p.precioVenta,
      precioAnterior: p.precioAnterior ?? undefined,
      imagen: p.imagen ?? undefined,
      destacado: p.destacado,
      stock: Object.fromEntries(
        p.stocks.map((s) => [localIdASlug.get(s.localId) ?? s.localId, s.cantidad]),
      ),
    }));
  } catch {
    return productosRespaldo;
  }
}
