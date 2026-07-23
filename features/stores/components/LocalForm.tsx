"use client";

import { useActionState } from "react";
import { guardarLocal, type ActionState } from "../actions";

export interface LocalData {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string;
  comuna: string;
  horario: string | null;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function LocalForm({ local, onDone }: { local?: LocalData; onDone?: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(guardarLocal, {});

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {local && <input type="hidden" name="id" value={local.id} />}
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor={`codigo-${local?.id ?? "new"}`}>
          Código (para tickets, ej: SB)
        </label>
        <input
          id={`codigo-${local?.id ?? "new"}`}
          name="codigo"
          required
          maxLength={4}
          defaultValue={local?.codigo}
          placeholder="ML1"
          className={`${input} uppercase`}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor={`nombre-${local?.id ?? "new"}`}>
          Nombre
        </label>
        <input
          id={`nombre-${local?.id ?? "new"}`}
          name="nombre"
          required
          defaultValue={local?.nombre}
          placeholder="Fenix Melipilla"
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor={`direccion-${local?.id ?? "new"}`}>
          Dirección
        </label>
        <input
          id={`direccion-${local?.id ?? "new"}`}
          name="direccion"
          required
          defaultValue={local?.direccion}
          placeholder="Av. Principal #123"
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor={`comuna-${local?.id ?? "new"}`}>
          Comuna
        </label>
        <input
          id={`comuna-${local?.id ?? "new"}`}
          name="comuna"
          required
          defaultValue={local?.comuna}
          placeholder="Melipilla"
          className={input}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700" htmlFor={`horario-${local?.id ?? "new"}`}>
          Horario (opcional)
        </label>
        <input
          id={`horario-${local?.id ?? "new"}`}
          name="horario"
          defaultValue={local?.horario ?? ""}
          placeholder="Lun a Vie 9:00–18:30 · Sáb 9:30–14:00"
          className={input}
        />
      </div>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : local ? "Guardar cambios" : "Crear local"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600"
          >
            Cerrar
          </button>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600 sm:col-span-2 lg:col-span-3">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2 lg:col-span-3">
          {state.ok}
        </p>
      )}
    </form>
  );
}
