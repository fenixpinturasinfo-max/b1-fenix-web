/** Fuente única de roles para la UI de usuarios (espeja el enum Rol de Prisma). */

export const ROLES_OPCIONES = [
  { valor: "ADMINISTRADOR", label: "Administrador" },
  { valor: "GERENTE", label: "Gerente" },
  { valor: "JEFE_LOCAL", label: "Encargado de Local" },
  { valor: "VENDEDOR", label: "Vendedor" },
  { valor: "BODEGA", label: "Bodega" },
] as const;

export type RolValido = (typeof ROLES_OPCIONES)[number]["valor"];

export const ROLES: readonly RolValido[] = ROLES_OPCIONES.map((r) => r.valor);

/** Roles que no se asocian a un local específico (acceso global). */
export const SIN_LOCAL: string[] = ["ADMINISTRADOR", "GERENTE"];

export const rolLabel: Record<string, string> = Object.fromEntries(
  ROLES_OPCIONES.map((r) => [r.valor, r.label]),
);
