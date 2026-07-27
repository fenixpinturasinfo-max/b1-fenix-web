"use client";

import { useActionState, useEffect, useState } from "react";
import { crearPedido, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import {
  EditorLineas,
  nuevaLineaEditor,
  type ArticuloDoc,
  type LineaEditor,
} from "@/components/documento/EditorLineas";

export interface ProductoPedido extends ArticuloDoc {
  precioVenta: number;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

const fmtDoc = new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" });

export function PedidoForm({
  clientes,
  productos,
  locales,
  localFijo,
  stocks,
}: {
  clientes: { id: string; nombre: string; telefono: string | null }[];
  productos: ProductoPedido[];
  locales: { id: string; nombre: string; direccion: string; comuna: string }[];
  localFijo: string | null;
  /** stock disponible: productoId → localId → cantidad */
  stocks: Record<string, Record<string, number>>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(crearPedido, {});
  const [clienteId, setClienteId] = useState("");
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

  const completas = lineas.filter((l) => l.productoId);
  const total = completas.reduce((t, l) => t + l.cantidad * l.precio, 0);
  const payload = completas.map((l) => ({ productoId: l.productoId!, cantidad: l.cantidad }));

  const clienteSel = clientes.find((c) => c.id === clienteId);
  const localSel = locales.find((l) => l.id === (localFijo ?? localId));

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-flame h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
      >
        ＋ Nuevo pedido
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
            aria-label="Nuevo pedido de cliente"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-950">＋ Nuevo pedido de cliente</h3>
                <p className="text-sm text-slate-500">
                  Reserva el pedido para retiro en local. El cobro y descuento de stock se hacen
                  en el POS al entregar.
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

              {/* Cabecera del documento */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label htmlFor="pd-cli" className="mb-1 block text-sm font-semibold text-slate-700">
                    Cliente (ficha)
                  </label>
                  <select
                    id="pd-cli"
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className={input}
                  >
                    <option value="">— Cliente de paso —</option>
                    {clientes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="pd-local" className="mb-1 block text-sm font-semibold text-slate-700">
                    Retiro en
                  </label>
                  {localFijo ? (
                    <input disabled value={localSel?.nombre ?? ""} className={`${input} bg-cloud text-slate-500`} />
                  ) : (
                    <select
                      id="pd-local"
                      name="localId"
                      value={localId}
                      onChange={(e) => setLocalId(e.target.value)}
                      className={input}
                    >
                      {locales.map((l) => (
                        <option key={l.id} value={l.id}>{l.nombre}</option>
                      ))}
                    </select>
                  )}
                  {localSel && (
                    <p className="mt-1 text-xs text-slate-500">📍 {localSel.direccion}, {localSel.comuna}</p>
                  )}
                </div>
                {!clienteId ? (
                  <div>
                    <label htmlFor="pd-nombre" className="mb-1 block text-sm font-semibold text-slate-700">
                      Nombre del cliente *
                    </label>
                    <input id="pd-nombre" name="nombreCliente" required placeholder="Juan Pérez" className={input} />
                  </div>
                ) : (
                  <div>
                    <span className="mb-1 block text-sm font-semibold text-slate-700">Fecha documento</span>
                    <p className="flex h-11 items-center rounded-xl border border-slate-200 bg-cloud/60 px-3 text-sm font-semibold text-slate-500">
                      {fmtDoc.format(new Date())}
                    </p>
                  </div>
                )}
                <div>
                  <label htmlFor="pd-fono" className="mb-1 block text-sm font-semibold text-slate-700">
                    Teléfono
                  </label>
                  <input
                    id="pd-fono"
                    name="telefono"
                    defaultValue={clienteSel?.telefono ?? ""}
                    placeholder="+56 9 …"
                    className={input}
                  />
                </div>
              </div>

              {/* Líneas del documento (grilla estándar) */}
              <EditorLineas
                productos={productos}
                lineas={lineas}
                onChange={setLineas}
                precioDe={precioDe}
                stockDe={(id) => stocks[id]?.[localFijo ?? localId] ?? 0}
                etiquetaPrecio="Precio venta"
                precioEditable={false}
              />

              {/* Total + envío */}
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
                <input
                  name="nota"
                  placeholder="Nota (ej: retira el viernes)"
                  className="h-11 min-w-48 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
                />
                <span className="text-sm text-slate-500">
                  Total (IVA incl.):{" "}
                  <b className="text-lg tabular-nums text-navy-950">{formatCLP(total)}</b>
                </span>
                <button
                  type="submit"
                  disabled={pending || completas.length === 0}
                  className="bg-flame h-12 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                >
                  {pending ? "Creando…" : `Crear pedido (${completas.length})`}
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
