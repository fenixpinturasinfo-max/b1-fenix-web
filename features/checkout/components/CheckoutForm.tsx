"use client";

import { useActionState, useEffect, useState } from "react";
import { cartTotal, useCart } from "@/features/cart/store";
import { formatCLP } from "@/lib/format";
import {
  calcularEnvio,
  comunaEnAnillo,
  tipoDespachoPara,
  COURIERS,
  TARIFA_ANILLO,
} from "@/lib/envio";
import { iniciarPagoWebpay, type PagoState } from "../actions";

export interface LocalCheckout {
  slug: string;
  nombre: string;
  comuna: string;
}

const input =
  "h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-navy-950 outline-none transition focus:border-electric-500";

const vacio: PagoState = {};

/**
 * Checkout de la tienda: datos de contacto, entrega y pago con Webpay.
 *
 * El costo de envío que se muestra sale de las mismas reglas (`lib/envio.ts`) que el
 * servidor vuelve a aplicar al iniciar el pago: la comuna decide sola si el despacho es
 * tarifa fija (anillo) o courier por pagar, sin que el comprador tenga que saber qué es
 * "el anillo". Al aprobar Webpay, el navegador se va con un POST del token; el carro
 * persiste en localStorage por si el banco rechaza y hay que reintentar.
 */
export function CheckoutForm({ locales }: { locales: LocalCheckout[] }) {
  const { items, localId, setLocal, clear } = useCart();
  const [state, action, pending] = useActionState<PagoState, FormData>(iniciarPagoWebpay, vacio);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipo, setTipo] = useState<"RETIRO" | "DESPACHO">("RETIRO");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [courier, setCourier] = useState<string>(COURIERS[0]);

  // Rehidratar el carro guardado (ver features/cart/store.ts).
  useEffect(() => {
    void useCart.persist.rehydrate();
  }, []);

  // Con la URL y el token de Webpay en la mano, el navegador se va a pagar: Webpay
  // espera un POST con token_ws, así que se arma un formulario y se envía solo.
  useEffect(() => {
    if (!state.url || !state.token) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = state.url;
    const campo = document.createElement("input");
    campo.type = "hidden";
    campo.name = "token_ws";
    campo.value = state.token;
    form.appendChild(campo);
    document.body.appendChild(form);
    form.submit();
  }, [state.url, state.token]);

  const totalProductos = cartTotal(items);
  const comunaLista = comuna.trim().length >= 3;
  const esAnillo = comunaLista && comunaEnAnillo(comuna);
  const envio =
    tipo === "RETIRO"
      ? calcularEnvio("RETIRO", null)
      : comunaLista
        ? calcularEnvio(tipoDespachoPara(comuna), comuna)
        : null;
  const totalPagar = totalProductos + (envio?.monto ?? 0);

  const localSel = locales.find((l) => l.slug === localId) ?? locales[0];
  const listoParaPagar =
    !pending &&
    items.length > 0 &&
    nombre.trim() !== "" &&
    email.trim() !== "" &&
    telefono.trim() !== "" &&
    (tipo === "RETIRO" ? !!localSel : direccion.trim() !== "" && comunaLista);

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
        <p className="text-3xl">🛒</p>
        <p className="mt-2 font-bold text-navy-950">Tu carro está vacío</p>
        <p className="mt-1 text-sm text-slate-500">Agrega productos desde el catálogo para comprar.</p>
        <a
          href="/"
          className="bg-flame mt-5 inline-block h-11 rounded-xl px-6 font-bold leading-[44px] text-white transition hover:opacity-90"
        >
          Ir al catálogo
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-5">
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(items.map((i) => ({ sku: i.product.sku, qty: i.qty })))}
      />
      <input type="hidden" name="tipoEntrega" value={tipo} />
      <input type="hidden" name="localSlug" value={localSel?.slug ?? ""} />
      {tipo === "DESPACHO" && !esAnillo && <input type="hidden" name="courier" value={courier} />}

      {/* Datos + entrega */}
      <div className="space-y-6 lg:col-span-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-navy-950">1 · Tus datos</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="ck-nombre" className="mb-1 block text-sm font-semibold text-slate-700">
                Nombre y apellido *
              </label>
              <input id="ck-nombre" name="nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="ck-email" className="mb-1 block text-sm font-semibold text-slate-700">
                Correo *
              </label>
              <input id="ck-email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="para tu comprobante" className={input} />
            </div>
            <div>
              <label htmlFor="ck-fono" className="mb-1 block text-sm font-semibold text-slate-700">
                Teléfono *
              </label>
              <input id="ck-fono" name="telefono" required value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="+56 9 …" className={input} />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold text-navy-950">2 · Entrega</h2>
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de entrega">
            {(
              [
                ["RETIRO", "🏬 Retiro en tienda", "Gratis · listo el mismo día hábil"],
                ["DESPACHO", "🚚 Despacho a domicilio", `${formatCLP(TARIFA_ANILLO)} en Santiago · courier por pagar a regiones`],
              ] as const
            ).map(([valor, titulo, detalle]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setTipo(valor)}
                aria-pressed={tipo === valor}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  tipo === valor ? "border-electric-600 bg-electric-50" : "border-slate-200 bg-white hover:border-electric-500/60"
                }`}
              >
                <span className="block font-bold text-navy-950">{titulo}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{detalle}</span>
              </button>
            ))}
          </div>

          {tipo === "RETIRO" ? (
            <div className="mt-4">
              <label htmlFor="ck-local" className="mb-1 block text-sm font-semibold text-slate-700">
                ¿Dónde retiras? *
              </label>
              <select
                id="ck-local"
                value={localSel?.slug ?? ""}
                onChange={(e) => setLocal(e.target.value)}
                className={input}
              >
                {locales.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.nombre} — {l.comuna}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="ck-dir" className="mb-1 block text-sm font-semibold text-slate-700">
                  Dirección *
                </label>
                <input id="ck-dir" name="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle, número, depto…" className={input} />
              </div>
              <div>
                <label htmlFor="ck-comuna" className="mb-1 block text-sm font-semibold text-slate-700">
                  Comuna *
                </label>
                <input id="ck-comuna" name="comuna" value={comuna} onChange={(e) => setComuna(e.target.value)} placeholder="Ej: San Bernardo" className={input} />
              </div>
              {comunaLista && (
                <div className="sm:col-span-2">
                  {esAnillo ? (
                    <p className="rounded-xl bg-lime-400/15 px-4 py-3 text-sm font-semibold text-[#4d7c0f]">
                      ✓ Repartimos en {comuna.trim()}: despacho {formatCLP(TARIFA_ANILLO)}, se paga junto con tu compra.
                    </p>
                  ) : (
                    <div className="space-y-2 rounded-xl bg-[#f59e0b]/10 px-4 py-3">
                      <p className="text-sm font-semibold text-[#b45309]">
                        {comuna.trim()} está fuera de nuestra zona de reparto: enviamos por courier y{" "}
                        <b>el envío lo pagas al recibir</b> (acá solo pagas los productos).
                      </p>
                      <label htmlFor="ck-courier" className="block text-xs font-semibold text-slate-600">
                        Courier de tu preferencia
                      </label>
                      <select id="ck-courier" value={courier} onChange={(e) => setCourier(e.target.value)} className={`${input} h-11`}>
                        {COURIERS.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Resumen + pagar */}
      <aside className="h-fit space-y-4 rounded-2xl border border-slate-200 bg-white p-6 lg:sticky lg:top-6 lg:col-span-2">
        <h2 className="text-lg font-bold text-navy-950">3 · Tu compra</h2>
        <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
          {items.map(({ product, qty }) => (
            <li key={product.sku} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-slate-600">
                {qty} × {product.nombre}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-navy-950">
                {formatCLP(qty * product.precioVenta)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Productos</dt>
            <dd className="tabular-nums text-navy-950">{formatCLP(totalProductos)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Envío</dt>
            <dd className="tabular-nums text-navy-950">
              {tipo === "RETIRO"
                ? "Gratis (retiro)"
                : !comunaLista
                  ? "— escribe tu comuna"
                  : envio && envio.monto > 0
                    ? formatCLP(envio.monto)
                    : "Por pagar al courier"}
            </dd>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
            <dt className="font-bold text-navy-950">Total a pagar</dt>
            <dd className="text-xl font-black tabular-nums text-navy-950">{formatCLP(totalPagar)}</dd>
          </div>
        </dl>

        {state.error && (
          <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={!listoParaPagar}
          className="h-14 w-full rounded-xl bg-[#6b2d87] text-lg font-black text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending || state.url ? "Conectando con Webpay…" : `Pagar ${formatCLP(totalPagar)} con Webpay`}
        </button>
        <p className="text-center text-xs text-slate-400">
          Pago seguro con tarjetas de débito y crédito vía Transbank. El stock se confirma
          antes de cobrar.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm("¿Vaciar el carro?")) clear();
          }}
          className="w-full text-center text-xs font-semibold text-slate-400 hover:text-fenix-600"
        >
          Vaciar carro
        </button>
      </aside>
    </form>
  );
}
