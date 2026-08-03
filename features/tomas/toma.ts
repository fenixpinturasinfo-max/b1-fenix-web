/** Reglas de la toma de inventario, compartidas por acciones, consultas y pantallas. */

export type EstadoToma = "ABIERTA" | "CONTADA" | "APLICADA" | "ANULADA";
export type AlcanceToma = "TOTAL" | "CATEGORIA" | "UBICACION" | "MARCA" | "ALTO_VALOR";
export type MotivoAjuste =
  | "MERMA"
  | "ROBO"
  | "ERROR_RECEPCION"
  | "ERROR_CONTEO"
  | "VENCIDO"
  | "OTRO";
export type OrigenLinea = "ALCANCE" | "AGREGADA_MANUAL" | "AGREGADA_IMPORT";
export type OrigenConteo = "MOVIL" | "PLANILLA";

export const ALCANCES: { valor: AlcanceToma; label: string; ayuda: string }[] = [
  {
    valor: "UBICACION",
    label: "Un pasillo o ubicación",
    ayuda: "Lo más práctico para contar cada semana sin parar el local",
  },
  {
    valor: "CATEGORIA",
    label: "Una categoría",
    ayuda: "Pinturas, solventes, accesorios…",
  },
  { valor: "MARCA", label: "Una marca", ayuda: "Útil cuando llega un proveedor" },
  {
    valor: "ALTO_VALOR",
    label: "Los de mayor valor",
    ayuda: "El 20% de los productos que concentra la mayor parte del capital",
  },
  {
    valor: "TOTAL",
    label: "Todo el local",
    ayuda: "Cierre anual. Conviene hacerlo con el local cerrado",
  },
];

export const alcanceLabel: Record<string, string> = Object.fromEntries(
  ALCANCES.map((a) => [a.valor, a.label]),
);

export const MOTIVOS: { valor: MotivoAjuste; label: string }[] = [
  { valor: "ERROR_CONTEO", label: "Error de conteo" },
  { valor: "MERMA", label: "Merma o daño" },
  { valor: "VENCIDO", label: "Producto vencido" },
  { valor: "ERROR_RECEPCION", label: "Error de recepción" },
  { valor: "ROBO", label: "Robo" },
  { valor: "OTRO", label: "Otro" },
];

export const motivoLabel: Record<string, string> = Object.fromEntries(
  MOTIVOS.map((m) => [m.valor, m.label]),
);

export const estadoToma: Record<EstadoToma, { label: string; cls: string }> = {
  ABIERTA: { label: "En conteo", cls: "bg-electric-50 text-electric-600" },
  CONTADA: { label: "Por revisar", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  APLICADA: { label: "Aplicada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  ANULADA: { label: "Anulada", cls: "bg-slate-100 text-slate-400" },
};

/** Etiqueta del origen de la línea. `ALCANCE` no se muestra: es el caso normal. */
export const origenLineaLabel: Record<OrigenLinea, string | null> = {
  ALCANCE: null,
  AGREGADA_MANUAL: "agregada",
  AGREGADA_IMPORT: "agregada en planilla",
};

export const origenConteoLabel: Record<OrigenConteo, string> = {
  MOVIL: "Contado en móvil",
  PLANILLA: "Importado de planilla",
};

/** Cuántos productos toma "los de mayor valor" */
export const TOP_ALTO_VALOR = 30;

/**
 * Días de antigüedad del conteo sobre los que conviene avisar al revisar.
 *
 * La corrección por movimientos posteriores funciona igual, pero cada día que pasa entre
 * el conteo y la revisión son más movimientos que hay que sumar de vuelta, y más chance
 * de que uno esté mal registrado.
 */
export const DIAS_CONTEO_ANTIGUO = 7;

/** Hora que se asume cuando en la planilla solo viene la fecha del conteo. */
export const HORA_CONTEO_POR_DEFECTO = 9;

/**
 * Sobre esta diferencia en unidades conviene recontar antes de aplicar.
 * No bloquea: el encargado decide, pero el aviso tiene que estar.
 */
export const UMBRAL_RECUENTO = 5;

/** Sobre este monto el motivo del ajuste deja de ser opcional. */
export const UMBRAL_MOTIVO = 20000;

/**
 * Cantidad a la que debe quedar el stock según lo contado.
 *
 * No es simplemente `contado`: entre que el bodeguero contó y que el encargado aplica,
 * el local pudo vender o recibir mercadería. Sin esta corrección, esas ventas aparecerían
 * como faltantes y el equipo concluiría que el sistema está malo.
 */
export function objetivoDeStock(contado: number, movimientosPosteriores: number): number {
  return contado + movimientosPosteriores;
}
