/**
 * Constantes compartidas entre la plantilla (.xlsx que se descarga) y la importación
 * (Server Action que la lee). Si cambian los encabezados, cambian en los dos lados.
 */

/** Encabezados de la hoja "Socios". Se buscan por texto exacto en la fila 1. */
export const COLUMNAS_SOCIOS = {
  rut: "RUT",
  razonSocial: "Razón social",
  nombreFantasia: "Nombre de fantasía",
  giro: "Giro",
  email: "Email",
  telefono: "Teléfono",
  direccion: "Dirección",
  comuna: "Comuna",
  condicionPago: "Condición de pago",
  descuento: "Descuento (%)",
  cuentaAbierta: "Cuenta abierta (Sí/No)",
} as const;

/** Lo que ve el usuario en el desplegable ↔ lo que guarda la ficha (`SocioNegocio.condicionPago`). */
export const CONDICIONES_PAGO = [
  { etiqueta: "Contado", valor: "CONTADO" },
  { etiqueta: "30 días", valor: "30D" },
  { etiqueta: "60 días", valor: "60D" },
  { etiqueta: "90 días", valor: "90D" },
] as const;

/** Acepta "30 días", "30D", "30", "contado"…; `undefined` si no se reconoce. */
export function condicionPagoDesdeTexto(texto: string): string | null | undefined {
  const t = texto.trim().toLowerCase();
  if (!t) return null;
  const exacta = CONDICIONES_PAGO.find((c) => c.etiqueta.toLowerCase() === t || c.valor.toLowerCase() === t);
  if (exacta) return exacta.valor;
  if (t.startsWith("cont")) return "CONTADO";
  const dias = t.match(/^(\d{2,3})/);
  if (dias) {
    const porDias = CONDICIONES_PAGO.find((c) => c.valor === `${dias[1]}D`);
    if (porDias) return porDias.valor;
  }
  return undefined;
}

/** RUT escrito en Excel: acepta sin guion (123456789 → 12345678-9) y con puntos. */
export function rutDesdeExcel(texto: string): string {
  const limpio = texto.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
  if (/^\d{8,9}$/.test(limpio) || /^\d{7,8}K$/.test(limpio)) {
    return `${limpio.slice(0, -1)}-${limpio.slice(-1)}`;
  }
  return limpio;
}
