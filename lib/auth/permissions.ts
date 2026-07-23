import type { SessionPayload } from "./session";

export type Modulo = "inventario" | "pos" | "usuarios" | "reportes" | "precios" | "locales";

const permisos: Record<SessionPayload["rol"], Modulo[]> = {
  ADMINISTRADOR: ["inventario", "pos", "precios", "locales", "usuarios", "reportes"],
  JEFE_LOCAL: ["inventario", "pos", "reportes"],
  VENDEDOR: ["pos"],
  BODEGA: ["inventario"],
};

export function puedeAcceder(rol: SessionPayload["rol"], modulo: Modulo): boolean {
  return permisos[rol].includes(modulo);
}

export function modulosDe(rol: SessionPayload["rol"]): Modulo[] {
  return permisos[rol];
}
