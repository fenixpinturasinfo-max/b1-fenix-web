"use client";

import { useEffect, useRef, useState } from "react";
import { formatCLP } from "@/lib/format";
import { resolverSolicitudCorreo, type ResultadoResolucion } from "../actions";

/**
 * Resuelve la solicitud apenas se abre la página del enlace del correo.
 *
 * El correo trae un enlace GET, pero la resolución corre acá como Server Action (POST)
 * al montar el componente. No es un rodeo: los escáneres de enlaces de los correos
 * (Outlook SafeLinks y parecidos) hacen GET a todo lo que ven, y si el GET aprobara,
 * un robot aprobaría descuentos. Ejecutar la acción desde JavaScript deja el clic del
 * gerente como único camino realista, sin pedirle un segundo toque.
 */
export function ResolucionCorreo({ token }: { token: string }) {
  const [resultado, setResultado] = useState<ResultadoResolucion | null>(null);
  const lanzado = useRef(false);

  useEffect(() => {
    // El doble montaje de StrictMode en desarrollo dispararía la acción dos veces; la
    // segunda vería la solicitud ya resuelta y pintaría "alguien se adelantó" (tú mismo).
    if (lanzado.current) return;
    lanzado.current = true;
    resolverSolicitudCorreo(token).then(setResultado);
  }, [token]);

  if (!resultado) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
        <p className="text-lg font-bold text-navy-950">Procesando…</p>
        <p className="mt-1 text-sm text-slate-500">Registrando tu decisión.</p>
      </div>
    );
  }

  const { ok, titulo, detalle, info } = resultado;
  const aprobo = info?.accion === "APROBAR";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
      <p className="text-4xl">{ok ? (aprobo ? "✅" : "🚫") : "⚠️"}</p>
      <h1 className="mt-3 text-xl font-black text-navy-950">{titulo}</h1>
      <p className="mt-1 text-sm text-slate-500">{detalle}</p>

      {info && (
        <dl className="mt-5 space-y-1.5 border-t border-dashed border-slate-200 pt-4 text-sm">
          <div className="flex justify-between gap-6">
            <dt className="text-slate-500">Pidió</dt>
            <dd className="font-semibold text-navy-950">
              {info.solicitante} · {info.local}
            </dd>
          </div>
          {info.cliente && (
            <div className="flex justify-between gap-6">
              <dt className="text-slate-500">Cliente</dt>
              <dd className="font-semibold text-navy-950">{info.cliente}</dd>
            </div>
          )}
          <div className="flex justify-between gap-6">
            <dt className="text-slate-500">Descuento</dt>
            <dd className="font-semibold tabular-nums text-navy-950">
              {formatCLP(info.monto)} sobre {formatCLP(info.base)}
            </dd>
          </div>
          {info.motivo && (
            <div className="flex justify-between gap-6">
              <dt className="text-slate-500">Motivo</dt>
              <dd className="text-right text-navy-950">{info.motivo}</dd>
            </div>
          )}
        </dl>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Ya puedes cerrar esta pestaña. La caja se entera sola.
      </p>
    </div>
  );
}
