"use client";

import { useActionState, useRef, useState } from "react";
import { registrarMovimientoCaja, type ActionState } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { formatCLP } from "@/lib/format";
import { movLabel, TIPOS_MOV, type TipoMovCaja } from "../caja";
import { fmtHora } from "@/lib/fechas";

export interface MovCaja {
  id: string;
  tipo: string;
  monto: number;
  motivo: string;
  creadoEn: Date;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

/**
 * Movimientos de efectivo del turno.
 *
 * Sin esto, sacar plata de la caja para pagar un flete aparecía al cierre como un
 * descuadre. Con varios turnos al día eso deja de ser excepción y el equipo aprende
 * a ignorar los rojos, que es la peor forma de perder el control de caja.
 */
export function MovimientosCaja({
  cajaId,
  movimientos,
  saldo,
}: {
  cajaId: string;
  movimientos: MovCaja[];
  /** Efecto neto sobre el efectivo del turno */
  saldo: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<TipoMovCaja>("SANGRIA");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await registrarMovimientoCaja(prev, fd);
      if (res.ok) {
        formRef.current?.reset();
        setTipo("SANGRIA");
        setAbierto(false);
      }
      return res;
    },
    {},
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-navy-950">Movimientos de caja</h2>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
        >
          ＋ Registrar
        </button>
      </div>

      {movimientos.length === 0 ? (
        <p className="py-4 text-sm text-slate-400">
          Sin movimientos. Registra acá las sangrías y los gastos pagados con dinero de la
          caja, o al cierre aparecerán como descuadre.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-slate-100 text-sm">
            {movimientos.map((m) => {
              const suma = m.tipo === "INGRESO";
              return (
                <li key={m.id} className="flex items-center gap-3 py-2">
                  <span className="w-12 shrink-0 text-xs text-slate-400">
                    {fmtHora(m.creadoEn)}
                  </span>
                  <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wide text-slate-500">
                    {movLabel[m.tipo] ?? m.tipo}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{m.motivo}</span>
                  <span
                    className={`shrink-0 font-bold tabular-nums ${
                      suma ? "text-[#4d7c0f]" : "text-fenix-600"
                    }`}
                  >
                    {suma ? "+" : "−"}
                    {formatCLP(m.monto)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
            <span className="font-semibold text-slate-600">Efecto en el efectivo</span>
            <span
              className={`font-black tabular-nums ${
                saldo >= 0 ? "text-[#4d7c0f]" : "text-fenix-600"
              }`}
            >
              {saldo >= 0 ? "+" : "−"}
              {formatCLP(Math.abs(saldo))}
            </span>
          </p>
        </>
      )}

      {abierto && (
        <Modal
          titulo="Registrar movimiento de caja"
          descripcion="Queda en el arqueo del turno y en el historial, con tu nombre."
          onClose={() => setAbierto(false)}
        >
          <form ref={formRef} action={action} className="space-y-4">
            <input type="hidden" name="cajaId" value={cajaId} />

            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-700">Tipo</span>
              <div role="radiogroup" aria-label="Tipo de movimiento" className="grid gap-2">
                {TIPOS_MOV.map((t) => (
                  <label
                    key={t.valor}
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                      tipo === t.valor
                        ? "border-electric-500 bg-electric-50"
                        : "border-slate-300 hover:border-electric-500"
                    }`}
                  >
                    <input
                      type="radio"
                      name="tipo"
                      value={t.valor}
                      checked={tipo === t.valor}
                      onChange={() => setTipo(t.valor)}
                      className="mt-0.5 h-4 w-4 accent-[#0e518d]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-navy-950">{t.label}</span>
                      <span className="block text-xs text-slate-500">{t.ayuda}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="mc-monto" className="mb-1 block text-sm font-semibold text-slate-700">
                Monto *
              </label>
              <input
                id="mc-monto"
                name="monto"
                type="number"
                min={1}
                required
                inputMode="numeric"
                placeholder="Ej: 50000"
                className={input}
              />
            </div>

            <div>
              <label htmlFor="mc-motivo" className="mb-1 block text-sm font-semibold text-slate-700">
                Motivo *
              </label>
              <input
                id="mc-motivo"
                name="motivo"
                required
                minLength={3}
                placeholder="Ej: pago flete Chilexpress"
                className={input}
              />
              <p className="mt-1 text-xs text-slate-400">
                Sin motivo el movimiento no se puede auditar después.
              </p>
            </div>

            {state.error && (
              <p role="alert" className="text-sm font-semibold text-fenix-600">
                {state.error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="h-11 flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Registrando…" : "Registrar"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
