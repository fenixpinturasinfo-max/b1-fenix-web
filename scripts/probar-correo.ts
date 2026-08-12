/**
 * Diagnóstico del envío por SMTP, sin pasar por la aplicación.
 *
 *   npm run correo:probar -- tu-correo@ejemplo.cl
 *
 * Imprime la configuración leída del .env y el error crudo del servidor si algo falla.
 * Ese error crudo (`[email] fallo SMTP: ...`) es el que sirve para diagnosticar: el
 * mensaje corto que ve el cajero esconde el detalle a propósito.
 */
import "dotenv/config";
import { enviarCorreo } from "../lib/email";

const destino = process.argv[2];

if (!destino) {
  console.error("Falta el destinatario.\n  npm run correo:probar -- tu-correo@ejemplo.cl");
  process.exit(1);
}

const clave = process.env.EMAIL_PASS?.replace(/\s+/g, "") ?? "";

console.log("Configuración leída de .env");
console.log("  EMAIL_USER      :", process.env.EMAIL_USER ?? "(no definido)");
console.log("  EMAIL_PASS      :", clave ? `${clave.length} caracteres` : "(no definido)");
console.log("  EMAIL_HOST      :", process.env.EMAIL_HOST ?? "(por defecto smtp.gmail.com)");
console.log("  EMAIL_PORT      :", process.env.EMAIL_PORT ?? "(por defecto 587)");
console.log("  EMAIL_FROM_NAME :", process.env.EMAIL_FROM_NAME ?? "(por defecto Pinturas Fenix)");

if (clave && clave.length !== 16) {
  console.log(
    `\n  ⚠️  Una contraseña de aplicación de Google tiene exactamente 16 caracteres; esta tiene ${clave.length}.`,
  );
}

console.log(`\nEnviando a ${destino}...\n`);

const resultado = await enviarCorreo({
  para: destino,
  asunto: "Prueba de envío · Pinturas Fenix",
  html: `<div style="font-family:Arial,sans-serif;">
    <h2>Funciona 🎉</h2>
    <p>Si estás leyendo esto, el SMTP de Pinturas Fenix quedó bien configurado.</p>
  </div>`,
});

if (resultado.ok) {
  console.log("✅ Enviado. Revisa la bandeja de entrada (y la carpeta de spam).");
} else {
  console.log("❌", resultado.error);
  console.log(
    "\nEl detalle real de Google aparece arriba, en la línea '[email] fallo SMTP'.\n" +
      "  · 535 ... BadCredentials  → la contraseña de aplicación no corresponde a EMAIL_USER,\n" +
      "                              fue revocada, o la cuenta no tiene verificación en 2 pasos.\n" +
      "  · 534 ... Please log in via your web browser → falta la contraseña de aplicación;\n" +
      "                              estás usando la clave normal de la cuenta.",
  );
  process.exit(1);
}
