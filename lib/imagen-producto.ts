/**
 * Imágenes de producto alojadas en Google Drive.
 *
 * El campo `Producto.imagen` acepta tres formas: una ruta local (`/productos/laca.jpg`),
 * una URL directa a una imagen (`https://…/foto.jpg`) o el link "compartir" de un archivo
 * de Google Drive. En este último caso NO se descarga el archivo original (una foto de
 * celular pesa 3–5 MB): se usa el visor de miniaturas de Drive, que entrega la imagen ya
 * redimensionada al ancho pedido (~20–40 KB a 400 px).
 *
 * Requisito: el archivo (o la carpeta que lo contiene) debe estar compartido como
 * "Cualquier persona con el enlace → Lector". Si está restringido, Drive responde 403 y
 * la tarjeta vuelve al ícono genérico.
 */

/** Ancho por defecto de la miniatura (px). Las tarjetas del catálogo miden ~300 px. */
export const ANCHO_MINIATURA = 400;

const PATRONES_ID_DRIVE: RegExp[] = [
  // https://drive.google.com/file/d/<ID>/view?usp=sharing
  /drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/,
  // https://drive.google.com/open?id=<ID>  |  /uc?id=<ID>  |  /thumbnail?id=<ID>
  /drive\.google\.com\/(?:open|uc|thumbnail)\?(?:.*&)?id=([A-Za-z0-9_-]{10,})/,
  // https://drive.usercontent.google.com/download?id=<ID>
  /drive\.usercontent\.google\.com\/[^?]*\?(?:.*&)?id=([A-Za-z0-9_-]{10,})/,
  // https://lh3.googleusercontent.com/d/<ID>=w400
  /lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]{10,})/,
];

/** Extrae el ID de archivo de un link de Google Drive; `null` si no es un link de Drive. */
export function idDriveDesdeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const re of PATRONES_ID_DRIVE) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** URL de la miniatura liviana de Drive para un ID de archivo. */
export function urlMiniaturaDrive(id: string, ancho = ANCHO_MINIATURA): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${ancho}`;
}

/**
 * Resuelve el valor guardado en `Producto.imagen` a la URL que se pone en `<img src>`.
 * Links de Drive → miniatura redimensionada; cualquier otro valor se devuelve tal cual.
 */
export function urlImagenProducto(imagen: string | null | undefined, ancho = ANCHO_MINIATURA): string | null {
  if (!imagen) return null;
  const id = idDriveDesdeUrl(imagen);
  return id ? urlMiniaturaDrive(id, ancho) : imagen;
}

/**
 * Valida y normaliza lo que el usuario escribe en el campo Imagen (formulario o Excel).
 * Devuelve `{ valor }` listo para guardar o `{ error }` con el mensaje para el usuario.
 * Los links de Drive se guardan en su forma canónica (`…/file/d/<ID>/view`) para que
 * `?usp=sharing` u otros parámetros no generen filas "distintas" al recargar el Excel.
 */
export function normalizarImagenProducto(raw: string): { valor: string | null; error?: undefined } | { valor?: undefined; error: string } {
  const v = raw.trim();
  if (!v) return { valor: null };
  const id = idDriveDesdeUrl(v);
  if (id) return { valor: `https://drive.google.com/file/d/${id}/view` };
  if (v.startsWith("https://") || v.startsWith("http://") || v.startsWith("/")) return { valor: v };
  return { error: "La imagen debe ser un link de Google Drive, una URL (https://…) o una ruta local (/productos/…)." };
}
