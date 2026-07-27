"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";
import { CabeceraDoc, LineasDoc, ModalDoc } from "@/components/documento/ModalDoc";

export interface OCLinea {
  id: string;
  producto: string;
  sku: string;
  cantidad: number;
  recibido: number;
  costo: number;
}

export interface OCRow {
  id: string;
  folio: string;
  fecha: string;
  proveedor: string;
  local: string;
  neto: number;
  pedido: number;
  recibido: number;
  estado: string; // clave del enum
  fechaRequerida: string | null;
  fechaEntrega: string | null;
  nota: string | null;
  lineas: OCLinea[];
}

/** Modal de vista del documento OC (las operaciones viven en su página) */
function OCModal({ r, onClose }: { r: OCRow; onClose: () => void }) {
  const badge = estadoBadge[r.estado] ?? estadoBadge.ENVIADA;
  const iva = Math.round(r.neto * 0.19);
  return (
    <ModalDoc etiqueta={`Orden de compra ${r.folio}`} onClose={onClose}>
      <CabeceraDoc
        folio={r.folio}
        badge={badge}
        onClose={onClose}
        detalle={
          <>
            🚚 {r.proveedor} · 📍 destino <b className="text-navy-950">{r.local}</b> · creada el{" "}
            {r.fecha}
            {r.fechaRequerida && <> · 📦 requerida <b className="text-navy-950">{r.fechaRequerida}</b></>}
            {r.fechaEntrega && <> · 🚚 entrega proveedor <b className="text-navy-950">{r.fechaEntrega}</b></>}
            {r.nota && <> · 📝 {r.nota}</>}
          </>
        }
      />
      <LineasDoc
        columnas={[
          { label: "Producto" },
          { label: "Pedido", align: "center" },
          { label: "Recibido", align: "center" },
          { label: "Precio", align: "right" },
          { label: "Total", align: "right" },
        ]}
      >
        {r.lineas.map((l) => (
          <tr key={l.id} className="border-t border-slate-100">
            <td className="px-3 py-1.5">
              <p className="text-[13px] font-semibold leading-tight text-navy-950">{l.producto}</p>
              <p className="font-mono text-[11px] text-slate-400">{l.sku}</p>
            </td>
            <td className="px-3 py-1.5 text-center font-bold text-navy-950">{l.cantidad}</td>
            <td className={`px-3 py-1.5 text-center font-bold ${l.recibido >= l.cantidad ? "text-[#4d7c0f]" : "text-slate-500"}`}>
              {l.recibido}
            </td>
            <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{formatCLP(l.costo)}</td>
            <td className="px-3 py-1.5 text-right text-[13px] font-bold tabular-nums text-navy-950">
              {formatCLP(l.cantidad * l.costo)}
            </td>
          </tr>
        ))}
      </LineasDoc>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-cloud/60 p-4">
        <dl className="space-y-0.5 text-sm">
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">Neto</dt>
            <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(r.neto)}</dd>
          </div>
          <div className="flex justify-between gap-8">
            <dt className="text-slate-500">IVA 19%</dt>
            <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(iva)}</dd>
          </div>
          <div className="flex justify-between gap-8 border-t border-slate-300 pt-0.5">
            <dt className="font-bold text-navy-950">Total</dt>
            <dd className="font-black tabular-nums text-navy-950">{formatCLP(r.neto + iva)}</dd>
          </div>
        </dl>
        <div className="ml-auto flex gap-2">
          <a
            href={`/dashboard/compras/${r.id}`}
            className="bg-flame flex h-11 items-center rounded-xl px-5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Abrir documento (recepcionar / facturar) →
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
          >
            Cerrar
          </button>
        </div>
      </div>
    </ModalDoc>
  );
}

const estadoBadge: Record<string, { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-slate-100 text-slate-500" },
  ENVIADA: { label: "Enviada", cls: "bg-electric-50 text-electric-600" },
  RECIBIDA_PARCIAL: { label: "Recibida parcial", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  RECIBIDA: { label: "Recibida", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  CERRADA: { label: "Cerrada", cls: "bg-slate-100 text-slate-500" },
  ANULADA: { label: "Anulada", cls: "bg-fenix-600/10 text-fenix-600" },
};

const ABIERTAS = ["BORRADOR", "ENVIADA", "RECIBIDA_PARCIAL", "RECIBIDA"];
const PAGINA = 10;
export type FiltroOC = "TODAS" | "ABIERTAS" | "CERRADAS" | "ANULADAS";
type Filtro = FiltroOC;

const pasa = (r: OCRow, f: Filtro) =>
  f === "TODAS"
    ? true
    : f === "ABIERTAS"
      ? ABIERTAS.includes(r.estado)
      : f === "CERRADAS"
        ? r.estado === "CERRADA"
        : r.estado === "ANULADA";

export function OCLista({
  rows,
  filtroInicial = "TODAS",
}: {
  rows: OCRow[];
  /** Prefiltro al entrar desde el dashboard (?estado=ABIERTAS) */
  filtroInicial?: FiltroOC;
}) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtradas = rows.filter(
    (r) =>
      pasa(r, filtro) &&
      (!q || r.folio.toLowerCase().includes(q) || r.proveedor.toLowerCase().includes(q)),
  );
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(["TODAS", "ABIERTAS", "CERRADAS", "ANULADAS"] as const).map((f) => ({
            valor: f,
            label: f === "TODAS" ? "Todas" : f.charAt(0) + f.slice(1).toLowerCase(),
            n: rows.filter((r) => pasa(r, f)).length,
          }))}
          valor={filtro}
          onChange={(f) => {
            setFiltro(f);
            setPagina(1);
          }}
        />
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Folio o proveedor…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">OC</th>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Proveedor</th>
            <th className="px-4 py-2.5">Destino</th>
            <th className="px-4 py-2.5 text-right">Neto</th>
            <th className="px-4 py-2.5 text-right">Recibido</th>
            <th className="px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => {
            const badge = estadoBadge[r.estado] ?? estadoBadge.ENVIADA;
            return (
              <tr
                key={r.id}
                onClick={() => setAbierto(r.id)}
                title="Ver documento"
                className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-electric-50/40"
              >
                <td className="whitespace-nowrap px-4 py-2 font-mono font-bold text-navy-950">
                  {r.folio}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.fecha}</td>
                <td className="px-4 py-2 text-slate-600">{r.proveedor}</td>
                <td className="px-4 py-2 text-slate-600">{r.local}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(r.neto)}
                </td>
                <td className="px-4 py-2 text-right text-slate-600">
                  {r.recibido} / {r.pedido}
                </td>
                <td className="px-4 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAbierto(r.id);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0 ? "Aún no hay órdenes de compra." : "Sin resultados."}
              </td>
            </tr>
          )}
        </tbody>
      </TablaScroll>

      <div className="flex justify-center">
        <Paginacion total={filtradas.length} pagina={pagina} porPagina={PAGINA} onChange={setPagina} />
      </div>

      {abierto &&
        (() => {
          const r = rows.find((x) => x.id === abierto);
          return r ? <OCModal r={r} onClose={() => setAbierto(null)} /> : null;
        })()}
    </div>
  );
}
