"use client";

import { useActionState, useState } from "react";
import {
  anularFactura,
  marcarPagada,
  vincularPedido,
  type ActionState,
} from "../facturaActions";
import { formatCLP } from "@/lib/format";

export interface PedidoVinculable {
  id: string;
  folio: string;
  nombreCliente: string;
  total: number;
}

/**
 * Acciones de una factura emitida: cobrar, vincular un pedido y anular.
 *
 * Anular va en un modal con motivo obligatorio porque devuelve stock al inventario y deja
 * un folio quemado: no es lo mismo que corregir un dato.
 */
export function AccionesFactura({
  facturaId,
  folio,
  total,
  estado,
  tienePedido,
  pedidos,
}: {
  facturaId: string;
  folio: string;
  total: number;
  estado: "ABIERTA" | "PAGADA" | "ANULADA";
  tienePedido: boolean;
  pedidos: PedidoVinculable[];
}) {
  const [confirmar, setConfirmar] = useState(false);
  const [pagar, setPagar] = useState<ActionState>({});
  const [pendingPago, setPendingPago] = useState(false);

  const [stateVinc, accionVinc, pendingVinc] = useActionState<ActionState, FormData>(
    vincularPedido,
    {},
  );
  const [stateAnul, accionAnul, pendingAnul] = useActionState<ActionState, FormData>(
    anularFactura,
    {},
  );

  if (estado === "ANULADA") return null;

  return (
    <div className="space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        {estado === "ABIERTA" && (
          <form
            action={async (fd) => {
              setPendingPago(true);
              setPagar(await marcarPagada({}, fd));
              setPendingPago(false);
            }}
          >
            <input type="hidden" name="facturaId" value={facturaId} />
            <button
              type="submit"
              disabled={pendingPago}
              className="h-11 rounded-xl bg-[#4d7c0f] px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pendingPago ? "Registrando…" : `Marcar pagada (${formatCLP(total)})`}
            </button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setConfirmar(true)}
          className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-fenix-600 hover:text-fenix-600"
        >
          Anular factura
        </button>
      </div>

      {pagar.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600">{pagar.error}</p>
      )}
      {pagar.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f]">✅ {pagar.ok}</p>
      )}

      {/* Vincular un pedido después: el caso de la factura que se emitió sin acordarse */}
      {!tienePedido && pedidos.length > 0 && (
        <form
          action={accionVinc}
          className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-cloud/50 p-3"
        >
          <input type="hidden" name="facturaId" value={facturaId} />
          <div className="min-w-56 flex-1">
            <label
              htmlFor="vinc-pedido"
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              Vincular un pedido
            </label>
            <select
              id="vinc-pedido"
              name="pedidoId"
              required
              defaultValue=""
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
            >
              <option value="" disabled>— Selecciona el pedido —</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.folio} · {p.nombreCliente} · {formatCLP(p.total)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400">
              El pedido queda facturado y no se cobra por el POS.
            </p>
          </div>
          <button
            type="submit"
            disabled={pendingVinc}
            className="h-11 rounded-xl border border-electric-600 px-4 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white disabled:opacity-50"
          >
            {pendingVinc ? "Vinculando…" : "Vincular"}
          </button>
          {stateVinc.error && (
            <p role="alert" className="w-full text-sm font-semibold text-fenix-600">
              {stateVinc.error}
            </p>
          )}
          {stateVinc.ok && (
            <p role="status" className="w-full text-sm font-semibold text-[#4d7c0f]">
              ✅ {stateVinc.ok}
            </p>
          )}
        </form>
      )}

      {confirmar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={() => !pendingAnul && setConfirmar(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Anular factura ${folio}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-6 text-left shadow-2xl"
          >
            <h3 className="text-lg font-bold text-navy-950">
              ¿Anular <span className="font-mono">{folio}</span>?
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              La mercadería <b className="text-navy-950">vuelve al inventario</b> con un
              movimiento de entrada por cada línea. Si ya se la llevó el cliente, el stock va a
              quedar de más.
            </p>
            <p className="mt-2 rounded-xl bg-[#f59e0b]/10 px-3 py-2 text-sm text-[#b45309]">
              El folio queda usado: anular no lo libera. Si la factura ya se emitió en el SII,
              hay que emitir una nota de crédito allá.
            </p>

            {stateAnul.ok ? (
              <div className="mt-4 space-y-3">
                <p role="status" className="text-sm font-semibold text-[#4d7c0f]">
                  ✅ {stateAnul.ok}
                </p>
                <button
                  type="button"
                  onClick={() => setConfirmar(false)}
                  className="h-11 w-full rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form action={accionAnul} className="mt-4 space-y-3">
                <input type="hidden" name="facturaId" value={facturaId} />
                <div>
                  <label
                    htmlFor="motivo-anul-fv"
                    className="mb-1 block text-sm font-semibold text-slate-700"
                  >
                    Motivo de la anulación *
                  </label>
                  <textarea
                    id="motivo-anul-fv"
                    name="motivo"
                    rows={2}
                    required
                    minLength={5}
                    placeholder="Ej: se facturó al cliente equivocado"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-950 outline-none focus:border-electric-500"
                  />
                </div>
                {stateAnul.error && (
                  <p role="alert" className="text-sm font-semibold text-fenix-600">
                    {stateAnul.error}
                  </p>
                )}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={pendingAnul}
                    className="h-11 flex-1 rounded-xl bg-fenix-600 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    {pendingAnul ? "Anulando…" : "Sí, anular y devolver stock"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmar(false)}
                    disabled={pendingAnul}
                    className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 disabled:opacity-50"
                  >
                    Volver
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
