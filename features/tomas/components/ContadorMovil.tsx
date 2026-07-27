"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { contarLinea, type ActionState } from "../actions";
import type { LineaDetalle } from "../queries";
import { IconSearch } from "@/components/ui/icons";

/**
 * Conteo físico, para hacerse de pie con el teléfono en una mano.
 *
 * Un producto a la vez, no una lista: con una caja en la otra mano, una tabla de 40 filas
 * es imposible de operar sin equivocarse de renglón.
 *
 * Y sin mostrar el esperado. Ver el número del sistema mientras se cuenta hace que el
 * bodeguero confirme en vez de contar, que es el sesgo que anula el ejercicio completo.
 */
export function ContadorMovil({
  tomaId,
  folio,
  localNombre,
  descripcion,
  lineas,
  ciego,
}: {
  tomaId: string;
  folio: string;
  localNombre: string;
  descripcion: string;
  lineas: LineaDetalle[];
  ciego: boolean;
}) {
  const [query, setQuery] = useState("");
  const [valor, setValor] = useState("");
  const campo = useRef<HTMLInputElement>(null);

  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await contarLinea(prev, fd);
      if (res.ok) {
        setValor("");
        setQuery("");
        campo.current?.focus();
      }
      return res;
    },
    {},
  );

  const contadas = lineas.filter((l) => l.contado !== null).length;
  const pct = lineas.length > 0 ? Math.round((contadas / lineas.length) * 100) : 0;

  /** Pendientes primero; las saltadas al final, que es lo que "saltar" significa */
  const cola = useMemo(
    () =>
      lineas
        .filter((l) => l.contado === null)
        .sort((a, b) => Number(a.saltada) - Number(b.saltada)),
    [lineas],
  );

  const q = query.trim().toLowerCase();
  const porBusqueda = q
    ? lineas.find(
        (l) =>
          l.sku.toLowerCase() === q ||
          l.nombre.toLowerCase().includes(q) ||
          l.marca.toLowerCase().includes(q),
      )
    : null;

  // Lo buscado manda; si no, el siguiente de la cola
  const actual = porBusqueda ?? cola[0] ?? null;

  if (!actual) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <p className="rounded-2xl border border-lime-400/40 bg-lime-400/10 px-4 py-6 text-sm font-bold text-[#4d7c0f]">
          Contaste los {lineas.length} productos de esta toma.
        </p>
        <Link
          href={`/dashboard/inventario/tomas/${tomaId}`}
          className="bg-flame flex h-14 items-center justify-center rounded-xl px-6 text-base font-black text-white"
        >
          Revisar y cerrar el conteo
        </Link>
      </div>
    );
  }

  const numero =
    "h-20 w-full rounded-xl border-2 border-electric-500 bg-white text-center text-4xl font-black tabular-nums text-navy-950 outline-none";

  return (
    <div className="mx-auto max-w-md space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Link href={`/dashboard/inventario/tomas/${tomaId}`} className="text-electric-600">
          ←
        </Link>
        <span className="font-mono font-bold text-navy-950">{folio}</span>
        <span className="ml-auto text-slate-500">
          {contadas}/{lineas.length}
        </span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-cloud">
        <div className="h-full rounded-full bg-electric-600" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-slate-400">
        {localNombre} · {descripcion}
      </p>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <IconSearch size={16} />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escanea o busca un producto…"
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
      </div>

      <form
        key={actual.id}
        action={action}
        className="rounded-2xl border border-slate-200 bg-white p-4 text-center"
      >
        <input type="hidden" name="lineaId" value={actual.id} />

        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {actual.marca}
        </p>
        <p className="text-lg font-black leading-tight text-navy-950">{actual.nombre}</p>
        <p className="mb-3 text-xs text-slate-400">
          {actual.sku}
          {actual.ubicacion && ` · ${actual.ubicacion}`}
        </p>

        {!ciego && (
          <p className="mb-2 text-xs text-slate-400">El sistema tiene {actual.esperado}</p>
        )}

        <input
          ref={campo}
          name="contado"
          type="number"
          inputMode="numeric"
          min={0}
          required
          autoFocus
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          aria-label={`Cantidad contada de ${actual.nombre}`}
          className={numero}
        />

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setValor(String(Math.max(0, Number(valor || 0) - 1)))}
            aria-label="Restar uno"
            className="h-12 flex-1 rounded-xl border border-slate-300 text-xl font-black text-slate-600"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setValor(String(Number(valor || 0) + 1))}
            aria-label="Sumar uno"
            className="h-12 flex-1 rounded-xl border border-slate-300 text-xl font-black text-slate-600"
          >
            +
          </button>
        </div>

        {state.error && (
          <p role="alert" className="mt-2 text-sm font-semibold text-fenix-600">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-flame mt-3 h-14 w-full rounded-xl text-base font-black text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar y siguiente"}
        </button>
        <button
          type="submit"
          name="saltar"
          value="1"
          formNoValidate
          className="mt-2 h-11 w-full rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
        >
          Saltar por ahora
        </button>
      </form>

      <p className="text-center text-xs text-slate-400">
        Cada conteo se guarda al instante. Puedes cerrar y seguir después.
      </p>
    </div>
  );
}
