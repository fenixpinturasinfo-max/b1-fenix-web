"use client";

import { useActionState, useState } from "react";
import { registrarMovimiento, type ActionState } from "../actions";

interface Option {
  id: string;
  nombre: string;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function MovementForm({
  productos,
  locales,
  localFijo,
}: {
  productos: Option[];
  locales: Option[];
  localFijo: string | null; // id del local del usuario (null = admin elige)
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    registrarMovimiento,
    {},
  );
  const [tipo, setTipo] = useState("ENTRADA");

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="sm:col-span-2 lg:col-span-1">
        <label htmlFor="m-producto" className="mb-1 block text-sm font-semibold text-slate-700">Producto</label>
        <select id="m-producto" name="productoId" required className={input}>
          <option value="">— Selecciona —</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="m-tipo" className="mb-1 block text-sm font-semibold text-slate-700">Tipo</label>
        <select
          id="m-tipo"
          name="tipo"
          required
          className={input}
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
        >
          <option value="ENTRADA">Entrada (compra/recepción)</option>
          <option value="AJUSTE_POSITIVO">Ajuste + (sobra en conteo)</option>
          <option value="AJUSTE_NEGATIVO">Ajuste − (falta en conteo)</option>
          <option value="MERMA">Merma (daño/pérdida)</option>
          <option value="TRANSFERENCIA">Transferencia entre locales</option>
        </select>
      </div>

      <div>
        <label htmlFor="m-local" className="mb-1 block text-sm font-semibold text-slate-700">
          Local {tipo === "TRANSFERENCIA" ? "de origen" : ""}
        </label>
        {localFijo ? (
          <>
            <input type="hidden" name="localId" value={localFijo} />
            <input
              disabled
              value={locales.find((l) => l.id === localFijo)?.nombre ?? ""}
              className={`${input} bg-cloud text-slate-500`}
            />
          </>
        ) : (
          <select id="m-local" name="localId" required className={input}>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {tipo === "TRANSFERENCIA" && (
        <div>
          <label htmlFor="m-destino" className="mb-1 block text-sm font-semibold text-slate-700">Local de destino</label>
          <select id="m-destino" name="localDestinoId" required className={input}>
            <option value="">— Selecciona —</option>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>{l.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="m-cantidad" className="mb-1 block text-sm font-semibold text-slate-700">Cantidad</label>
        <input id="m-cantidad" name="cantidad" type="number" min={1} required className={input} />
      </div>

      <div>
        <label htmlFor="m-nota" className="mb-1 block text-sm font-semibold text-slate-700">Nota (opcional)</label>
        <input id="m-nota" name="nota" className={input} placeholder="Ej: factura #123" />
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="bg-flame h-11 w-full rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Registrando…" : "Registrar movimiento"}
        </button>
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
