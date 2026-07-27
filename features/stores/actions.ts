"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireAdmin() {
  return exigirEscritura("config.locales");
}

function revalidar() {
  revalidatePath("/dashboard/configuracion/locales");
  revalidatePath("/"); // la landing muestra los locales
  revalidateTag("locales", "max"); // cache compartido de lookups (lib/cache.ts)
}

export async function guardarLocal(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const id = String(formData.get("id") ?? "") || null;
    const codigo = String(formData.get("codigo") ?? "").trim().toUpperCase();
    const nombre = String(formData.get("nombre") ?? "").trim();
    const direccion = String(formData.get("direccion") ?? "").trim();
    const comuna = String(formData.get("comuna") ?? "").trim();
    const horario = String(formData.get("horario") ?? "").trim() || null;
    const esMatriz = formData.get("esMatriz") === "on";

    if (!codigo || !nombre || !direccion || !comuna) {
      return { error: "Completa código, nombre, dirección y comuna." };
    }
    if (!/^[A-Z0-9]{2,4}$/.test(codigo)) {
      return { error: "El código debe tener 2 a 4 letras/números (ej: SB, BU, ML1)." };
    }

    const existente = await prisma.local.findUnique({ where: { codigo } });
    if (existente && existente.id !== id) {
      return { error: `El código ${codigo} ya está en uso por ${existente.nombre}.` };
    }

    await prisma.$transaction(async (tx) => {
      // Solo puede existir una casa matriz
      if (esMatriz) {
        await tx.local.updateMany({ where: { esMatriz: true }, data: { esMatriz: false } });
      }
      if (id) {
        await tx.local.update({
          where: { id },
          data: { codigo, nombre, direccion, comuna, horario, esMatriz },
        });
      } else {
        await tx.local.create({
          data: { codigo, nombre, direccion, comuna, horario, esMatriz },
        });
      }
    });

    revalidar();
    return { ok: id ? "Local actualizado." : `Local ${nombre} creado.` };
  } catch {
    return { error: "No autorizado o error al guardar." };
  }
}

export async function toggleLocalActivo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const local = await prisma.local.findUnique({ where: { id } });
  if (!local) return;

  if (local.activo) {
    // No desactivar si tiene usuarios activos o cajas abiertas
    const [usuarios, cajas] = await Promise.all([
      prisma.usuario.count({ where: { localId: id, activo: true } }),
      prisma.cajaSesion.count({ where: { localId: id, estado: "ABIERTA" } }),
    ]);
    if (usuarios > 0 || cajas > 0) return;
  }

  await prisma.local.update({ where: { id }, data: { activo: !local.activo } });
  revalidar();
}
