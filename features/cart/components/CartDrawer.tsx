"use client";

import { useEffect, useRef } from "react";
import { cartTotal, useCart } from "../store";
import { formatCLP } from "@/lib/format";
import { buildOrderUrl } from "@/lib/whatsapp";

export interface CartLocal {
  id: string;
  nombre: string;
  comuna: string;
}

export function CartDrawer({ locales }: { locales: CartLocal[] }) {
  const { items, localId, isOpen, close, setQty, remove, setLocal } = useCart();
  const panelRef = useRef<HTMLDivElement>(null);
  const total = cartTotal(items);
  const local = locales.find((l) => l.id === localId) ?? locales[0];

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Carro de compras">
      <button
        type="button"
        aria-label="Cerrar carro"
        onClick={close}
        className="absolute inset-0 bg-navy-950/50 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-card outline-none"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-navy-950">Tu pedido</h2>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-cloud"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cloud text-2xl">🛒</div>
            <p className="text-slate-600">Tu carro está vacío.</p>
            <button
              type="button"
              onClick={close}
              className="font-semibold text-fenix-600 underline-offset-4 hover:underline"
            >
              Ver ofertas
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {items.map(({ product, qty }) => (
                <li key={product.sku} className="rounded-2xl border border-slate-200 bg-cloud/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-fenix-600">{product.marca}</p>
                      <p className="font-semibold text-navy-950">{product.nombre}</p>
                      <p className="mt-1 text-sm text-slate-600">{formatCLP(product.precioVenta)} c/u</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(product.sku)}
                      aria-label={`Quitar ${product.nombre}`}
                      className="text-sm text-slate-400 transition hover:text-electric-600"
                    >
                      Quitar
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center rounded-xl border border-slate-300 bg-white">
                      <button
                        type="button"
                        onClick={() => setQty(product.sku, qty - 1)}
                        aria-label="Disminuir cantidad"
                        className="h-11 w-11 text-lg text-navy-950 transition hover:bg-cloud"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-bold text-navy-950" aria-live="polite">{qty}</span>
                      <button
                        type="button"
                        onClick={() => setQty(product.sku, qty + 1)}
                        aria-label="Aumentar cantidad"
                        className="h-11 w-11 text-lg text-navy-950 transition hover:bg-cloud"
                      >
                        +
                      </button>
                    </div>
                    <p className="font-bold text-navy-950">{formatCLP(qty * product.precioVenta)}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-4 border-t border-slate-200 px-5 py-4">
              <div>
                <label htmlFor="local" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Local de retiro
                </label>
                <select
                  id="local"
                  value={local?.id ?? ""}
                  onChange={(e) => setLocal(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none focus:border-electric-500"
                >
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre} — {l.comuna}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between text-lg">
                <span className="text-slate-600">Total</span>
                <span className="font-bold text-navy-950">{formatCLP(total)}</span>
              </div>
              <a
                href={buildOrderUrl(
                  items.map((i) => ({
                    nombre: `${i.product.nombre} (${i.product.marca})`,
                    qty: i.qty,
                    subtotal: i.qty * i.product.precioVenta,
                  })),
                  local?.nombre ?? "tienda",
                  total,
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] font-bold text-white transition hover:opacity-90"
              >
                Pedir por WhatsApp
              </a>
              <p className="text-center text-xs text-slate-500">
                Confirmamos stock y te avisamos cuándo retirar. Sin pago online por ahora.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
