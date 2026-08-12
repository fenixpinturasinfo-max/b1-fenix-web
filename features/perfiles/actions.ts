"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritura } from "@/lib/auth/guards";
import { CACHE_TAG_PERMISOS } from "@/lib/auth/permissions";
import { CACHE_TAG_TOPES } from "@/features/descuentos/topes";
import { SECCIONES, type Nivel } from "@/lib/auth/secciones";

export interface ActionState {
  error?: string;
  ok?: string;
}

const NIVELES_VALIDOS: Nivel[] = ["TOTAL", "LECTURA", "SIN_ACCESO"];
const EDITABLES = ["GERENTE", "JEFE_LOCAL", "VENDEDOR", "BODEGA"];

/**
 * Guarda la matriz de permisos de un perfil.
 *
 * Tres protecciones contra quedarse fuera del sistema:
 *  1. El perfil ADMINISTRADOR no se toca: es la llave maestra.
 *  2. Nadie edita el perfil que está usando en ese momento.
 *  3. Solo entra quien tenga escritura en Configuración › Perfiles.
 */
export async function guardarPermisos(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("config.perfiles");
    const rol = String(formData.get("rol") ?? "");

    if (rol === "ADMINISTRADOR") {
      return { error: "El perfil Administrador tiene acceso total y no se puede restringir." };
    }
    if (!EDITABLES.includes(rol)) {
      return { error: "Perfil desconocido." };
    }
    if (rol === session.rol) {
      return {
        error:
          "No puedes cambiar los permisos del perfil que estás usando. Pídeselo a otro administrador.",
      };
    }

    // Una fila por sección del catálogo: lo que no venga en el formulario queda cerrado
    const filas = SECCIONES.map((s) => {
      const crudo = String(formData.get(`n:${s.id}`) ?? "SIN_ACCESO") as Nivel;
      let nivel: Nivel = NIVELES_VALIDOS.includes(crudo) ? crudo : "SIN_ACCESO";
      // Una sección sin lectura intermedia no puede quedar en LECTURA
      if (nivel === "LECTURA" && !s.permiteLectura) nivel = "SIN_ACCESO";
      return { rol: rol as never, seccion: s.id, nivel: nivel as never };
    });

    await prisma.$transaction([
      prisma.permisoPerfil.deleteMany({ where: { rol: rol as never } }),
      prisma.permisoPerfil.createMany({ data: filas }),
    ]);

    // El menú y los guards leen el mapa cacheado: sin esto el cambio no se ve
    revalidateTag(CACHE_TAG_PERMISOS, "max");
    revalidatePath("/dashboard", "layout");

    const abiertas = filas.filter((f) => f.nivel !== "SIN_ACCESO").length;
    return { ok: `Permisos guardados: ${abiertas} de ${SECCIONES.length} secciones abiertas.` };
  } catch {
    return { error: "No autorizado o error al guardar." };
  }
}

/**
 * Guarda el tramo libre de descuento del perfil.
 *
 * Va aparte de la matriz de permisos porque no es un permiso: es cuánta plata puede
 * regalar el perfil sin que nadie lo mire. Mismas dos protecciones, eso sí — el
 * Administrador no se toca, y nadie se edita el techo a sí mismo, que sería subirse el
 * sueldo con la propia firma.
 */
export async function guardarTope(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("config.perfiles");
    const rol = String(formData.get("rol") ?? "");

    if (rol === "ADMINISTRADOR") {
      return { error: "El perfil Administrador autoriza cualquier descuento." };
    }
    if (!EDITABLES.includes(rol)) return { error: "Perfil desconocido." };
    if (rol === session.rol) {
      return { error: "No puedes cambiar tu propio tope de descuento. Pídeselo a otro administrador." };
    }

    const porcentaje = Math.round(Number(formData.get("porcentaje") ?? 0));
    const montoMaximo = Math.round(Number(formData.get("montoMaximo") ?? 0));

    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 100) {
      return { error: "El porcentaje debe estar entre 0 y 100." };
    }
    if (!Number.isFinite(montoMaximo) || montoMaximo < 0) {
      return { error: "El monto máximo no puede ser negativo." };
    }

    await prisma.topeDescuento.upsert({
      where: { rol: rol as never },
      create: { rol: rol as never, porcentaje, montoMaximo },
      update: { porcentaje, montoMaximo },
    });

    revalidateTag(CACHE_TAG_TOPES, "max");

    return {
      ok:
        porcentaje === 0
          ? "Listo: este perfil pedirá autorización para cualquier descuento."
          : `Listo: hasta ${porcentaje}% sin autorización${montoMaximo > 0 ? `, con techo de $${montoMaximo.toLocaleString("es-CL")}` : ""}.`,
    };
  } catch {
    return { error: "No autorizado o error al guardar." };
  }
}
