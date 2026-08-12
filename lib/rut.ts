/**
 * RUT chileno: normalización y validación de formato.
 *
 * Vive en lib/ porque lo usan dos mundos: la ficha de socios (al guardar) y el POS (al
 * buscar el cliente por RUT). Si cada uno normalizara a su manera, el mismo RUT escrito
 * "12.345.678-9" en la ficha y "12345678-9" en la caja no calzaría nunca.
 *
 * Solo valida el formato, no el dígito verificador: la ficha la escribe un administrador
 * mirando un documento, y rechazar un DV raro de un RUT antiguo molestaría más de lo que
 * protege. El formato canónico es sin puntos, con guion y K mayúscula.
 */
export function normalizarRut(rut: string): string | null {
  const limpio = rut.replace(/\./g, "").replace(/\s/g, "").toUpperCase();
  if (!/^\d{7,8}-[\dK]$/.test(limpio)) return null;
  return limpio;
}

/** "12345678-9" → "12.345.678-9", para mostrar. */
export function formatearRut(rut: string): string {
  const [cuerpo, dv] = rut.split("-");
  if (!dv) return rut;
  return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".")}-${dv}`;
}
