"use client";

import { useActionState, useEffect, useState } from "react";
import { registrarRetiro, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import {
  EditorLineas,
  nuevaLineaEditor,
  type ArticuloDoc,
  type LineaEditor,
} from "@/components/documento/EditorLineas";

export interface ProductoRetiro extends ArticuloDoc {
  precioVenta: number;
}

export interface ClienteCuenta {
  id: string;
  nombre: string;
  rut: string;
  descuentoPorcentaje: number;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

/**
 * Modal "＋ Nuevo retiro": el cliente con cuenta abierta se lleva mercadería ahora.
 *
 * A diferencia del pedido —que solo reserva— este documento **rebaja stock al enviarse**,
 * y el precio de cada línea queda congelado al de hoy. Por eso la grilla muestra el stock
 * y la proyección: lo que se anota acá sale de la estantería de verdad.
 */
export function RetiroNuevo({
  clientes,
  productos,
  locales,
  localFijo,
  stocks,
  clienteInicial,
}: {
  /** Solo clientes con cuenta abierta activada en la ficha. */
  clientes: ClienteCuenta[];
  productos: ProductoRetiro[];
  locales: { id: string; nombre: string }[];
  localFijo: string | null;
  /** stock disponible: productoId → localId → cantidad */
  stocks: Record<string, Record<string, number>>;
  /** Preselección cuando se abre desde la cuenta de un cliente. */
  clienteInicial?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(registrarRetiro, {});
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [localId, setLocalId] = useState(localFijo ?? locales[0]?.id ?? "");
  const [lineas, setLineas] = useState<LineaEditor[]>([nuevaLineaEditor()]);

  useEffect(() => {
    if (state.ok) setLineas([nuevaLineaEditor()]);
  }, [state.ok]);

  useEffect(() => {
    if (!abierto) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [abierto]);

  const porId = new Map(productos.map((p) => [p.id, p]));
  const precioDe = (p: ArticuloDoc) => ({
    valor: porId.get(p.id)?.precioVenta ?? 0,
    etiqueta: "Venta",
  });

  const origen = localFijo ?? localId;
  const stockDe = (productoId: string) => stocks[productoId]?.[origen] ?? 0;
  const excede = (l: LineaEditor) =>
    l.productoId != null && stockDe(l.productoId) < l.cantidad;

  const completas = lineas.filter((l) => l.productoId);
  const conError = completas.filter(excede);
  const total = completas.reduce((t, l) => t + l.cantidad * l.precio, 0);
  const payload = completas.map((l) => ({ productoId: l.productoId!, cantidad: l.cantidad }));
  const clienteSel = clientes.find((c) => c.id === clienteId);

  const puedeEnviar =
    !pending && !!clienteId && completas.length > 0 && conError.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-flame h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
      >
        ＋ Nuevo retiro
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={() => setAbierto(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo retiro a cuenta"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-950">＋ Nuevo retiro a cuenta</h3>
                <p className="text-sm text-slate-500">
                  El cliente se lleva la mercadería ahora y paga al cierre del período.{" "}
                  <b>El stock sale de inmediato</b> y el precio queda congelado al de hoy.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
              >
                ✕
              </button>
            </div>

            <form action={action} className="space-y-4">
              <input type="hidden" name="lineas" value={JSON.stringify(payload)} />
              <input type="hidden" name="clienteId" value={clienteId} />
              <input type="hidden" name="localId" value={origen} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="rc-cli" className="mb-1 block text-sm font-semibold text-slate-700">
                    Cliente con cuenta abierta *
                  </label>
                  <select
                    id="rc-cli"
                    required
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className={input}
                  >
                    <option value="">— Selecciona cliente —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                  {clienteSel ? (
                    <p className="mt-1 text-xs text-slate-500">
                      <span className="font-mono">{clienteSel.rut}</span>
                      {clienteSel.descuentoPorcentaje > 0 &&
                        ` · ${clienteSel.descuentoPorcentaje}% pactado (se aplica al cobrar, no acá)`}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">
                      Solo aparecen fichas con “Cuenta abierta” activada en Socios.
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="rc-local" className="mb-1 block text-sm font-semibold text-slate-700">
                    Local que entrega *
                  </label>
                  {localFijo ? (
                    <input
                      disabled
                      value={locales.find((l) => l.id === localFijo)?.nombre ?? ""}
                      className={`${input} bg-cloud text-slate-500`}
                    />
                  ) : (
                    <select
                      id="rc-local"
                      value={localId}
                      onChange={(e) => setLocalId(e.target.value)}
                      className={input}
                    >
                      {locales.map((l) => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-xs text-slate-400">De acá sale el stock, ahora.</p>
                </div>
              </div>

              <EditorLineas
                productos={productos}
                lineas={lineas}
                onChange={setLineas}
                precioDe={precioDe}
                stockDe={stockDe}
                proyeccionDe={(l) =>
                  l.productoId
                    ? { valor: stockDe(l.productoId) - l.cantidad, excede: excede(l) }
                    : null
                }
                avisoDe={(l) =>
                  excede(l)
                    ? `stock insuficiente: ${stockDe(l.productoId!)} disponible${stockDe(l.productoId!) === 1 ? "" : "s"}`
                    : null
                }
                etiquetaPrecio="Precio hoy"
                precioEditable={false}
              />

              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
                <input
                  name="nota"
                  placeholder="Nota (ej: obra Los Aromos, retira Juan)"
                  className="h-11 min-w-48 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
                />
                <span className="text-sm text-slate-500">
                  Total retiro:{" "}
                  <b className="text-lg tabular-nums text-navy-950">{formatCLP(total)}</b>
                </span>
                <button
                  type="submit"
                  disabled={!puedeEnviar}
                  className="bg-flame h-12 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {pending ? "Registrando…" : `Registrar retiro (${completas.length})`}
                </button>
                {state.error && (
                  <p role="alert" className="w-full text-sm font-semibold text-fenix-600">{state.error}</p>
                )}
                {state.ok && (
                  <p role="status" className="w-full text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
