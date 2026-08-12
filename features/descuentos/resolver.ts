import { puedeEscribir } from "@/lib/auth/permissions";
import {
  normalizarDescuento,
  tramoLibre,
  verificarVale,
  SECCION_DESCUENTO,
} from "@/lib/descuento";
import { topeDe } from "./topes";

/**
 * Decide si un descuento puede aplicarse, y a nombre de quién queda.
 *
 * ── Por qué acá y no al firmar el vale ──
 * El tramo libre es un porcentaje, así que depende de la base. Si se evaluara en el modal
 * de autorización, la base vendría del navegador: bastaría con declarar un carro de un
 * millón para que el 5% del cajero cubriera una venta de diez mil, y regalar la mercadería.
 * Por eso la decisión se toma acá, donde `base` ya viene recalculada desde la base de datos.
 *
 * ── El piso del cliente ──
 * `descuentoCliente` es lo que la ficha del cliente ya tiene pactado (su % sobre la base
 * real). Hasta ese piso no hay nada que autorizar: lo autorizó quien configuró la ficha.
 * Lo que se mide contra el tramo libre es solo el **excedente** sobre ese piso — eso es
 * lo que el cajero está regalando por su cuenta. Igual que la base, el piso debe venir
 * recalculado desde la BD, nunca del navegador.
 *
 * Cuatro formas de tener luz verde, en orden:
 *  1. que el monto quepa en el descuento pactado del cliente — sin autorizador;
 *  2. un vale firmado por alguien con el permiso — presencial o aprobado por correo—;
 *  3. tener el permiso uno mismo, sin vale de por medio;
 *  4. que el excedente sobre el piso quepa en el tramo libre del perfil.
 *
 * En los dos últimos el descuento queda a nombre de quien cobra: es quien responde por él.
 */
export interface DescuentoResuelto {
  /** Monto a aplicar, ya recortado contra la base. */
  descuento: number;
  /** Quién responde por el descuento. Null cuando no hubo, o cuando es el pactado del cliente. */
  autorizadorId: string | null;
}

export async function resolverDescuento(opts: {
  /** Base real, recalculada en el servidor. Nunca la que manda el navegador. */
  base: number;
  /** Monto pedido en el formulario. */
  pedido: number;
  /** Vale firmado que viaja con el formulario, si lo hubo. */
  vale: string;
  /** Quién está cobrando. */
  operador: { id: string; rol: string };
  /**
   * Descuento pactado en la ficha del cliente, en pesos sobre la base real.
   * 0 cuando la venta no tiene cliente con ficha.
   */
  descuentoCliente?: number;
}): Promise<{ ok: true; valor: DescuentoResuelto } | { ok: false; error: string }> {
  const { base, pedido, vale, operador } = opts;
  const piso = normalizarDescuento(base, opts.descuentoCliente ?? 0);

  // El descuento efectivo nunca baja del pactado: si el cajero no pidió nada (o pidió
  // menos), manda el del cliente. No se suman: se aplica el mayor de los dos.
  const objetivo = Math.max(pedido, piso);

  if (objetivo <= 0) {
    return { ok: true, valor: { descuento: 0, autorizadorId: null } };
  }

  const descuento = normalizarDescuento(base, objetivo);
  if (descuento <= 0) {
    return { ok: true, valor: { descuento: 0, autorizadorId: null } };
  }

  // 1. Dentro del pactado del cliente: pre-autorizado desde la ficha, sin autorizador.
  if (descuento <= piso) {
    return { ok: true, valor: { descuento, autorizadorId: null } };
  }

  // 2. Vale de un supervisor (presencial o aprobado por correo). Se verifica contra el
  //    monto **pedido**, que es el que se firmó: si entremedio se sacó un producto del
  //    carro, el vale sigue siendo válido y el recorte de arriba impide un total negativo.
  if (vale) {
    const firmado = await verificarVale(vale, pedido);
    if (firmado) {
      return { ok: true, valor: { descuento, autorizadorId: firmado.autorizadorId } };
    }
    return {
      ok: false,
      error: "La autorización del descuento venció o no es válida. Pídela de nuevo.",
    };
  }

  // 3. El permiso propio hace innecesario el vale.
  if (await puedeEscribir(operador.rol, SECCION_DESCUENTO)) {
    return { ok: true, valor: { descuento, autorizadorId: operador.id } };
  }

  // 4. Tramo libre del perfil, medido contra el excedente sobre el piso del cliente.
  const libre = tramoLibre(base, await topeDe(operador.rol));
  if (descuento - piso <= libre) {
    return { ok: true, valor: { descuento, autorizadorId: operador.id } };
  }

  const techo = piso + libre;
  return {
    ok: false,
    error:
      techo > 0
        ? `Sin autorización puedes descontar hasta ${techo.toLocaleString("es-CL")} pesos en esta venta.`
        : "Este descuento necesita la autorización de un supervisor.",
  };
}
