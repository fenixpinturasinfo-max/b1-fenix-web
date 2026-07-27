"use client";

import { useActionState, useState } from "react";
import { recepcionarOC, type ActionState } from "../actions";

export interface LineaPendiente {
  lineaId: string;
  nombre: string;
  sku: string;
  pendiente: number;
}

export function RecepcionForm({
  ocId,
  lineas,
}: {
  ocId: string;
  lineas: LineaPendiente[];
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(recepcionarOC, {});
  const [cant, setCant] = useState<Record<string, number>>(
    () => Object.fromEntries(lineas.map((l) => [l.lineaId, l.pendiente])),
  );

  const recepciones = lineas
    .map((l) => ({ lineaId: l.lineaId, cantidad: cant[l.lineaId] ?? 0 }))
    .filter((r) => r.cantidad > 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ocId" value={ocId} />
      <input type="hidden" name="recepciones" value={JSON.stringify(recepciones)} />

      <ul className="divide-y divide-slate-100">
        {lineas.map((l) => (
          <li key={l.lineaId} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-semibold text-navy-950">{l.nombre}</p>
              <p className="text-xs text-slate-500">
                {l.sku} · pendiente: {l.pendiente}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`rec-${l.lineaId}`} className="text-xs font-semibold text-slate-600">
                Recibir
              </label>
              <input
                id={`rec-${l.lineaId}`}
                type="number"
                min={0}
                max={l.pendiente}
                value={cant[l.lineaId] ?? 0}
                onChange={(e) =>
                  setCant((c) => ({
                    ...c,
                    [l.lineaId]: Math.min(l.pendiente, Math.max(0, Math.trunc(Number(e.target.value)) || 0)),
                  }))
                }
                className="h-10 w-24 rounded-lg border border-slate-300 bg-white text-center font-bold text-navy-950 outline-none focus:border-electric-500"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
        <input
          name="numeroGuia"
          placeholder="N° guía de despacho (opcional)"
          className="h-11 min-w-48 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <button
          type="submit"
          disabled={pending || recepciones.length === 0}
          className="h-11 rounded-xl bg-electric-600 px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Recepcionando…" : `Recepcionar (${recepciones.reduce((n, r) => n + r.cantidad, 0)} un.)`}
        </button>
        {state.error && (
          <p role="alert" className="w-full text-sm font-semibold text-fenix-600">{state.error}</p>
        )}
        {state.ok && (
          <p role="status" className="w-full text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
        )}
      </div>
    </form>
  );
}
