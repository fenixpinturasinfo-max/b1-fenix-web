"use client";

import { useActionState, useEffect, useState } from "react";
import { enviarCotizacion, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";

export interface LineaPendiente {
  id: string;
  folio: string | null;
  producto: string;
  sku: string;
  local: string;
  cantidad: number;
  precio: number | null; // neto unitario
  fechaRequerida: string | null;
}

export interface ProveedorPendiente {
  proveedorId: string;
  nombre: string;
  email: string | null;
  lineas: LineaPendiente[];
}

const PAGINA = 10;

function ModalCotizacion({
  prov,
  onClose,
}: {
  prov: ProveedorPendiente;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    enviarCotizacion,
    {},
  );

  // Cerrar con Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  const neto = prov.lineas.reduce((t, l) => t + (l.precio ?? 0) * l.cantidad, 0);
  const iva = Math.round(neto * 0.19);
  const entregaReq = prov.lineas.map((l) => l.fechaRequerida).find((f) => f !== null) ?? null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Cotización para ${prov.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-navy-950">🚚 {prov.nombre}</h3>
            <p className="text-sm text-slate-500">
              {prov.lineas.length} producto{prov.lineas.length === 1 ? "" : "s"} pendiente
              {prov.lineas.length === 1 ? "" : "s"} de cotizar
              {entregaReq ? ` · 📦 entrega requerida ${entregaReq}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
          >
            ✕
          </button>
        </div>

        {/* Detalle de la solicitud */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-cloud/60 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Producto</th>
                <th className="px-4 py-2.5">Entregar en</th>
                <th className="px-4 py-2.5 text-right">Cant.</th>
                <th className="px-4 py-2.5 text-right">Precio ref.</th>
                <th className="px-4 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {prov.lineas.map((l) => (
                <tr key={l.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-navy-950">{l.producto}</p>
                    <p className="font-mono text-xs text-slate-400">
                      {l.sku}
                      {l.folio ? ` · ${l.folio}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{l.local}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-navy-950">{l.cantidad}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">
                    {l.precio != null ? formatCLP(l.precio) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-navy-950">
                    {l.precio != null ? formatCLP(l.precio * l.cantidad) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            {neto > 0 && (
              <tfoot className="border-t border-slate-200 text-sm">
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 pt-3 text-right text-slate-500">Neto</td>
                  <td className="px-4 py-1.5 pt-3 text-right font-semibold tabular-nums text-navy-950">
                    {formatCLP(neto)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-1.5 text-right text-slate-500">IVA 19%</td>
                  <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-navy-950">
                    {formatCLP(iva)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right font-bold text-navy-950">Total ref.</td>
                  <td className="px-4 py-2 text-right font-black tabular-nums text-navy-950">
                    {formatCLP(neto + iva)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Envío */}
        <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="proveedorId" value={prov.proveedorId} />
          <div className="w-full">
            <label
              htmlFor={`cot-com-${prov.proveedorId}`}
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              Comentario para el proveedor (opcional)
            </label>
            <textarea
              id={`cot-com-${prov.proveedorId}`}
              name="comentario"
              rows={2}
              maxLength={500}
              placeholder="Ej: favor confirmar disponibilidad antes del viernes; despachar en horario de mañana."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-navy-950 outline-none transition focus:border-electric-500"
            />
          </div>
          <div className="min-w-56 flex-1">
            <label htmlFor={`cot-email-${prov.proveedorId}`} className="mb-1 block text-sm font-semibold text-slate-700">
              Correo del proveedor
            </label>
            <input
              id={`cot-email-${prov.proveedorId}`}
              name="email"
              type="email"
              required
              defaultValue={prov.email ?? ""}
              placeholder="ventas@proveedor.cl"
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500"
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="h-11 rounded-xl bg-electric-600 px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Enviando…" : "✉ Enviar cotización"}
          </button>
          <a
            href={`/dashboard/compras/nueva?proveedor=${prov.proveedorId}`}
            className="flex h-11 items-center rounded-xl border-2 border-electric-600 px-5 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white"
          >
            → Copiar a OC
          </a>
          {state.error && (
            <p role="alert" className="w-full text-sm font-semibold text-fenix-600">{state.error}</p>
          )}
          {state.ok && (
            <p role="status" className="w-full text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export function CotizacionesPendientes({ items }: { items: ProveedorPendiente[] }) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  if (items.length === 0) return null;

  const visibles = items.slice((pagina - 1) * PAGINA, pagina * PAGINA);
  const activo = items.find((p) => p.proveedorId === abierto) ?? null;

  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-navy-950">
        Pendientes de cotizar{" "}
        <span className="rounded-full bg-cloud px-2 py-0.5 text-sm text-slate-500">
          {items.length}
        </span>
      </h2>

      <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
        {visibles.map((p) => {
          const neto = p.lineas.reduce((t, l) => t + (l.precio ?? 0) * l.cantidad, 0);
          return (
            <div
              key={p.proveedorId}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
            >
              <span className="min-w-40 flex-1 truncate font-semibold text-navy-950">
                🚚 {p.nombre}
              </span>
              <span className="text-sm text-slate-500">
                {p.lineas.length} prod.
                {neto > 0 && (
                  <>
                    {" · "}
                    <b className="tabular-nums text-navy-950">{formatCLP(neto)}</b>{" "}
                    <span className="text-slate-400">neto</span>
                  </>
                )}
              </span>
              <div className="ml-auto flex gap-2">
                <button
                  type="button"
                  onClick={() => setAbierto(p.proveedorId)}
                  className="h-10 rounded-xl bg-electric-600 px-4 text-sm font-bold text-white transition hover:opacity-90"
                >
                  ✉ Cotizar
                </button>
                <a
                  href={`/dashboard/compras/nueva?proveedor=${p.proveedorId}`}
                  className="flex h-10 items-center rounded-xl border border-electric-600 px-4 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white"
                >
                  → OC
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex justify-center">
        <Paginacion
          total={items.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>

      {activo && <ModalCotizacion prov={activo} onClose={() => setAbierto(null)} />}
    </section>
  );
}
