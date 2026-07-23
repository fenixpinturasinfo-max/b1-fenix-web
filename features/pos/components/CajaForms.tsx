"use client";

import { useActionState } from "react";
import { abrirCaja, cerrarCaja, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function AbrirCajaForm({
  locales,
  localFijo,
}: {
  locales: { id: string; nombre: string }[];
  localFijo: string | null;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(abrirCaja, {});

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-7">
      <h2 className="text-lg font-bold text-navy-950">Abrir caja</h2>
      <p className="mb-5 mt-1 text-sm text-slate-500">
        Para vender necesitas abrir tu caja con el efectivo inicial.
      </p>
      <form action={action} className="space-y-4">
        {localFijo ? (
          <input type="hidden" name="localId" value={localFijo} />
        ) : (
          <div>
            <label htmlFor="c-local" className="mb-1 block text-sm font-semibold text-slate-700">Local</label>
            <select id="c-local" name="localId" required className={input}>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>{l.nombre}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="c-monto" className="mb-1 block text-sm font-semibold text-slate-700">
            Efectivo inicial (CLP)
          </label>
          <input id="c-monto" name="montoApertura" type="number" min={0} required className={input} placeholder="Ej: 50000" />
        </div>
        {state.error && <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="bg-flame h-12 w-full rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Abriendo…" : "Abrir caja"}
        </button>
      </form>
    </div>
  );
}

export function CerrarCajaForm({
  cajaId,
  montoApertura,
  ventasEfectivo,
  totalVentas,
  nVentas,
}: {
  cajaId: string;
  montoApertura: number;
  ventasEfectivo: number;
  totalVentas: number;
  nVentas: number;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(cerrarCaja, {});
  const esperado = montoApertura + ventasEfectivo;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-bold text-navy-950">Cierre de caja / Arqueo</h2>
      <dl className="my-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Ventas del turno</dt>
          <dd className="font-bold text-navy-950">{nVentas} · {formatCLP(totalVentas)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Efectivo inicial</dt>
          <dd className="font-semibold text-navy-950">{formatCLP(montoApertura)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">Ventas en efectivo</dt>
          <dd className="font-semibold text-navy-950">{formatCLP(ventasEfectivo)}</dd>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2">
          <dt className="font-bold text-navy-950">Efectivo esperado en caja</dt>
          <dd className="font-bold text-navy-950">{formatCLP(esperado)}</dd>
        </div>
      </dl>
      <form action={action} className="space-y-3">
        <input type="hidden" name="cajaId" value={cajaId} />
        <div>
          <label htmlFor="cc-monto" className="mb-1 block text-sm font-semibold text-slate-700">
            Efectivo contado (CLP)
          </label>
          <input id="cc-monto" name="montoCierre" type="number" min={0} required className={input} />
        </div>
        <div>
          <label htmlFor="cc-nota" className="mb-1 block text-sm font-semibold text-slate-700">
            Nota (opcional)
          </label>
          <input id="cc-nota" name="notaCierre" className={input} placeholder="Ej: faltante por vuelto" />
        </div>
        {state.error && <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="h-11 w-full rounded-xl border-2 border-navy-950 font-bold text-navy-950 transition hover:bg-navy-950 hover:text-white disabled:opacity-50"
        >
          {pending ? "Cerrando…" : "Cerrar caja"}
        </button>
      </form>
    </div>
  );
}
