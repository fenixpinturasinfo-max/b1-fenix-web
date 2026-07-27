"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { crearSolicitudes, type ActionState } from "../actions";

export interface PedidoItem {
  productoId: string;
  localId: string;
  nombre: string;
  comuna: string;
  stock: number;
  stockMin: number;
  sugerido: number;
}

export function PedidoMatriz({ items }: { items: PedidoItem[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    crearSolicitudes,
    {},
  );
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [cant, setCant] = useState<Record<string, number>>(
    () => Object.fromEntries(items.map((i) => [i.productoId + i.localId, i.sugerido])),
  );

  // Limpiar selección tras envío exitoso
  useEffect(() => {
    if (state.ok) setSel(new Set());
  }, [state.ok]);

  const keyDe = (i: PedidoItem) => i.productoId + i.localId;
  const todos = sel.size === items.length && items.length > 0;

  const toggle = (k: string) =>
    setSel((s) => {
      const next = new Set(s);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const toggleTodos = () =>
    setSel(todos ? new Set() : new Set(items.map(keyDe)));

  const lineas = useMemo(
    () =>
      items
        .filter((i) => sel.has(keyDe(i)))
        .map((i) => ({
          productoId: i.productoId,
          localId: i.localId,
          cantidad: cant[keyDe(i)] ?? i.sugerido,
        })),
    [items, sel, cant],
  );

  const totalUnidades = lineas.reduce((n, l) => n + l.cantidad, 0);

  if (items.length === 0) {
    return <p className="py-4 text-sm text-slate-400">🎉 Nada por reponer.</p>;
  }

  return (
    <div>
      {/* Seleccionar todo */}
      <label className="mb-2 flex w-fit cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm font-semibold text-slate-600">
        <input
          type="checkbox"
          checked={todos}
          onChange={toggleTodos}
          className="h-4 w-4 accent-[#0e518d]"
        />
        Seleccionar todo ({items.length})
      </label>

      <ul className="divide-y divide-slate-100">
        {items.map((i) => {
          const k = keyDe(i);
          const activo = sel.has(k);
          return (
            <li
              key={k}
              className={`flex flex-wrap items-center gap-3 rounded-xl px-2 py-3 transition ${
                activo ? "bg-electric-50" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={activo}
                onChange={() => toggle(k)}
                aria-label={`Incluir ${i.nombre} en el pedido`}
                className="h-5 w-5 shrink-0 accent-[#0e518d]"
              />
              <button
                type="button"
                onClick={() => toggle(k)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate font-semibold text-navy-950">{i.nombre}</p>
                <p className="text-xs text-slate-500">
                  {i.comuna} · stock {i.stock} / mín {i.stockMin}
                </p>
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCant((c) => ({ ...c, [k]: Math.max(1, (c[k] ?? 1) - 1) }))}
                  aria-label="Disminuir cantidad"
                  className="h-9 w-9 rounded-lg border border-slate-300 font-bold text-navy-950 hover:bg-cloud"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={cant[k] ?? i.sugerido}
                  onChange={(e) =>
                    setCant((c) => ({ ...c, [k]: Math.max(1, Math.trunc(Number(e.target.value)) || 1) }))
                  }
                  aria-label={`Cantidad de ${i.nombre}`}
                  className="h-9 w-16 rounded-lg border border-slate-300 bg-white text-center text-sm font-bold text-navy-950 outline-none focus:border-electric-500"
                />
                <button
                  type="button"
                  onClick={() => setCant((c) => ({ ...c, [k]: (c[k] ?? 1) + 1 }))}
                  aria-label="Aumentar cantidad"
                  className="h-9 w-9 rounded-lg border border-slate-300 font-bold text-navy-950 hover:bg-cloud"
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Barra de envío */}
      <form
        action={action}
        className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-cloud/60 p-4"
      >
        <input type="hidden" name="lineas" value={JSON.stringify(lineas)} />
        <span className="text-sm font-semibold text-slate-500">🏠 Destino: casa matriz</span>
        <input
          name="nota"
          placeholder="Nota (opcional)"
          className="h-11 min-w-48 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <button
          type="submit"
          disabled={pending || lineas.length === 0}
          className="flex h-11 items-center gap-2 rounded-xl bg-electric-600 px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending
            ? "Enviando…"
            : `Enviar pedido (${lineas.length} producto${lineas.length === 1 ? "" : "s"} · ${totalUnidades} un.)`}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
        {state.error && (
          <p role="alert" className="w-full text-sm font-semibold text-fenix-600">{state.error}</p>
        )}
        {state.ok && (
          <p role="status" className="w-full text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
        )}
      </form>
    </div>
  );
}
