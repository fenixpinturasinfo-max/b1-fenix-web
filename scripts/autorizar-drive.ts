/**
 * Autorización ÚNICA de Google Drive con la cuenta de Fénix.
 *
 *   npm run drive:autorizar
 *
 * Requisitos previos (una vez, en https://console.cloud.google.com con la cuenta de Fénix):
 *   1. Crear un proyecto (ej. "B1 Fenix") y habilitar "Google Drive API".
 *   2. Pantalla de consentimiento OAuth: tipo Externo, agregar la cuenta de Fénix como
 *      usuario de prueba, y luego PUBLICAR la app (estado "En producción"). En modo
 *      "Prueba" el refresh token caduca a los 7 días y habría que repetir esto.
 *   3. Credenciales › Crear ID de cliente OAuth › tipo "Aplicación de escritorio".
 *      Copiar el ID y el secreto a GOOGLE_DRIVE_CLIENT_ID / GOOGLE_DRIVE_CLIENT_SECRET en .env.
 *
 * Este script abre la URL de autorización, recibe el código en http://localhost:53682 y
 * lo canjea por un refresh token, que imprime para pegarlo en GOOGLE_DRIVE_REFRESH_TOKEN
 * (en .env local y en las variables de entorno de Vercel).
 */
import "dotenv/config";
import { createServer } from "node:http";
import { DRIVE_SCOPE } from "../lib/drive";

const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
const PUERTO = 53682;
const REDIRECT = `http://localhost:${PUERTO}/callback`;

if (!clientId || !clientSecret) {
  console.error("Faltan GOOGLE_DRIVE_CLIENT_ID y/o GOOGLE_DRIVE_CLIENT_SECRET en .env");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: DRIVE_SCOPE,
    access_type: "offline",
    prompt: "consent", // fuerza a que Google devuelva refresh_token aunque ya se haya autorizado antes
  }).toString();

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", REDIRECT);
  if (url.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  if (error || !code) {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end(`Autorización rechazada: ${error}`);
    console.error("Autorización rechazada:", error);
    server.close();
    process.exit(1);
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const data = (await tokenRes.json()) as { refresh_token?: string; error?: string; error_description?: string };

  if (!data.refresh_token) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("No llegó refresh_token. Revisa la terminal.");
    console.error("Google no devolvió refresh_token:", data.error, data.error_description ?? "");
    server.close();
    process.exit(1);
  }

  res
    .writeHead(200, { "Content-Type": "text/html; charset=utf-8" })
    .end("<h2>Listo ✔</h2><p>Vuelve a la terminal y copia el refresh token a tu .env. Puedes cerrar esta pestaña.</p>");

  console.log("\nAutorización correcta. Agrega esto a .env (y a Vercel › Settings › Environment Variables):\n");
  console.log(`GOOGLE_DRIVE_REFRESH_TOKEN=${data.refresh_token}\n`);
  console.log("Recuerda también GOOGLE_DRIVE_FOLDER_ID (el ID que aparece en la URL de la carpeta Inventario).");
  server.close();
});

server.listen(PUERTO, () => {
  console.log("Abre esta URL en el navegador e inicia sesión con la cuenta de Fénix:\n");
  console.log(authUrl + "\n");
  console.log(`Esperando la respuesta de Google en ${REDIRECT} …`);
});
