"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

const TIPOS = ["CLIENTE", "PROVEEDOR"] as const;
type Tipo = (typeof TIPOS)[number];

async function requireAdmin() {
  return exigirEscritura("socios.socios");
}

/** Valida formato básico de RUT chileno (con guion). */
function normalizarRut(rut: string): string | null {
  const limpio = rut.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
  if (!/^\d{7,8}-[\dK]$/.test(limpio)) return null;
  return limpio;
}

export async function guardarSocio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireAdmin();

    const id = String(formData.get("id") ?? "") || null;
    const tipo = String(formData.get("tipo") ?? "") as Tipo;
    const rutRaw = String(formData.get("rut") ?? "").trim();
    const razonSocial = String(formData.get("razonSocial") ?? "").trim();
    const nombreFantasia = String(formData.get("nombreFantasia") ?? "").trim() || null;
    const giro = String(formData.get("giro") ?? "").trim() || null;
    const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
    const telefono = String(formData.get("telefono") ?? "").trim() || null;
    const direccion = String(formData.get("direccion") ?? "").trim() || null;
    const comuna = String(formData.get("comuna") ?? "").trim() || null;
    const condicionPago = String(formData.get("condicionPago") ?? "").trim() || null;

    if (!TIPOS.includes(tipo) || !rutRaw || !razonSocial) {
      return { error: "Completa tipo, RUT y razón social." };
    }
    const rut = normalizarRut(rutRaw);
    if (!rut) return { error: "RUT inválido. Formato: 12345678-9." };

    // Único por RUT + tipo (una empresa puede existir como cliente Y como proveedor)
    const existente = await prisma.socioNegocio.findFirst({ where: { rut, tipo } });
    if (existente && existente.id !== id) {
      return {
        error: `El RUT ya está registrado como ${tipo.toLowerCase()} (${existente.razonSocial}).`,
      };
    }

    const data = { tipo, rut, razonSocial, nombreFantasia, giro, email, telefono, direccion, comuna, condicionPago };
    if (id) {
      await prisma.socioNegocio.update({ where: { id }, data });
    } else {
      await prisma.socioNegocio.create({ data });
    }

    revalidatePath("/dashboard/socios");
  revalidateTag("socios", "max"); // cache compartido de lookups (lib/cache.ts)
    revalidatePath("/dashboard/solicitudes");
    return { ok: id ? "Socio actualizado." : `Socio ${razonSocial} creado.` };
  } catch {
    return { error: "No autorizado o error al guardar." };
  }
}

export async function toggleSocioActivo(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const socio = await prisma.socioNegocio.findUnique({ where: { id } });
  if (!socio) return;
  await prisma.socioNegocio.update({ where: { id }, data: { activo: !socio.activo } });
  revalidatePath("/dashboard/socios");
  revalidateTag("socios", "max"); // cache compartido de lookups (lib/cache.ts)
}
