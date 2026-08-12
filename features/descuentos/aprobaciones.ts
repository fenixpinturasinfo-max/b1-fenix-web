/**
 * Tokens de los enlaces de aprobación por correo.
 *
 * Cuando un descuento supera lo que el cajero puede aplicar solo y no hay un supervisor
 * en el local, se envía un correo a cada persona con el permiso `ventas.descuento`. Los
 * botones del correo llevan un token firmado **personal**: dice qué solicitud resuelve,
 * quién la resuelve y en qué sentido (aprobar o rechazar). Así el clic no necesita
 * sesión —el gerente aprueba desde el teléfono sin loguearse— pero la resolución queda
 * a nombre de una persona concreta, no de "alguien que tenía el link".
 *
 * La audiencia propia impide que un token de estos sirva como cookie de sesión o como
 * vale de descuento, y viceversa: los tres se firman con el mismo AUTH_SECRET.
 *
 * El tradeoff aceptado: quien tenga acceso al buzón del gerente puede aprobar. Es la
 * comodidad que se pidió; el token expira junto con la solicitud y resuelve una sola
 * vez (el UPDATE condicionado en la base es la guarda real contra reuso).
 */
import { SignJWT, jwtVerify } from "jose";

/** Cuánto vive una solicitud esperando respuesta de gerencia. */
export const SOLICITUD_MINUTOS = 15;

const AUDIENCIA_APROBACION = "fenix:aprobacion-descuento";

export type AccionAprobacion = "APROBAR" | "RECHAZAR";

export interface TokenAprobacion {
  solicitudId: string;
  /** Usuario dueño del buzón al que se envió este enlace. */
  aprobadorId: string;
  accion: AccionAprobacion;
}

function secreto(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en las variables de entorno");
  return new TextEncoder().encode(s);
}

export async function firmarAprobacion(datos: TokenAprobacion): Promise<string> {
  return new SignJWT({ ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(AUDIENCIA_APROBACION)
    // Un margen sobre la vida de la solicitud: si el clic llega tarde, que el mensaje
    // sea "la solicitud expiró" (útil) y no "token inválido" (parece un error del sistema).
    .setExpirationTime(`${SOLICITUD_MINUTOS * 4}m`)
    .sign(secreto());
}

/** Devuelve `null` ante cualquier problema: firma inválida, vencido o payload incompleto. */
export async function verificarAprobacion(token: string): Promise<TokenAprobacion | null> {
  try {
    const { payload } = await jwtVerify<TokenAprobacion>(token, secreto(), {
      audience: AUDIENCIA_APROBACION,
    });
    if (!payload.solicitudId || !payload.aprobadorId) return null;
    if (payload.accion !== "APROBAR" && payload.accion !== "RECHAZAR") return null;
    return {
      solicitudId: payload.solicitudId,
      aprobadorId: payload.aprobadorId,
      accion: payload.accion,
    };
  } catch {
    return null;
  }
}

/**
 * URL pública de la aplicación, para armar los enlaces del correo.
 *
 * En Vercel `VERCEL_PROJECT_PRODUCTION_URL` viene sola; en desarrollo o en otro hosting
 * se define `APP_URL` en el .env. Sin ninguna de las dos, los enlaces apuntarían a
 * localhost y el gerente no podría abrirlos desde su teléfono: mejor avisar al enviar.
 */
export function urlBase(): string | null {
  const configurada = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configurada) return configurada;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return null;
}
