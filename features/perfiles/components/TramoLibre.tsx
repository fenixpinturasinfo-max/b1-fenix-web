"use client";

import { useActionState, useId, useState } from "react";
import { formatCLP } from "@/lib/format";
import { tramoLibre, type TopeLibre } from "@/lib/descuento";
import { guardarTope, type ActionState } from "../actions";

/** Venta de ejemplo para mostrar en pesos lo que el porcentaje dice en abstracto. */
const VENTA_EJEMPLO = 100_000;

/**
 * Tramo libre de descuento del perfil.
 *
 * Se edita aparte de la matriz de permisos a propósito: un permiso es un sí o un no, esto
 * es un cuánto. Mezclarlos en la misma pantalla de niveles obligaría a explicar por qué
 * una fila tiene números y las demás no.
 *
 * El ejemplo en pesos no es adorno: "5%" no le dice nada a quien configura hasta que ve
 * que en una venta corriente son tres mil pesos que el cajero regala sin preguntar.
 */
export function TramoLibre({
  rol,
  inicial,
  autorizaDescuentos,
  esPropio,
  soloLectura,
}: {
  rol: string;
  inicial: TopeLibre;
  /** Si el perfil ya tiene el permiso de autorizar, el tramo es irrelevante. */
  autorizaDescuentos: boolean;
  esPropio: boolean;
  soloLectura: boolean;
}) {
  const [porcentaje, setPorcentaje] = useState(String(inicial.porcentaje || ""));
  const [montoMaximo, setMontoMaximo] = useState(String(inicial.montoMaximo || ""));
  const [state, action, pending] = useActionState<ActionState, FormData>(guardarTope, {});
  const idPct = useId();
  const idMonto = useId();

  const bloqueado = esPropio || soloLectura;
  const tope: TopeLibre = {
    porcentaje: Number(porcentaje) || 0,
    montoMaximo: Number(montoMaximo) || 0,
  };
  const ejemplo = tramoLibre(VENTA_EJEMPLO, tope);
  const sinCambios =
    tope.porcentaje === inicial.porcentaje && tope.montoMaximo === inicial.montoMaximo;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-black text-navy-950">Descuento sin autorización</h2>
      <p className="mt-1 text-sm text-slate-500">
        Cuánto puede rebajar este perfil por su cuenta en el POS y en las facturas. Sobre ese
        monto, el sistema le pide las credenciales de alguien que sí pueda autorizar.
      </p>

      {autorizaDescuentos && (
        <p className="mt-3 rounded-xl bg-cloud/60 px-3 py-2 text-sm text-slate-600">
          Este perfil ya tiene permiso para autorizar descuentos, así que no tiene techo. El
          tramo solo aplicaría si le quitas ese permiso.
        </p>
      )}

      <form action={action} className="mt-4 space-y-3">
        <input type="hidden" name="rol" value={rol} />

        <div className="flex gap-2">
          <div className="w-28">
            <label htmlFor={idPct} className="mb-1 block text-xs font-semibold text-slate-700">
              Porcentaje
            </label>
            <input
              id={idPct}
              name="porcentaje"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              disabled={bloqueado}
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              placeholder="0"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 tabular-nums outline-none focus:border-electric-500 disabled:bg-cloud/60"
            />
          </div>
          <div className="flex-1">
            <label htmlFor={idMonto} className="mb-1 block text-xs font-semibold text-slate-700">
              Techo en pesos <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              id={idMonto}
              name="montoMaximo"
              type="number"
              min={0}
              inputMode="numeric"
              disabled={bloqueado}
              value={montoMaximo}
              onChange={(e) => setMontoMaximo(e.target.value)}
              placeholder="Sin techo"
              className="h-11 w-full rounded-xl border border-slate-300 px-3 tabular-nums outline-none focus:border-electric-500 disabled:bg-cloud/60"
            />
          </div>
        </div>

        <p className="rounded-xl bg-cloud/60 px-3 py-2 text-sm text-slate-600">
          {tope.porcentaje <= 0 ? (
            "Pedirá autorización para cualquier descuento, por chico que sea."
          ) : (
            <>
              En una venta de {formatCLP(VENTA_EJEMPLO)} podría descontar hasta{" "}
              <b className="tabular-nums text-navy-950">{formatCLP(ejemplo)}</b> sin preguntarle
              a nadie.
            </>
          )}
        </p>

        {esPropio && (
          <p className="text-xs text-slate-500">
            Es el perfil que estás usando: tu propio tope lo cambia otro administrador.
          </p>
        )}

        {state.error && (
          <p role="alert" className="text-sm font-semibold text-fenix-600">
            {state.error}
          </p>
        )}
        {state.ok && <p className="text-sm font-semibold text-[#4d7c0f]">{state.ok}</p>}

        <button
          type="submit"
          disabled={pending || bloqueado || sinCambios}
          className="bg-flame h-11 rounded-xl px-5 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Guardando…" : "Guardar tope"}
        </button>
      </form>
    </section>
  );
}
