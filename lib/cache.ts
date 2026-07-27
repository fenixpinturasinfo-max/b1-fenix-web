import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Lookups que casi nunca cambian, cacheados entre requests para no
 * golpear Neon en cada navegación. Se invalidan por tag desde las
 * actions que los modifican (revalidateTag) y expiran solos a los 10 min.
 */

export const getLocalesActivos = unstable_cache(
  () => prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ["locales-activos"],
  { tags: ["locales"], revalidate: 600 },
);

export const getCategorias = unstable_cache(
  () => prisma.categoria.findMany({ orderBy: { nombre: "asc" } }),
  ["categorias"],
  { tags: ["categorias"], revalidate: 600 },
);

export const getProveedoresActivos = unstable_cache(
  () =>
    prisma.socioNegocio.findMany({
      where: { activo: true, tipo: "PROVEEDOR" },
      orderBy: { razonSocial: "asc" },
    }),
  ["proveedores-activos"],
  { tags: ["socios"], revalidate: 600 },
);
