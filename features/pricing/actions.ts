"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export interface ActionState {
  error?: string;
  ok?: string;
}

export async function actualizarPrecio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await getSession();
    if (!session || session.rol !== "ADMINISTRADOR") {
      return { error: "Solo el administrador puede modificar precios." };
    }

    const productoId = String(formData.get("productoId") ?? "");
    const precioCosto = Math.trunc(Number(formData.get("precioCosto") ?? -1));
    const precioVenta = Math.trunc(Number(formData.get("precioVenta") ?? -1));
    const precioAnteriorRaw = String(formData.get("precioAnterior") ?? "").trim();
    const precioAnterior = precioAnteriorRaw === "" ? null : Math.trunc(Number(precioAnteriorRaw));
    const codigoBarra = String(formData.get("codigoBarra") ?? "").trim() || null;
    const imagen = String(formData.get("imagen") ?? "").trim() || null;

    if (imagen && !imagen.startsWith("http") && !imagen.startsWith("/")) {
      return { error: "La imagen debe ser una URL (https://…) o ruta local (/productos/…)." };
    }

    if (!productoId || precioVenta <= 0 || precioCosto < 0) {
      return { error: "Ingresa precios válidos (venta mayor a 0)." };
    }
    if (precioAnterior !== null && precioAnterior <= precioVenta) {
      return { error: "El precio anterior (oferta) debe ser mayor al precio de venta." };
    }
    if (codigoBarra) {
      const duplicado = await prisma.producto.findUnique({ where: { codigoBarra } });
      if (duplicado && duplicado.id !== productoId) {
        return { error: `El código de barra ya está asignado a ${duplicado.nombre}.` };
      }
    }

    await prisma.producto.update({
      where: { id: productoId },
      data: { precioCosto, precioVenta, precioAnterior, codigoBarra, imagen },
    });

    revalidatePath("/dashboard/precios");
    return { ok: "Precio actualizado." };
  } catch {
    return { error: "Error al actualizar el precio." };
  }
}
