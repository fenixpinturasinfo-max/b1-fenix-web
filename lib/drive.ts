/**
 * Subida de fotos de producto a Google Drive, en nombre de la cuenta de Fénix.
 *
 * No usa el SDK de Google (pesa ~10 MB y no aporta nada acá): son dos llamadas HTTP.
 *
 *   1. Con el refresh token (autorizado una sola vez con `npm run drive:autorizar`) se
 *      pide un access token de corta vida a oauth2.googleapis.com.
 *   2. Se sube el archivo con `uploadType=multipart` dentro de la carpeta Inventario.
 *
 * Como la carpeta está compartida como "Cualquier persona con el enlace", el archivo
 * hereda el permiso; igual se fija explícitamente (idempotente) por si alguien cambia
 * el permiso de la carpeta más adelante: la foto del catálogo tiene que seguir visible.
 *
 * Variables de entorno (ver .env.example):
 *   GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN,
 *   GOOGLE_DRIVE_FOLDER_ID
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";

/** Alcance pedido al autorizar: acceso completo al Drive de la cuenta que autoriza. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

interface ConfigDrive {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

function leerConfig(): ConfigDrive | null {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !folderId) return null;
  return { clientId, clientSecret, refreshToken, folderId };
}

/** `true` si las cuatro variables están definidas (para mostrar u ocultar el botón). */
export function driveConfigurado(): boolean {
  return leerConfig() !== null;
}

/** Access token de ~1 hora. Se pide en cada subida: es una llamada barata y evita cachés con estado. */
async function accessToken(cfg: ConfigDrive): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !data.access_token) {
    // `invalid_grant` = el refresh token fue revocado o caducó (app OAuth en modo "Prueba"
    // caduca a los 7 días): hay que volver a correr `npm run drive:autorizar`.
    throw new Error(`[drive] token: ${data.error ?? res.status} ${data.error_description ?? ""}`.trim());
  }
  return data.access_token;
}

export interface ArchivoSubido {
  id: string;
  nombre: string;
  /** Link canónico que se guarda en `Producto.imagen`. */
  url: string;
}

/**
 * Sube una imagen a la carpeta Inventario y la deja visible con enlace.
 * `bytes` ya viene reducido desde el navegador (máx. ~800 px), acá no se procesa.
 */
export async function subirImagenADrive(
  bytes: Uint8Array,
  nombre: string,
  mimeType: string,
): Promise<ArchivoSubido> {
  const cfg = leerConfig();
  if (!cfg) throw new Error("[drive] no configurado: faltan variables GOOGLE_DRIVE_*");

  const token = await accessToken(cfg);
  const boundary = `fenix-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const metadata = JSON.stringify({ name: nombre, parents: [cfg.folderId], mimeType });

  const enc = new TextEncoder();
  const head = enc.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = enc.encode(`\r\n--${boundary}--`);
  const body = new Uint8Array(head.length + bytes.length + tail.length);
  body.set(head, 0);
  body.set(bytes, head.length);
  body.set(tail, head.length + bytes.length);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`[drive] subida: ${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const creado = (await res.json()) as { id: string; name: string };

  // Visible para cualquiera con el enlace. Si la carpeta ya lo da, Drive responde 200 igual.
  const perm = await fetch(`${FILES_URL}/${creado.id}/permissions?fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
    cache: "no-store",
  });
  if (!perm.ok) {
    // La foto quedó subida; si el permiso falló y la carpeta es pública igual se verá.
    console.error(`[drive] permiso público: ${perm.status} ${(await perm.text()).slice(0, 300)}`);
  }

  return { id: creado.id, nombre: creado.name, url: `https://drive.google.com/file/d/${creado.id}/view` };
}
