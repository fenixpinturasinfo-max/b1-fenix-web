"use client";

import { useActionState } from "react";
import { resolverSolicitud, type ActionState } from "../actions";

export function ResolverSolicitud({
  solicitudId,
  esProveedor = false,
}: {
  solicitudId: string;
  esProveedor?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    resolverSolicitud,
    {},
  );

  return (
    <div className="space-y-1.5">
      <div className="flex justify-end gap-1.5">
        <form action={action}>
          <input type="hidden" name="id" value={solicitudId} />
          <input type="hidden" name="accion" value="despachar" />
          <button
            type="submit"
            disabled={pending}
            className="h-8 whitespace-nowrap rounded-lg bg-electric-600 px-2.5 text-[11px] font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {esProveedor ? "✓ Recibida" : "✓ Despachar"}
          </button>
        </form>
        <form action={action}>
          <input type="hidden" name="id" value={solicitudId} />
          <input type="hidden" name="accion" value="rechazar" />
          <button
            type="submit"
            disabled={pending}
            className="h-8 whitespace-nowrap rounded-lg border border-slate-300 px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600 disabled:opacity-50"
          >
            Rechazar
          </button>
        </form>
      </div>
      {state.error && (
        <p role="alert" className="text-right text-xs font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-right text-xs font-semibold text-[#4d7c0f]">{state.ok}</p>
      )}
    </div>
  );
}
