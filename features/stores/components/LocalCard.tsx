"use client";

import { useEffect, useState } from "react";
import { LocalForm, type LocalData } from "./LocalForm";
import { toggleLocalActivo } from "../actions";

export function LocalCard({
  local,
  usuarios,
  activo,
}: {
  local: LocalData;
  usuarios: number;
  activo: boolean;
}) {
  const [editing, setEditing] = useState(false);

  // Cerrar el modal con Escape
  useEffect(() => {
    if (!editing) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditing(false);
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [editing]);

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-electric-50 px-2 py-0.5 font-mono text-xs font-bold text-electric-600">
              {local.codigo}
            </span>
            <h2 className="text-lg font-bold text-navy-950">{local.nombre}</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                activo ? "bg-lime-400/15 text-[#4d7c0f]" : "bg-slate-100 text-slate-400"
              }`}
            >
              {activo ? "Activo" : "Inactivo"}
            </span>
            {local.esMatriz && (
              <span className="rounded-full bg-electric-50 px-2.5 py-0.5 text-xs font-bold text-electric-600">
                Casa matriz
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {local.direccion}, {local.comuna}
          </p>
          {local.horario && <p className="text-xs text-slate-400">{local.horario}</p>}
          <p className="mt-1 text-xs text-slate-400">{usuarios} usuarios asignados</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
          >
            Editar
          </button>
          <form action={toggleLocalActivo}>
            <input type="hidden" name="id" value={local.id} />
            <button
              type="submit"
              title={
                activo && usuarios > 0
                  ? "Reasigna sus usuarios antes de desactivar"
                  : undefined
              }
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600"
            >
              {activo ? "Desactivar" : "Activar"}
            </button>
          </form>
        </div>
      </div>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={() => setEditing(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Editar local ${local.nombre}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy-950">
                  ✏️ Editar local ·{" "}
                  <span className="font-mono text-electric-600">{local.codigo}</span>{" "}
                  {local.nombre}
                </h2>
                <p className="text-sm text-slate-500">
                  Los cambios se reflejan al instante en la tienda online y el POS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
              >
                ✕
              </button>
            </div>
            <LocalForm local={local} onDone={() => setEditing(false)} />
          </div>
        </div>
      )}
    </article>
  );
}
