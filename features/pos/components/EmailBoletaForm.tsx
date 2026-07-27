"use client";

import { useActionState } from "react";
import { enviarBoletaEmail, type ActionState } from "../actions";

export function EmailBoletaForm({ ventaId }: { ventaId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    enviarBoletaEmail,
    {},
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="ventaId" value={ventaId} />
      <div className="flex gap-2">
        <label htmlFor={`email-${ventaId}`} className="sr-only">
          Correo del cliente
        </label>
        <input
          id={`email-${ventaId}`}
          name="email"
          type="email"
          required
          placeholder="correo@cliente.cl"
          className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 rounded-xl bg-electric-600 px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "✉ Enviar"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="text-xs font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-xs font-semibold text-[#4d7c0f]">{state.ok}</p>
      )}
    </form>
  );
}
