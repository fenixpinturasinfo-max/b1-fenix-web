"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearSessionCookie,
  setSessionCookie,
  signSession,
} from "@/lib/auth/session";

export interface LoginState {
  error?: string;
}

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresa tu correo y contraseña." };
  }

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { local: true },
  });

  if (!usuario || !usuario.activo) {
    return { error: "Credenciales incorrectas." };
  }

  const ok = await bcrypt.compare(password, usuario.passwordHash);
  if (!ok) {
    return { error: "Credenciales incorrectas." };
  }

  const token = await signSession({
    sub: usuario.id,
    email: usuario.email,
    nombre: usuario.nombre,
    rol: usuario.rol,
    localId: usuario.localId,
    localNombre: usuario.local?.nombre ?? null,
  });
  await setSessionCookie(token);

  redirect("/dashboard");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}
