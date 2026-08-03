"use client";

import { useActionState, useState } from "react";
import { anularOC, type ActionState } from "../actions";

export interface LineaPendienteOC {
  sku: string;
  nombre: string;
  pendiente: number;
}

export function AnularOCButton({
  ocId,
  pendientes,
}: {
  ocId: string;
  pendientes: LineaPendienteOC[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(anularOC, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600"
      >
        Anular OC
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={() => !pending && setAbierto(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Anular OC"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-navy-950">Anular OC</h3>

            {pendientes.length > 0 ? (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  Quedan {pendientes.length} línea{pendientes.length === 1 ? "" : "s"} sin recibir
                  por completo. Al anular se cancela ese saldo pendiente — lo que ya ingresó a
                  stock no se toca — y no vas a poder recepcionar más contra esta OC.
                </p>
                <ul className="mt-3 max-h-40 space-y-1.5 overflow-auto rounded-xl border border-slate-200 p-3 text-sm">
                  {pendientes.map((l) => (
                    <li key={l.sku} className="flex items-center justify-between gap-2">
                      <span className="text-slate-600">{l.nombre}</span>
                      <span className="font-bold text-fenix-600">{l.pendiente} pendiente{l.pendiente === 1 ? "" : "s"}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Esta OC no tiene recepciones registradas.</p>
            )}

            {state.ok ? (
              <div className="mt-4 space-y-3">
                <p role="status" className="text-sm font-semibold text-[#4d7c0f]">
                  ✅ {state.ok}
                </p>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="h-11 w-full rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form action={action} className="mt-4 space-y-3">
                <input type="hidden" name="id" value={ocId} />
                <div>
                  <label htmlFor="motivo-anular" className="mb-1 block text-sm font-semibold text-slate-700">
                    Motivo (opcional)
                  </label>
                  <textarea
                    id="motivo-anular"
                    name="motivo"
                    rows={2}
                    placeholder="Ej: el proveedor no despachará el resto del pedido"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-950 outline-none transition focus:border-electric-500"
                  />
                </div>
                {state.error && (
                  <p role="alert" className="text-sm font-semibold text-fenix-600">
                    {state.error}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={pending}
                    className="h-11 flex-1 rounded-xl bg-fenix-600 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pending ? "Anulando…" : "Confirmar anulación"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierto(false)}
                    disabled={pending}
                    className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 disabled:opacity-50"
                  >
                    Volver
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
