"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireAdmin() {
  const session = await getSession();
  if (!session || session.rol !== "ADMINISTRADOR") {
    throw new Error("No autorizado");
  }
  return session;
}

const ROLES = ["ADMINISTRADOR", "JEFE_LOCAL", "VENDEDOR", "BODEGA"] as const;
type RolValido = (typeof ROLES)[number];

export async function crearUsuario(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const nombre = String(formData.get("nombre") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const rol = String(formData.get("rol") ?? "") as RolValido;
    const localId = String(formData.get("localId") ?? "") || null;

    if (!nombre || !email || !password || !ROLES.includes(rol)) {
      return { error: "Completa todos los campos." };
    }
    if (password.length < 8) {
      return { error: "La contraseña debe tener al menos 8 caracteres." };
    }
    if (rol !== "ADMINISTRADOR" && !localId) {
      return { error: "Asigna un local para este rol." };
    }

    const existe = await prisma.usuario.findUnique({ where: { email } });
    if (existe) return { error: "Ya existe un usuario con ese correo." };

    await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        rol,
        localId: rol === "ADMINISTRADOR" ? null : localId,
      },
    });

    revalidatePath("/dashboard/usuarios");
    return { ok: `Usuario ${nombre} creado.` };
  } catch {
    return { error: "No autorizado o error al crear." };
  }
}

export async function toggleUsuarioActivo(formData: FormData) {
  const session = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === session.sub) return; // no puede desactivarse a sí mismo

  const usuario = await prisma.usuario.findUnique({ where: { id } });
  if (!usuario) return;

  await prisma.usuario.update({
    where: { id },
    data: { activo: !usuario.activo },
  });
  revalidatePath("/dashboard/usuarios");
}

export async function resetPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    const password = String(formData.get("password") ?? "");
    if (!id || password.length < 8) {
      return { error: "La contraseña debe tener al menos 8 caracteres." };
    }
    await prisma.usuario.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
    revalidatePath("/dashboard/usuarios");
    return { ok: "Contraseña actualizada." };
  } catch {
    return { error: "Error al actualizar la contraseña." };
  }
}
