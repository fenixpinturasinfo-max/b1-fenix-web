"use client";

import { useActionState } from "react";
import { enviarCotizacion, type ActionState } from "../actions";

export function CotizacionCard({
  proveedorId,
  nombre,
  email,
  nPendientes,
}: {
  proveedorId: string;
  nombre: string;
  email: string | null;
  nPendientes: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    enviarCotizacion,
    {},
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="font-bold text-navy-950">🚚 {nombre}</p>
          <p className="text-xs text-slate-500">
            {nPendientes} producto{nPendientes === 1 ? "" : "s"} pendiente{nPendientes === 1 ? "" : "s"} de cotizar
          </p>
        </div>
      </div>
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="proveedorId" value={proveedorId} />
        <label htmlFor={`cot-${proveedorId}`} className="sr-only">Correo del proveedor</label>
        <input
          id={`cot-${proveedorId}`}
          name="email"
          type="email"
          required
          defaultValue={email ?? ""}
          placeholder="correo@proveedor.cl"
          className="h-10 min-w-44 flex-1 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 rounded-xl bg-electric-600 px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Enviando…" : "✉ Enviar cotización"}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="mt-2 text-xs font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="mt-2 text-xs font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
      )}
    </div>
  );
}
