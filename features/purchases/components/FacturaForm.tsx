"use client";

import { useActionState, useState } from "react";
import { facturarOC, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

export function FacturaForm({
  ocId,
  neto,
  hayPendientes,
}: {
  ocId: string;
  neto: number;
  hayPendientes: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(facturarOC, {});
  const [directa, setDirecta] = useState(false);
  const iva = Math.round(neto * 0.19);
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="ocId" value={ocId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="fc-numero" className="mb-1 block text-sm font-semibold text-slate-700">
            N° factura del proveedor *
          </label>
          <input
            id="fc-numero"
            name="numero"
            required
            placeholder="Ej: 45821"
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none focus:border-electric-500"
          />
        </div>
        <div>
          <label htmlFor="fc-fecha" className="mb-1 block text-sm font-semibold text-slate-700">
            Fecha de emisión
          </label>
          <input
            id="fc-fecha"
            name="fechaEmision"
            type="date"
            defaultValue={hoy}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none focus:border-electric-500"
          />
        </div>
        <div className="flex flex-col justify-end text-sm">
          <p className="text-slate-500">Neto {formatCLP(neto)} · IVA {formatCLP(iva)}</p>
          <p className="text-lg font-black tabular-nums text-navy-950">Total {formatCLP(neto + iva)}</p>
        </div>
      </div>

      {hayPendientes && (
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/10 p-3 text-sm">
          <input
            type="checkbox"
            name="recepcionDirecta"
            checked={directa}
            onChange={(e) => setDirecta(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#0e518d]"
          />
          <span className="text-slate-700">
            <b>Recepción directa:</b> esta OC tiene mercadería sin recepcionar. Al facturar, se
            recepcionará lo pendiente automáticamente (sube stock y recalcula costo promedio).
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Registrando…" : "Registrar factura"}
      </button>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
      )}
    </form>
  );
}
