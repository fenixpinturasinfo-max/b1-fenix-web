import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "./session";
import { puedeAcceder, type Modulo } from "./permissions";

/** Exige sesión activa y permiso sobre el módulo; si no, redirige. */
export async function requireModulo(modulo: Modulo): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!puedeAcceder(session.rol, modulo)) redirect("/dashboard");
  return session;
}
