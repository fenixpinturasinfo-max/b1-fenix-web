"use client";

import { useState } from "react";
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
            onClick={() => setEditing((v) => !v)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
          >
            {editing ? "Cerrar" : "Editar"}
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
        <div className="mt-5 border-t border-slate-200 pt-5">
          <LocalForm local={local} onDone={() => setEditing(false)} />
        </div>
      )}
    </article>
  );
}
