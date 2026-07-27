/** Reglas de arqueo compartidas por el POS, el cierre y los reportes. */

export type TipoMovCaja = "SANGRIA" | "INGRESO" | "GASTO";

export const TIPOS_MOV: { valor: TipoMovCaja; label: string; ayuda: string }[] = [
  { valor: "SANGRIA", label: "Sangría", ayuda: "Retiro de efectivo a la bóveda o al banco" },
  { valor: "GASTO", label: "Gasto", ayuda: "Pago menor hecho con dinero de la caja" },
  { valor: "INGRESO", label: "Ingreso", ayuda: "Aporte de efectivo a la caja" },
];

export const movLabel: Record<string, string> = Object.fromEntries(
  TIPOS_MOV.map((t) => [t.valor, t.label]),
);

/**
 * Efecto neto de los movimientos sobre el efectivo del turno.
 * El monto siempre se guarda positivo; el signo lo pone el tipo.
 */
export function saldoMovimientos(movs: { tipo: string; monto: number }[]): number {
  return movs.reduce((n, m) => n + (m.tipo === "INGRESO" ? m.monto : -m.monto), 0);
}

/** Lo que debería haber en la caja al cerrar. */
export function esperadoEnCaja(
  montoApertura: number,
  ventasEfectivo: number,
  movs: { tipo: string; monto: number }[],
): number {
  return montoApertura + ventasEfectivo + saldoMovimientos(movs);
}

/**
 * Bajo este monto una diferencia no se marca en rojo.
 *
 * Perseguir los $200 de un vuelto mal dado desgasta la relación con el equipo y no
 * recupera nada; además convierte el rojo en ruido y el equipo deja de mirarlo.
 */
export const TOLERANCIA_DESCUADRE = 1000;

export function esDescuadre(diferencia: number | null | undefined): boolean {
  return diferencia != null && Math.abs(diferencia) > TOLERANCIA_DESCUADRE;
}
