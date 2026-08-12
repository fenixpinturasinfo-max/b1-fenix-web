"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritura } from "@/lib/auth/guards";
import { normalizarRut } from "@/lib/rut";

export interface ActionState {
  error?: string;
  ok?: string;
}

const TIPOS = ["CLIENTE", "PROVEEDOR"] as const;
type Tipo = (typeof TIPOS)[number];

async function requireAdmin() {
  return exigirEscritura("socios.socios");
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
    // Descuento pactado (%). Solo tiene efecto en fichas CLIENTE: en un proveedor se
    // guarda 0 aunque el formulario mande algo, para que nunca aparezca de rebote.
    const descuentoRaw = Math.trunc(Number(formData.get("descuentoPorcentaje") ?? 0));
    const descuentoPorcentaje = tipo === "CLIENTE" && Number.isFinite(descuentoRaw) ? descuentoRaw : 0;
    // Igual que el descuento: en un proveedor no significa nada y se guarda apagado.
    const cuentaAbierta = tipo === "CLIENTE" && formData.get("cuentaAbierta") === "on";

    if (!TIPOS.includes(tipo) || !rutRaw || !razonSocial) {
      return { error: "Completa tipo, RUT y razón social." };
    }
    if (descuentoPorcentaje < 0 || descuentoPorcentaje > 100) {
      return { error: "El descuento del cliente debe estar entre 0 y 100%." };
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

    const data = { tipo, rut, razonSocial, nombreFantasia, giro, email, telefono, direccion, comuna, condicionPago, descuentoPorcentaje, cuentaAbierta };
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
