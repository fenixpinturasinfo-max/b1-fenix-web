/**
 * Reglas de entrega de la tienda web.
 *
 * Tres caminos, decididos por la comuna que escribe el cliente:
 *  · RETIRO — gratis, en el local que elija;
 *  · DESPACHO_ANILLO — domicilio dentro del anillo de Santiago: tarifa fija que se
 *    cobra junto con los productos en Webpay;
 *  · DESPACHO_COURIER — fuera del anillo: el cliente elige courier y el envío va
 *    POR PAGAR al recibir. La web cobra solo los productos: así no hay que mantener
 *    tarifas de todo Chile ni integrar APIs de couriers.
 *
 * Vive en código a propósito (decisión del 2026-08-12): cambiar la tarifa o sumar una
 * comuna es editar estas constantes y desplegar. El servidor recalcula el envío con
 * estas mismas reglas al iniciar el pago — lo que muestra el navegador es cortesía.
 */

export type TipoEntregaWeb = "RETIRO" | "DESPACHO_ANILLO" | "DESPACHO_COURIER";

/** Tarifa del despacho dentro del anillo, CLP. */
export const TARIFA_ANILLO = 4990;

/** Couriers ofrecidos para fuera del anillo (envío por pagar). */
export const COURIERS = ["Starken", "Chilexpress", "Correos de Chile"] as const;

/**
 * Comunas del "anillo" de Santiago: Gran Santiago urbano (Provincia de Santiago más
 * San Bernardo, Puente Alto y alrededores donde la tienda reparte con vehículo propio).
 * En minúscula y sin tildes: se comparan con `normalizarComuna`.
 */
export const COMUNAS_ANILLO = [
  "santiago",
  "cerrillos",
  "cerro navia",
  "conchali",
  "el bosque",
  "estacion central",
  "huechuraba",
  "independencia",
  "la cisterna",
  "la florida",
  "la granja",
  "la pintana",
  "la reina",
  "las condes",
  "lo barnechea",
  "lo espejo",
  "lo prado",
  "macul",
  "maipu",
  "nunoa",
  "pedro aguirre cerda",
  "penalolen",
  "providencia",
  "pudahuel",
  "quilicura",
  "quinta normal",
  "recoleta",
  "renca",
  "san joaquin",
  "san miguel",
  "san ramon",
  "vitacura",
  "san bernardo",
  "puente alto",
  "buin",
  "calera de tango",
] as const;

/** "Ñuñoa " → "nunoa": minúscula, sin tildes ni espacios sobrantes. */
export function normalizarComuna(comuna: string): string {
  return comuna
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function comunaEnAnillo(comuna: string): boolean {
  return (COMUNAS_ANILLO as readonly string[]).includes(normalizarComuna(comuna));
}

export interface Envio {
  tipo: TipoEntregaWeb;
  /** Lo que se cobra en Webpay por el envío. 0 en retiro y en courier por pagar. */
  monto: number;
  /** true cuando el envío se paga al courier al recibir, no en la web. */
  porPagar: boolean;
}

/** La única fuente de verdad del costo de envío. El servidor la reevalúa al pagar. */
export function calcularEnvio(tipo: TipoEntregaWeb, comuna: string | null): Envio {
  if (tipo === "RETIRO") return { tipo, monto: 0, porPagar: false };
  if (tipo === "DESPACHO_ANILLO") {
    // Si la comuna no está en el anillo, este tipo no corresponde: quien llama debe
    // haber elegido DESPACHO_COURIER. Se cobra igual la tarifa para no regalar envíos
    // por un desajuste del formulario; el formulario decide el tipo por la comuna.
    return { tipo, monto: TARIFA_ANILLO, porPagar: false };
  }
  return { tipo: "DESPACHO_COURIER", monto: 0, porPagar: true };
}

/** Tipo de despacho que corresponde a una comuna dada. */
export function tipoDespachoPara(comuna: string): TipoEntregaWeb {
  return comunaEnAnillo(comuna) ? "DESPACHO_ANILLO" : "DESPACHO_COURIER";
}
