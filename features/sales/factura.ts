/** Reglas de la factura de venta, compartidas por actions, consultas y pantallas. */

export const IVA = 0.19;

export type EstadoFacturaVenta = "ABIERTA" | "PAGADA" | "ANULADA";

export const estadoFacturaVenta: Record<EstadoFacturaVenta, { label: string; cls: string }> = {
  ABIERTA: { label: "Por cobrar", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  PAGADA: { label: "Pagada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  ANULADA: { label: "Anulada", cls: "bg-slate-100 text-slate-400" },
};

export const CONDICIONES_PAGO = [
  { valor: "CONTADO", label: "Contado", dias: 0 },
  { valor: "30D", label: "30 días", dias: 30 },
  { valor: "60D", label: "60 días", dias: 60 },
  { valor: "90D", label: "90 días", dias: 90 },
] as const;

export type CondicionPago = (typeof CONDICIONES_PAGO)[number]["valor"];

export const condicionPagoLabel: Record<string, string> = Object.fromEntries(
  CONDICIONES_PAGO.map((c) => [c.valor, c.label]),
);

export const esCondicionValida = (v: string): v is CondicionPago =>
  CONDICIONES_PAGO.some((c) => c.valor === v);

/**
 * Totales de la factura.
 *
 * **El precio de catálogo se toma como neto y el IVA se suma encima.** Es una decisión de
 * negocio, no un detalle técnico: implica que el mismo producto facturado sale 19% más
 * caro que comprado con boleta, donde `precioVenta` sí es IVA incluido. Por eso el total
 * de una factura creada desde un pedido no coincide con el total del pedido, y las
 * pantallas lo muestran explícito para que nadie se lleve la sorpresa al final.
 *
 * Si algún día se decide que el precio de lista ya trae IVA, el cambio es acá: el neto
 * pasaría a ser `Math.round(bruto / 1.19)` y ninguna otra parte del módulo se toca.
 */
export function totalesFactura(lineas: { cantidad: number; precioUnitario: number }[]) {
  const neto = lineas.reduce((n, l) => n + l.cantidad * l.precioUnitario, 0);
  const iva = Math.round(neto * IVA);
  return { neto, iva, total: neto + iva };
}

/** Vencimiento según la condición de pago. `null` cuando no se puede determinar. */
export function vencimientoDesde(fechaEmision: Date, condicion: string | null): Date | null {
  if (!condicion) return null;
  const c = CONDICIONES_PAGO.find((x) => x.valor === condicion);
  if (!c) return null;
  const v = new Date(fechaEmision);
  v.setDate(v.getDate() + c.dias);
  return v;
}

/** Días de atraso de una factura por cobrar. Negativo = todavía no vence. */
export function diasDeAtraso(fechaVencimiento: Date, hoy: Date): number {
  return Math.round((hoy.getTime() - fechaVencimiento.getTime()) / 86_400_000);
}
