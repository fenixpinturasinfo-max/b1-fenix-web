import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { SIN_TRAMO_LIBRE, type TopeLibre } from "@/lib/descuento";

/**
 * Tramo libre por perfil, leído de la base y cacheado igual que los permisos.
 *
 * Vive aparte de `lib/descuento.ts` porque ese archivo lo importa el navegador —el modal
 * calcula el tramo para decidir si pide credenciales— y arrastrar Prisma hasta ahí metería
 * el cliente de base de datos en el bundle del cliente.
 */

const TAG_TOPES = "topes-descuento";

const topeCacheado = unstable_cache(
  async (rol: string): Promise<TopeLibre> => {
    const fila = await prisma.topeDescuento.findUnique({
      where: { rol: rol as never },
      select: { porcentaje: true, montoMaximo: true },
    });
    return fila ?? SIN_TRAMO_LIBRE;
  },
  ["tope-descuento"],
  { tags: [TAG_TOPES], revalidate: 3600 },
);

/** Tramo libre configurado para un perfil. Sin fila, cero. */
export async function topeDe(rol: string): Promise<TopeLibre> {
  return topeCacheado(rol);
}

/** Nombre del tag de caché, para invalidar al guardar. */
export const CACHE_TAG_TOPES = TAG_TOPES;
