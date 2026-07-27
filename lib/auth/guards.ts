import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { nivelDe, puedeVer, type Nivel } from "./permissions";

/**
 * Guards de sección.
 *
 * Ocultar un enlace del menú no es un permiso: cualquiera puede escribir la URL. Toda
 * página protegida pasa por `requireSeccion`, y toda Server Action que muta por
 * `exigirEscritura`.
 */

/** Exige sesión y que la sección esté visible para el perfil. */
export async function requireSeccion(seccion: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!(await puedeVer(session.rol, seccion))) redirect("/dashboard");
  return session;
}

/**
 * Igual que `requireSeccion`, pero además devuelve si el perfil puede modificar.
 * Úsalo cuando la página tiene botones de acción que hay que esconder en solo lectura.
 */
export async function requireSeccionConNivel(seccion: string): Promise<{
  session: SessionPayload;
  nivel: Nivel;
  escribe: boolean;
}> {
  const session = await getSession();
  if (!session) redirect("/login");
  const nivel = await nivelDe(session.rol, seccion);
  if (nivel === "SIN_ACCESO") redirect("/dashboard");
  return { session, nivel, escribe: nivel === "TOTAL" };
}

/**
 * Para Server Actions: exige permiso de escritura sobre la sección.
 * Lanza, porque las actions ya envuelven todo en try/catch y devuelven `{ error }`.
 */
export async function exigirEscritura(seccion: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");
  const nivel = await nivelDe(session.rol, seccion);
  if (nivel !== "TOTAL") throw new Error("No autorizado");
  return session;
}

/** Para Server Actions de solo consulta (exportar, ver detalle). */
export async function exigirLectura(seccion: string): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new Error("No autorizado");
  if (!(await puedeVer(session.rol, seccion))) throw new Error("No autorizado");
  return session;
}
