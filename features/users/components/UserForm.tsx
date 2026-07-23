"use client";

import { useActionState } from "react";
import { crearUsuario, type ActionState } from "../actions";

interface LocalOption {
  id: string;
  nombre: string;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function UserForm({ locales }: { locales: LocalOption[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(crearUsuario, {});

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="nombre" className="mb-1 block text-sm font-semibold text-slate-700">Nombre</label>
        <input id="nombre" name="nombre" required className={input} />
      </div>
      <div>
        <label htmlFor="u-email" className="mb-1 block text-sm font-semibold text-slate-700">Correo</label>
        <input id="u-email" name="email" type="email" required className={input} />
      </div>
      <div>
        <label htmlFor="u-pass" className="mb-1 block text-sm font-semibold text-slate-700">Contraseña inicial</label>
        <input id="u-pass" name="password" type="text" required minLength={8} className={input} placeholder="Mínimo 8 caracteres" />
      </div>
      <div>
        <label htmlFor="rol" className="mb-1 block text-sm font-semibold text-slate-700">Rol</label>
        <select id="rol" name="rol" required className={input} defaultValue="VENDEDOR">
          <option value="ADMINISTRADOR">Administrador</option>
          <option value="JEFE_LOCAL">Jefe de Local</option>
          <option value="VENDEDOR">Vendedor</option>
          <option value="BODEGA">Bodega</option>
        </select>
      </div>
      <div>
        <label htmlFor="localId" className="mb-1 block text-sm font-semibold text-slate-700">
          Local (no aplica para Administrador)
        </label>
        <select id="localId" name="localId" className={input} defaultValue="">
          <option value="">— Sin local —</option>
          {locales.map((l) => (
            <option key={l.id} value={l.id}>{l.nombre}</option>
          ))}
        </select>
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-flame h-11 w-full rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear usuario"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600 sm:col-span-2">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2">{state.ok}</p>
      )}
    </form>
  );
}
