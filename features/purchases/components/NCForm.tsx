"use client";

import { useActionState, useState } from "react";
import { crearNotaCredito, type ActionState } from "../actions";

export interface LineaNC {
  productoId: string;
  nombre: string;
  maxDevolvible: number;
}

export function NCForm({ facturaId, lineas }: { facturaId: string; lineas: LineaNC[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(crearNotaCredito, {});
  const [cant, setCant] = useState<Record<string, number>>({});

  const efectivas = lineas
    .map((l) => ({ productoId: l.productoId, cantidad: cant[l.productoId] ?? 0 }))
    .filter((l) => l.cantidad > 0);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="facturaId" value={facturaId} />
      <input type="hidden" name="lineas" value={JSON.stringify(efectivas)} />

      <ul className="divide-y divide-slate-100">
        {lineas.map((l) => (
          <li key={l.productoId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
            <div>
              <p className="font-semibold text-navy-950">{l.nombre}</p>
              <p className="text-xs text-slate-500">Máx. devolvible: {l.maxDevolvible}</p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor={`nc-${l.productoId}`} className="text-xs font-semibold text-slate-600">
                Devolver
              </label>
              <input
                id={`nc-${l.productoId}`}
                type="number"
                min={0}
                max={l.maxDevolvible}
                value={cant[l.productoId] ?? 0}
                onChange={(e) =>
                  setCant((c) => ({
                    ...c,
                    [l.productoId]: Math.min(
                      l.maxDevolvible,
                      Math.max(0, Math.trunc(Number(e.target.value)) || 0),
                    ),
                  }))
                }
                className="h-10 w-24 rounded-lg border border-slate-300 bg-white text-center font-bold text-navy-950 outline-none focus:border-electric-500"
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <input
          name="motivo"
          required
          placeholder="Motivo de la devolución *"
          className="h-11 min-w-56 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <button
          type="submit"
          disabled={pending || efectivas.length === 0}
          className="h-11 rounded-xl border-2 border-fenix-600 px-5 font-bold text-fenix-600 transition hover:bg-fenix-600 hover:text-white disabled:opacity-40"
        >
          {pending ? "Registrando…" : "Registrar nota de crédito"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
      )}
    </form>
  );
}
