"use server";

import { exigirEscritura } from "@/lib/auth/guards";
import { subirImagenADrive } from "@/lib/drive";

export interface SubidaFotoResultado {
  url?: string;
  error?: string;
}

const TIPOS_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
/** El navegador ya reduce a ~800 px; esto es un cinturón por si llega un original sin reducir. */
const MAX_BYTES = 4 * 1024 * 1024;

/** Nombre de archivo seguro para Drive: `SKU.jpg`, o el nombre del producto si no hay SKU. */
function nombreArchivo(base: string, mimeType: string): string {
  const limpio = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const stamp = new Date().toISOString().slice(0, 10);
  return `${limpio || "producto"}-${stamp}.${ext}`;
}

/**
 * Sube una foto a la carpeta Inventario de Drive y devuelve el link para `Producto.imagen`.
 * No toca la base: el formulario de producto guarda el link junto con el resto de la ficha,
 * así la subida sirve igual al crear (el producto aún no existe) y al editar.
 */
export async function subirFotoDrive(formData: FormData): Promise<SubidaFotoResultado> {
  try {
    await exigirEscritura("inventario.productos");

    const archivo = formData.get("archivo");
    const base = String(formData.get("nombre") ?? "").trim();
    if (!(archivo instanceof File) || archivo.size === 0) return { error: "Selecciona una imagen." };
    if (!TIPOS_PERMITIDOS.has(archivo.type)) return { error: "Formato no soportado: usa JPG, PNG o WebP." };
    if (archivo.size > MAX_BYTES) return { error: "La imagen pesa más de 4 MB. Prueba con una más pequeña." };

    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const subido = await subirImagenADrive(bytes, nombreArchivo(base, archivo.type), archivo.type);
    return { url: subido.url };
  } catch (e) {
    console.error("[fotos] subirFotoDrive:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("No autorizado")) return { error: "No tienes permiso para subir fotos." };
    if (msg.includes("no configurado")) return { error: "La subida a Drive no está configurada en este servidor." };
    if (msg.includes("invalid_grant")) return { error: "La autorización de Drive caducó: hay que volver a autorizar la cuenta." };
    return { error: "No se pudo subir la foto a Drive. Intenta de nuevo o pega el link manualmente." };
  }
}
