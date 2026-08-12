"use client";

import { useActionState, useState } from "react";
import { avanzarPedidoOnline, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

export interface PedidoOnlineUi {
  id: string;
  folio: string;
  estado: string;
  fecha: string;
  nombre: string;
  email: string;
  telefono: string;
  entrega: string;
  localNombre: string;
  total: number;
  montoEnvio: number;
  envioPorPagar: boolean;
  tarjeta: string | null;
  autorizacion: string | null;
  nota: string | null;
  lineas: { id: string; nombre: string; sku: string; cantidad: number; subtotal: number }[];
}

const estadoBadge: Record<string, { label: string; cls: string }> = {
  PENDIENTE_PAGO: { label: "Esperando pago", cls: "bg-slate-100 text-slate-500" },
  PAGADO: { label: "Pagado · por preparar", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  DESPACHADO: { label: "Despachado", cls: "bg-electric-50 text-electric-600" },
  ENTREGADO: { label: "Entregado", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  ANULADO: { label: "Anulado", cls: "bg-fenix-600/10 text-fenix-600" },
};

/** Bandeja de pedidos web: lo pagado se prepara, se despacha o se entrega. */
export function PedidosOnlineLista({
  pedidos,
  escribe,
}: {
  pedidos: PedidoOnlineUi[];
  escribe: boolean;
}) {
  const [filtro, setFiltro] = useState<string>("ACTIVOS");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    avanzarPedidoOnline,
    {},
  );

  const filtrados = pedidos.filter((p) => {
    if (filtro === "ACTIVOS") return p.estado === "PAGADO" || p.estado === "DESPACHADO";
    if (filtro === "TODOS") return true;
    return p.estado === filtro;
  });

  const chips: [string, string][] = [
    ["ACTIVOS", "Por gestionar"],
    ["ENTREGADO", "Entregados"],
    ["ANULADO", "Anulados"],
    ["TODOS", "Todos"],
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setFiltro(valor)}
            className={`h-9 rounded-full px-4 text-sm font-bold transition ${
              filtro === valor
                ? "bg-electric-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
      )}

      <div className="space-y-2">
        {filtrados.map((p) => {
          const badge = estadoBadge[p.estado] ?? estadoBadge.PAGADO;
          const expandido = abierto === p.id;
          return (
            <article key={p.id} className="rounded-2xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setAbierto(expandido ? null : p.id)}
                className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left"
              >
                <span className="w-28 font-mono text-sm font-bold text-navy-950">{p.folio}</span>
                <span className="w-32 text-sm text-slate-500">{p.fecha}</span>
                <span className="min-w-32 flex-1 truncate text-sm font-semibold text-navy-950">
                  {p.nombre}
                </span>
                <span className="truncate text-sm text-slate-500">{p.entrega}</span>
                <span className="text-sm font-bold tabular-nums text-navy-950">
                  {formatCLP(p.total)}
                </span>
                <span className={`ml-auto rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
              </button>

              {expandido && (
                <div className="space-y-3 border-t border-slate-100 px-5 py-4">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p className="text-slate-600">
                      📞 <b className="text-navy-950">{p.telefono}</b> · ✉️ {p.email}
                    </p>
                    <p className="text-slate-600">
                      {p.entrega} · prepara <b className="text-navy-950">{p.localNombre}</b>
                    </p>
                    {p.autorizacion && (
                      <p className="text-slate-500">
                        Webpay aut. <span className="font-mono">{p.autorizacion}</span>
                        {p.tarjeta ? ` · tarjeta ****${p.tarjeta}` : ""}
                      </p>
                    )}
                    {p.envioPorPagar && (
                      <p className="font-semibold text-[#b45309]">
                        ⚠️ Envío POR PAGAR: el cliente paga el courier al recibir.
                      </p>
                    )}
                    {p.nota && <p className="text-slate-500">Nota: {p.nota}</p>}
                  </div>

                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                    {p.lineas.map((l) => (
                      <li key={l.id} className="flex items-baseline justify-between gap-3 px-4 py-2">
                        <span className="min-w-0 truncate text-slate-600">
                          {l.cantidad} × {l.nombre}{" "}
                          <span className="font-mono text-xs text-slate-400">{l.sku}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-navy-950">
                          {formatCLP(l.subtotal)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {escribe && (p.estado === "PAGADO" || p.estado === "DESPACHADO") && (
                    <form action={action} className="flex flex-wrap gap-2">
                      <input type="hidden" name="pedidoId" value={p.id} />
                      {p.estado === "PAGADO" && !p.entrega.startsWith("Retiro") && (
                        <button
                          type="submit"
                          name="accion"
                          value="DESPACHAR"
                          disabled={pending}
                          className="h-11 rounded-xl border-2 border-electric-600 px-5 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white disabled:opacity-40"
                        >
                          🚚 Marcar despachado
                        </button>
                      )}
                      <button
                        type="submit"
                        name="accion"
                        value="ENTREGAR"
                        disabled={pending}
                        className="bg-flame h-11 rounded-xl px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                      >
                        ✓ Marcar entregado
                      </button>
                    </form>
                  )}
                </div>
              )}
            </article>
          );
        })}

        {filtrados.length === 0 && (
          <p className="rounded-2xl border border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
            {pedidos.length === 0
              ? "Aún no hay compras web. Cuando alguien pague con Webpay, aparecerán acá."
              : "Nada en este filtro."}
          </p>
        )}
      </div>
    </section>
  );
}
