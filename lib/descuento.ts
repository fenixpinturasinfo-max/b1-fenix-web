/**
 * Descuento sobre el total, con autorización de un perfil habilitado.
 *
 * Reglas de cálculo y "vale" de autorización, compartidos por el POS y las facturas.
 *
 * ── Por qué un vale firmado ──
 * El cajero no tiene permiso para descontar: se lo autoriza un gerente tecleando sus
 * credenciales en la misma pantalla. Si esa autorización viajara al navegador como un
 * simple `true`, cualquiera con la consola abierta se autorizaría solo. En cambio el
 * servidor emite un token firmado, el cliente lo reenvía junto con la venta, y la Server
 * Action lo vuelve a verificar antes de aceptar el descuento.
 *
 * El vale queda atado al monto exacto: uno de $2.000 no sirve para descontar $200.000.
 * Dentro de su ventana de 5 minutos sí podría reusarse en otra venta del mismo monto —
 * evitarlo exigiría una tabla de vales gastados, y no parece que valga la pena: la
 * ventana es corta y toda venta con descuento registra quién lo autorizó.
 */
import { SignJWT, jwtVerify } from "jose";

/** Permiso que habilita a autorizar descuentos. Se configura en Configuración › Perfiles. */
export const SECCION_DESCUENTO = "ventas.descuento";

/** Ventana de validez del vale. Lo justo para cerrar la venta que se está cobrando. */
const VALE_MINUTOS = 5;

/**
 * Distingue estos tokens de los de sesión, que se firman con el mismo secreto.
 * Sin esto, una cookie de sesión robada serviría como vale de autorización.
 */
const AUDIENCIA_VALE = "fenix:descuento";

export interface ValeDescuento {
  autorizadorId: string;
  autorizadorNombre: string;
  /** Monto exacto autorizado, en pesos. */
  monto: number;
}

function secreto(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta AUTH_SECRET en las variables de entorno");
  return new TextEncoder().encode(s);
}

export async function firmarVale(vale: ValeDescuento): Promise<string> {
  return new SignJWT({ ...vale })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setAudience(AUDIENCIA_VALE)
    .setExpirationTime(`${VALE_MINUTOS}m`)
    .sign(secreto());
}

/**
 * Verifica el vale y que corresponda al monto que se está intentando descontar.
 * Devuelve `null` ante cualquier problema: firma inválida, vencido, o monto distinto.
 */
export async function verificarVale(
  token: string,
  montoEsperado: number,
): Promise<ValeDescuento | null> {
  try {
    const { payload } = await jwtVerify<ValeDescuento>(token, secreto(), {
      audience: AUDIENCIA_VALE,
    });
    if (payload.monto !== montoEsperado) return null;
    if (!payload.autorizadorId) return null;
    return {
      autorizadorId: payload.autorizadorId,
      autorizadorNombre: payload.autorizadorNombre,
      monto: payload.monto,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────── Cálculo ───────────────────────────

/**
 * Ajusta el descuento a un entero de pesos dentro de [0, base].
 *
 * Se recorta en vez de rechazar porque el borde natural —"descontar todo"— es legítimo,
 * y un total negativo nunca lo es. Las Server Actions validan igual antes de guardar.
 */
export function normalizarDescuento(base: number, monto: number): number {
  if (!Number.isFinite(monto) || monto <= 0) return 0;
  return Math.min(Math.round(monto), Math.max(0, Math.round(base)));
}

/** Monto en pesos que representa un porcentaje de la base. */
export function montoDesdePorcentaje(base: number, porcentaje: number): number {
  if (!Number.isFinite(porcentaje) || porcentaje <= 0) return 0;
  return normalizarDescuento(base, (base * porcentaje) / 100);
}

/**
 * Porcentaje que representa un monto sobre la base, con un decimal.
 * Es para mostrar: el dato que manda y se guarda siempre es el monto en pesos.
 */
export function porcentajeDesdeMonto(base: number, monto: number): number {
  if (base <= 0 || monto <= 0) return 0;
  return Math.round((monto / base) * 1000) / 10;
}

// ───────────────────────── Tramo libre ─────────────────────────

/**
 * Cuánto descuenta un perfil sin pedirle autorización a nadie.
 * Se configura por perfil en Configuración › Perfiles.
 */
export interface TopeLibre {
  /** Porcentaje de la base. 0 deja el tramo cerrado: siempre autoriza otro. */
  porcentaje: number;
  /** Techo en pesos. 0 = sin techo. */
  montoMaximo: number;
}

/** Perfil sin fila configurada: nace sin tramo libre. */
export const SIN_TRAMO_LIBRE: TopeLibre = { porcentaje: 0, montoMaximo: 0 };

/**
 * Techo en pesos que este perfil puede descontar solo, sobre una base dada.
 *
 * Cuando hay tope en porcentaje y en pesos mandan los dos y se aplica el menor: el
 * porcentaje es la regla, el monto es el freno para las ventas grandes. Se redondea hacia
 * abajo a propósito, para que el borde no regale un peso de más.
 *
 * Es una función pura y el navegador la usa para decidir si muestra los campos del
 * supervisor. Esa copia es solo comodidad: quien decide de verdad es el servidor, que la
 * vuelve a evaluar contra el total recalculado desde la base de datos.
 */
export function tramoLibre(base: number, tope: TopeLibre | null | undefined): number {
  if (!tope || tope.porcentaje <= 0) return 0;
  const techoBase = Math.max(0, Math.round(base));
  if (techoBase <= 0) return 0;
  const porPorcentaje = Math.floor((techoBase * tope.porcentaje) / 100);
  const conMonto =
    tope.montoMaximo > 0 ? Math.min(porPorcentaje, Math.round(tope.montoMaximo)) : porPorcentaje;
  return Math.max(0, Math.min(conMonto, techoBase));
}
