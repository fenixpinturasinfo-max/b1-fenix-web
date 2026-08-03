"use client";

import { useActionState, useState } from "react";
import { anularToma, type ActionState } from "../actions";

/**
 * Anula una toma tras confirmar en un modal.
 *
 * Aparece en el detalle y en la fila de la lista: la variante `compacta` es la de la tabla,
 * pero ambas abren el mismo diálogo. Una acción destructiva no se ejecuta con un solo clic,
 * y menos desde una fila donde el cursor pasa de largo.
 */
export function AnularTomaButton({
  tomaId,
  folio,
  estado,
  contadas,
  total,
  compacta = false,
}: {
  tomaId: string;
  folio: string;
  estado: "ABIERTA" | "CONTADA";
  /** líneas ya contadas: es el trabajo que se descarta */
  contadas: number;
  total: number;
  compacta?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(anularToma, {});

  const cerrar = () => {
    if (!pending) setAbierto(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label={`Anular toma ${folio}`}
        className={
          compacta
            ? "rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-fenix-600 hover:text-fenix-600"
            : "h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-fenix-600 hover:text-fenix-600"
        }
      >
        Anular
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={cerrar}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Anular toma ${folio}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"
          >
            <h3 className="text-lg font-bold text-navy-950">
              Anular <span className="font-mono">{folio}</span>
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              El stock no se modifica: anular descarta el conteo, no lo aplica.
              {estado === "CONTADA" &&
                " El conteo estaba cerrado esperando revisión, así que las diferencias detectadas se pierden."}
            </p>

            {contadas > 0 ? (
              <p className="mt-3 rounded-xl border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-3 py-2.5 text-sm font-semibold text-[#b45309]">
                Se descartan {contadas} de {total} línea{total === 1 ? "" : "s"} ya contada
                {contadas === 1 ? "" : "s"}. Ese trabajo no se puede recuperar: habría que
                abrir una toma nueva y volver a contar.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                Todavía no hay líneas contadas, así que no se pierde trabajo.
              </p>
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
                <input type="hidden" name="tomaId" value={tomaId} />
                <div>
                  <label
                    htmlFor={`motivo-${tomaId}`}
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    Motivo de la anulación *
                  </label>
                  <textarea
                    id={`motivo-${tomaId}`}
                    name="motivo"
                    rows={2}
                    required
                    minLength={5}
                    placeholder="Ej: se contó el pasillo equivocado / se abrió duplicada"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-950 outline-none transition focus:border-electric-500"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Queda registrado con tu nombre y la fecha en el historial de la toma.
                  </p>
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
