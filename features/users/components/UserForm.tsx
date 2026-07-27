"use client";

import { useActionState, useRef, useState } from "react";
import { crearUsuario, type ActionState } from "../actions";
import { ROLES_OPCIONES, SIN_LOCAL } from "../roles";

interface LocalOption {
  id: string;
  nombre: string;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function UserForm({
  locales,
  onChange,
  onDone,
}: {
  locales: LocalOption[];
  /** Se dispara ante cualquier edición (para el aviso de "datos sin guardar") */
  onChange?: () => void;
  /** Se dispara tras crear con éxito */
  onDone?: () => void;
}) {
  const [rol, setRol] = useState("VENDEDOR");
  const formRef = useRef<HTMLFormElement>(null);

  // Tras crear con éxito limpia el formulario, para poder encadenar altas
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await crearUsuario(prev, fd);
    if (res.ok) {
      formRef.current?.reset();
      setRol("VENDEDOR");
      onDone?.();
    }
    return res;
  }, {});

  const requiereLocal = !SIN_LOCAL.includes(rol);

  return (
    <form ref={formRef} action={action} onChange={onChange} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="u-nombre" className="mb-1 block text-sm font-semibold text-slate-700">
          Nombre *
        </label>
        <input id="u-nombre" name="nombre" required placeholder="María Pérez" className={input} />
      </div>
      <div>
        <label htmlFor="u-email" className="mb-1 block text-sm font-semibold text-slate-700">
          Correo *
        </label>
        <input
          id="u-email"
          name="email"
          type="email"
          required
          placeholder="maria@fenix.cl"
          className={input}
        />
      </div>
      <div>
        <label htmlFor="u-pass" className="mb-1 block text-sm font-semibold text-slate-700">
          Contraseña inicial *
        </label>
        <input
          id="u-pass"
          name="password"
          type="text"
          required
          minLength={8}
          className={input}
          placeholder="Mínimo 8 caracteres"
        />
      </div>
      <div>
        <label htmlFor="u-rol" className="mb-1 block text-sm font-semibold text-slate-700">
          Rol *
        </label>
        <select
          id="u-rol"
          name="rol"
          required
          className={input}
          value={rol}
          onChange={(e) => setRol(e.target.value)}
        >
          {ROLES_OPCIONES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="u-local" className="mb-1 block text-sm font-semibold text-slate-700">
          Local {requiereLocal ? "*" : "(no aplica para Administrador ni Gerente)"}
        </label>
        <select
          id="u-local"
          name="localId"
          className={`${input} disabled:bg-cloud disabled:text-slate-400`}
          defaultValue=""
          required={requiereLocal}
          disabled={!requiereLocal}
        >
          <option value="">— Sin local —</option>
          {locales.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creando…" : "Crear usuario"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600 sm:col-span-2">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2">
          ✅ {state.ok}
        </p>
      )}
    </form>
  );
}
