/**
 * Reglas puras de los avisos, compartidas por el servidor y el cliente.
 *
 * Este archivo **no importa Prisma a propósito**. La campana es un componente cliente y
 * necesita `estaSilenciado` y el nombre de la cookie; si esas piezas vivieran junto a la
 * consulta, importarlas arrastraría `lib/prisma` —y con él el driver de Postgres— al bundle
 * del navegador. Es la misma separación que `features/tomas/toma.ts` o `features/pos/caja.ts`.
 */

import type { Tono } from "@/components/ui/tonos";

export interface Aviso {
  /** Slug estable. La cookie de silenciados se indexa por acá y no por el título:
      cambiar un texto no debe reactivar avisos que el usuario ya había silenciado. */
  id: string;
  n: number;
  titulo: string;
  /** Qué implica, no qué es. El usuario decide con esto si vale interrumpirse. */
  descripcion: string;
  /** A la lista ya prefiltrada, no al módulo completo. */
  href: string;
  tono: Tono;
}

/** Cookie con el contador de cada aviso al momento de silenciarlo. */
export const COOKIE_AVISOS_LEIDOS = "fenix-avisos-leidos";

/**
 * Lee la cookie de silenciados.
 *
 * Tolerante a propósito: una cookie corrupta o de una versión anterior no debe romper el
 * layout, que es lo que envuelve **todo** el dashboard. Ante la duda, no hay nada
 * silenciado y el usuario ve todos sus avisos.
 */
export function parseAvisosLeidos(raw: string | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const datos: unknown = JSON.parse(decodeURIComponent(raw));
    if (typeof datos !== "object" || datos === null) return {};
    const limpio: Record<string, number> = {};
    for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) limpio[k] = Math.trunc(n);
    }
    return limpio;
  } catch {
    return {};
  }
}

/**
 * ¿Sigue silenciado?
 *
 * Solo mientras el número no crezca. Silenciar "2 facturas vencidas" oculta esas dos; si
 * aparece una tercera el aviso vuelve, porque la situación empeoró y eso es información
 * nueva. Es lo que evita que un vencido quede enterrado para siempre.
 */
export function estaSilenciado(aviso: Aviso, leidos: Record<string, number>): boolean {
  return (leidos[aviso.id] ?? 0) >= aviso.n;
}
