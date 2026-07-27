"use client";

import { useEffect, useState } from "react";
import { LocalForm } from "./LocalForm";

/** Botón "＋ Nuevo local" que abre el formulario en modal (mismo patrón que Nuevo producto) */
export function NuevoLocalModal() {
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [abierto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-flame h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
      >
        ＋ Nuevo local
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={() => setAbierto(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo local"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy-950">＋ Nuevo local</h2>
                <p className="text-sm text-slate-500">
                  Las sucursales activas aparecen automáticamente en la tienda online, el carro y
                  el POS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
              >
                ✕
              </button>
            </div>
            <LocalForm onDone={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  );
}
