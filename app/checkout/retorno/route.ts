import { NextRequest, NextResponse } from "next/server";
import {
  anularPorAbandono,
  confirmarRetornoWebpay,
} from "@/features/checkout/actions";
import { urlSitio } from "@/lib/webpay";

/**
 * Punto de retorno de Webpay.
 *
 * Transbank devuelve al comprador de tres maneras y las tres aterrizan acá:
 *  · pago intentado (aprobado o rechazado) → POST/GET con `token_ws`;
 *  · comprador abandonó el formulario de pago → `TBK_TOKEN` (+ orden/sesión);
 *  · timeout en el formulario → solo `TBK_ORDEN_COMPRA`/`TBK_ID_SESION`.
 *
 * El commit y el descuento de stock viven en `confirmarRetornoWebpay`; esta ruta solo
 * traduce el retorno a un redirect. 303 a propósito: convierte el POST de Webpay en el
 * GET de la página de resultado.
 */
async function manejarRetorno(req: NextRequest): Promise<NextResponse> {
  const base = urlSitio();
  let params: URLSearchParams;
  if (req.method === "POST") {
    const form = await req.formData();
    params = new URLSearchParams();
    form.forEach((v, k) => params.set(k, String(v)));
  } else {
    params = req.nextUrl.searchParams;
  }

  const tokenWs = params.get("token_ws");
  const tbkToken = params.get("TBK_TOKEN");

  if (tokenWs) {
    const resultado = await confirmarRetornoWebpay(tokenWs);
    if (resultado.ok && resultado.pedidoId) {
      return NextResponse.redirect(`${base}/checkout/exito/${resultado.pedidoId}`, 303);
    }
    return NextResponse.redirect(
      `${base}/checkout/error?m=${resultado.motivo ?? "rechazado"}`,
      303,
    );
  }

  if (tbkToken) {
    await anularPorAbandono(tbkToken);
    return NextResponse.redirect(`${base}/checkout/error?m=abandono`, 303);
  }

  return NextResponse.redirect(`${base}/checkout/error?m=desconocido`, 303);
}

export async function GET(req: NextRequest) {
  return manejarRetorno(req);
}

export async function POST(req: NextRequest) {
  return manejarRetorno(req);
}
