"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { marcarFacturaPagada } from "../actions";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";
import { CabeceraDoc, LineasDoc, ModalDoc } from "@/components/documento/ModalDoc";

export interface FacturaLinea {
  id: string;
  producto: string;
  sku: string;
  cantidad: number;
  costo: number;
}

export interface FacturaRow {
  id: string;
  folio: string;
  numero: string;
  proveedor: string;
  oc: string;
  ocId: string;
  neto: number;
  iva: number;
  total: number;
  totalNC: number;
  emision: string;
  vence: string | null;
  estado: "POR_PAGAR" | "VENCIDA" | "PAGADA" | "ANULADA";
  puedeMarcarPagada: boolean;
  lineas: FacturaLinea[];
}

/** Modal de vista de la Factura de Compra */
function FacturaModal({ r, onClose }: { r: FacturaRow; onClose: () => void }) {
  const badge = badges[r.estado];
  return (
    <ModalDoc etiqueta={`Factura ${r.folio}`} onClose={onClose}>
      <CabeceraDoc
        folio={r.folio}
        badge={badge}
        onClose={onClose}
        extra={
          <a
            href={`/dashboard/compras/${r.ocId}`}
            className="font-mono text-xs font-bold text-electric-600 hover:underline"
          >
            ← {r.oc}
          </a>
        }
        detalle={
          <>
            🚚 {r.proveedor} · N° proveedor <b className="text-navy-950">{r.numero}</b> · emitida{" "}
            {r.emision}
            {r.vence && <> · vence <b className="text-navy-950">{r.vence}</b></>}
          </>
        }
      />
      <LineasDoc
        columnas={[
          { label: "Producto" },
          { label: "Cant.", align: "center" },
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
            <dd className="font-semibold tabular-nums text-navy-950">{formatCLP(r.iva)}</dd>
          </div>
          {r.totalNC > 0 && (
            <div className="flex justify-between gap-8">
              <dt className="text-fenix-600">Notas de crédito</dt>
              <dd className="font-semibold tabular-nums text-fenix-600">−{formatCLP(r.totalNC)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-8 border-t border-slate-300 pt-0.5">
            <dt className="font-bold text-navy-950">Total a pagar</dt>
            <dd className="font-black tabular-nums text-navy-950">
              {formatCLP(r.total - r.totalNC)}
            </dd>
          </div>
        </dl>
        <div className="ml-auto flex flex-wrap gap-2">
          {r.puedeMarcarPagada && (
            <form action={marcarFacturaPagada}>
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                className="h-11 rounded-xl bg-electric-600 px-5 text-sm font-bold text-white transition hover:opacity-90"
              >
                ✓ Marcar pagada
              </button>
            </form>
          )}
          <a
            href={`/dashboard/compras/facturas/${r.id}`}
            className="bg-flame flex h-11 items-center rounded-xl px-5 text-sm font-bold text-white transition hover:opacity-90"
          >
            Abrir documento (nota de crédito) →
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

const badges: Record<FacturaRow["estado"], { label: string; cls: string }> = {
  POR_PAGAR: { label: "Por pagar", cls: "bg-electric-50 text-electric-600" },
  VENCIDA: { label: "Vencida", cls: "bg-fenix-600/10 text-fenix-600" },
  PAGADA: { label: "Pagada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  ANULADA: { label: "Anulada", cls: "bg-slate-100 text-slate-400" },
};

const PAGINA = 10;
export type FiltroFactura = "TODAS" | "POR_PAGAR" | "VENCIDA" | "PAGADA";
type Filtro = FiltroFactura;

const pasa = (r: FacturaRow, f: Filtro) =>
  f === "TODAS" ? true : f === "POR_PAGAR" ? r.estado === "POR_PAGAR" || r.estado === "VENCIDA" : r.estado === f;

export function FacturasLista({
  rows,
  filtroInicial = "TODAS",
}: {
  rows: FacturaRow[];
  /** Prefiltro al entrar desde el dashboard (?estado=VENCIDA|POR_PAGAR) */
  filtroInicial?: FiltroFactura;
}) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtradas = rows.filter(
    (r) =>
      pasa(r, filtro) &&
      (!q ||
        r.folio.toLowerCase().includes(q) ||
        r.numero.toLowerCase().includes(q) ||
        r.proveedor.toLowerCase().includes(q) ||
        r.oc.toLowerCase().includes(q)),
  );
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const etiquetas: Record<Filtro, string> = {
    TODAS: "Todas",
    POR_PAGAR: "Por pagar",
    VENCIDA: "Vencidas",
    PAGADA: "Pagadas",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(["TODAS", "POR_PAGAR", "VENCIDA", "PAGADA"] as const).map((f) => ({
            valor: f,
            label: etiquetas[f],
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
          placeholder="Folio, N° prov., proveedor…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Interno</th>
            <th className="px-4 py-2.5">N° Prov.</th>
            <th className="px-4 py-2.5">Proveedor</th>
            <th className="px-4 py-2.5">OC</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Vence</th>
            <th className="px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => {
            const badge = badges[r.estado];
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
                <td className="px-4 py-2 text-slate-600">{r.numero}</td>
                <td className="px-4 py-2 text-slate-600">{r.proveedor}</td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-500">{r.oc}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(r.total)}
                  {r.totalNC > 0 && (
                    <p className="text-xs font-semibold text-fenix-600">−{formatCLP(r.totalNC)} NC</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.vence ?? "—"}</td>
                <td className="px-4 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {r.puedeMarcarPagada && (
                      <form action={marcarFacturaPagada}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="whitespace-nowrap rounded-lg bg-electric-600 px-3 py-1 text-xs font-bold text-white transition hover:opacity-90"
                        >
                          ✓ Pagada
                        </button>
                      </form>
                    )}
                    <button
                      type="button"
                      onClick={() => setAbierto(r.id)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                    >
                      Ver
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0
                  ? "Aún no hay facturas. Se registran desde el detalle de una Orden de Compra."
                  : "Sin resultados."}
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
          return r ? <FacturaModal r={r} onClose={() => setAbierto(null)} /> : null;
        })()}
    </div>
  );
}
