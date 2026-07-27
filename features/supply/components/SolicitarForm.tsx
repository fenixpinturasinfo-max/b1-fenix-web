"use client";

import { useActionState } from "react";
import { crearSolicitud, type ActionState } from "../actions";

export function SolicitarForm({
  productoId,
  localId,
  sugerido,
}: {
  productoId: string;
  localId: string;
  sugerido: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(crearSolicitud, {});

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="productoId" value={productoId} />
      <input type="hidden" name="localId" value={localId} />
      <label className="sr-only" htmlFor={`cant-${productoId}-${localId}`}>
        Cantidad a solicitar
      </label>
      <input
        id={`cant-${productoId}-${localId}`}
        name="cantidad"
        type="number"
        min={1}
        defaultValue={sugerido}
        className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-bold text-navy-950 outline-none focus:border-electric-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-electric-600 px-3 text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        title="Solicitar reposición a casa matriz"
      >
        {pending ? "Enviando…" : "Solicitar a matriz"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </button>
      {state.error && (
        <p role="alert" className="w-full text-right text-xs font-semibold text-fenix-600">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="w-full text-right text-xs font-semibold text-[#4d7c0f]">
          {state.ok}
        </p>
      )}
    </form>
  );
}
