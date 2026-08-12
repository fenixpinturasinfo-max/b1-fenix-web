/**
 * Webpay Plus (Transbank), envuelto para que el resto del código no conozca el SDK.
 *
 * Sin variables de entorno corre en INTEGRACIÓN con el comercio de prueba público de
 * Transbank: el flujo completo funciona con las tarjetas de prueba (VISA 4051 8856 0044
 * 6623, CVV 123, cualquier fecha; RUT 11.111.111-1, clave 123). Para producción basta
 * definir TBK_AMBIENTE=produccion junto con el código de comercio y la API key reales.
 *
 * Solo runtime Node (Server Actions y Route Handlers): el SDK usa axios/crypto.
 */
import {
  WebpayPlus,
  Options,
  Environment,
  IntegrationApiKeys,
  IntegrationCommerceCodes,
} from "transbank-sdk";

export interface RespuestaCommit {
  status?: string;
  response_code?: number;
  authorization_code?: string;
  card_detail?: { card_number?: string };
  amount?: number;
  buy_order?: string;
}

function opciones(): Options {
  const ambiente = process.env.TBK_AMBIENTE?.trim().toLowerCase();
  if (ambiente === "produccion") {
    const codigo = process.env.TBK_COMMERCE_CODE?.trim();
    const llave = process.env.TBK_API_KEY?.trim();
    if (!codigo || !llave) {
      throw new Error("TBK_AMBIENTE=produccion exige TBK_COMMERCE_CODE y TBK_API_KEY.");
    }
    return new Options(codigo, llave, Environment.Production);
  }
  return new Options(
    process.env.TBK_COMMERCE_CODE?.trim() || IntegrationCommerceCodes.WEBPAY_PLUS,
    process.env.TBK_API_KEY?.trim() || IntegrationApiKeys.WEBPAY,
    Environment.Integration,
  );
}

function transaccion() {
  return new WebpayPlus.Transaction(opciones());
}

/** Crea la transacción en Webpay. Devuelve el token y la URL a la que redirigir. */
export async function crearPagoWebpay(datos: {
  buyOrder: string;
  sessionId: string;
  monto: number;
  returnUrl: string;
}): Promise<{ token: string; url: string }> {
  const res = await transaccion().create(
    datos.buyOrder,
    datos.sessionId,
    datos.monto,
    datos.returnUrl,
  );
  return { token: res.token, url: res.url };
}

/** Confirma (commit) la transacción cuando Webpay devuelve al comprador. */
export async function confirmarPagoWebpay(token: string): Promise<RespuestaCommit> {
  return (await transaccion().commit(token)) as RespuestaCommit;
}

/** ¿El commit dice pago autorizado? */
export function pagoAutorizado(r: RespuestaCommit): boolean {
  return r.status === "AUTHORIZED" && r.response_code === 0;
}

/**
 * URL pública del sitio, para la returnUrl de Webpay.
 * A diferencia de los enlaces de correo, acá localhost sí sirve en desarrollo: Webpay
 * redirige el navegador del comprador, que está en la misma máquina.
 */
export function urlSitio(): string {
  const configurada = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configurada) return configurada;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
