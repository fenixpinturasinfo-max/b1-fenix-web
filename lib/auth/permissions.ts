import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "./session";
import { SECCIONES, type Nivel } from "./secciones";

export type { Nivel };

/**
 * Permisos por perfil.
 *
 * Qué ve y qué puede hacer cada perfil vive en la tabla `PermisoPerfil` y se edita desde
 * Configuración › Perfiles. Este archivo resuelve la consulta y la cachea.
 *
 * Lo único que **no** se configura desde la pantalla es `esRolGlobal`: si el usuario ve
 * todos los locales o solo el suyo. Eso es alcance de datos, no visibilidad de menú, y
 * mezclarlos sería la forma más rápida de filtrar datos de un local a otro sin querer.
 */

const TAG_PERMISOS = "permisos";

/** Mapa sección → nivel de un perfil, leído de la base. */
const permisosCacheados = unstable_cache(
  async (rol: string): Promise<Record<string, Nivel>> => {
    const filas = await prisma.permisoPerfil.findMany({
      where: { rol: rol as never },
      select: { seccion: true, nivel: true },
    });
    return Object.fromEntries(filas.map((f) => [f.seccion, f.nivel as Nivel]));
  },
  ["permisos-perfil"],
  { tags: [TAG_PERMISOS], revalidate: 3600 },
);

/** Llave maestra: el administrador siempre tiene todo, sin consultar la base. */
function esAdministrador(rol: string): boolean {
  return rol === "ADMINISTRADOR";
}

export async function permisosDe(rol: string): Promise<Record<string, Nivel>> {
  if (esAdministrador(rol)) {
    return Object.fromEntries(SECCIONES.map((s) => [s.id, "TOTAL" as Nivel]));
  }
  return permisosCacheados(rol);
}

/** Sin fila configurada el nivel es SIN_ACCESO: una sección nueva nace cerrada. */
export async function nivelDe(rol: string, seccion: string): Promise<Nivel> {
  if (esAdministrador(rol)) return "TOTAL";
  const mapa = await permisosCacheados(rol);
  return mapa[seccion] ?? "SIN_ACCESO";
}

/** ¿La sección aparece en el menú y su ruta está abierta? */
export async function puedeVer(rol: string, seccion: string): Promise<boolean> {
  return (await nivelDe(rol, seccion)) !== "SIN_ACCESO";
}

/** ¿Puede modificar? Es lo que deben preguntar las Server Actions. */
export async function puedeEscribir(rol: string, seccion: string): Promise<boolean> {
  return (await nivelDe(rol, seccion)) === "TOTAL";
}

/** Secciones visibles del perfil, en el orden del catálogo. */
export async function seccionesVisibles(rol: string) {
  const mapa = await permisosDe(rol);
  return SECCIONES.filter((s) => (mapa[s.id] ?? "SIN_ACCESO") !== "SIN_ACCESO");
}

/** Nombre del tag de caché, para invalidar al guardar permisos. */
export const CACHE_TAG_PERMISOS = TAG_PERMISOS;

// ─────────────────────── Reglas atadas al rol ───────────────────────

/** Roles que ven todos los locales (no tienen uno asignado) */
export function esRolGlobal(rol: string): boolean {
  return rol === "ADMINISTRADOR" || rol === "GERENTE";
}

export type { SessionPayload };
