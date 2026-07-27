"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

/**
 * Importación masiva de precios de venta desde CSV.
 * Recibe líneas ya parseadas [{sku, precioVenta}] y actualiza por SKU.
 */
export async function importarPrecios(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.precios-venta");

    let lineas: { sku: string; precioVenta: number }[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Archivo inválido." };
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "El archivo no tiene filas con precios." };
    }
    if (lineas.length > 1000) {
      return { error: "Máximo 1.000 filas por importación." };
    }

    const productos = await prisma.producto.findMany({
      select: { id: true, sku: true, precioVenta: true },
    });
    const porSku = new Map(productos.map((p) => [p.sku.toUpperCase(), p]));

    let sinCambio = 0;
    let noEncontrados = 0;
    // Consolidar cambios reales (1 por producto)
    const cambios = new Map<string, number>();
    for (const l of lineas) {
      const sku = String(l.sku ?? "").trim().toUpperCase();
      const precio = Math.trunc(Number(l.precioVenta));
      if (!sku || !Number.isFinite(precio) || precio <= 0) {
        noEncontrados++;
        continue;
      }
      const prod = porSku.get(sku);
      if (!prod) {
        noEncontrados++;
        continue;
      }
      if (prod.precioVenta === precio) {
        sinCambio++;
        continue;
      }
      cambios.set(prod.id, precio);
    }

    // Updates en paralelo por lotes (evita el timeout de transacción con Neon)
    const entradas = [...cambios.entries()];
    for (let i = 0; i < entradas.length; i += 10) {
      await Promise.all(
        entradas
          .slice(i, i + 10)
          .map(([id, precioVenta]) =>
            prisma.producto.update({ where: { id }, data: { precioVenta } }),
          ),
      );
    }
    const actualizados = cambios.size;

    revalidatePath("/dashboard/precios");
    revalidatePath("/");
    revalidatePath("/dashboard/pos"); // el POS cachea la grilla de precios
    return {
      ok: `${actualizados} precio${actualizados === 1 ? "" : "s"} actualizado${
        actualizados === 1 ? "" : "s"
      } · ${sinCambio} sin cambio${
        noEncontrados > 0 ? ` · ${noEncontrados} filas omitidas (SKU no encontrado o precio inválido)` : ""
      }.`,
    };
  } catch {
    return { error: "Error al importar los precios." };
  }
}

export async function actualizarPrecio(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.precios-venta");

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
    revalidatePath("/dashboard/pos"); // el POS cachea la grilla de precios
    revalidatePath("/");
    return { ok: "Precio actualizado." };
  } catch {
    return { error: "Error al actualizar el precio." };
  }
}
