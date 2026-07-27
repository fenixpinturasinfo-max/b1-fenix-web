"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, TablaScroll, theadSticky } from "@/components/ui/lista";
import { CabeceraDoc, LineasDoc, ModalDoc } from "@/components/documento/ModalDoc";

export interface EntradaLinea {
  id: string;
  producto: string;
  sku: string;
  cantidad: number;
  costo: number;
}

export interface EntradaRow {
  id: string;
  folio: string;
  fecha: string;
  oc: { id: string; folio: string } | null;
  proveedor: string;
  local: string;
  guia: string | null;
  unidades: number;
  recibio: string;
  lineas: EntradaLinea[];
}

/** Modal de vista de la Entrada de Mercadería */
function EntradaModal({ r, onClose }: { r: EntradaRow; onClose: () => void }) {
  const neto = r.lineas.reduce((t, l) => t + l.cantidad * l.costo, 0);
  return (
    <ModalDoc etiqueta={`Entrada ${r.folio}`} onClose={onClose}>
      <CabeceraDoc
        folio={r.folio}
        badge={{ label: "Registrada", cls: "bg-lime-400/15 text-[#4d7c0f]" }}
        onClose={onClose}
        extra={
          r.oc && (
            <a
              href={`/dashboard/compras/${r.oc.id}`}
              className="font-mono text-xs font-bold text-electric-600 hover:underline"
            >
              ← {r.oc.folio}
            </a>
          )
        }
        detalle={
          <>
            🚚 {r.proveedor} · 📍 recibida en <b className="text-navy-950">{r.local}</b> · {r.fecha}
            {r.guia && <> · Guía <b className="text-navy-950">{r.guia}</b></>} · recibió {r.recibio}
          </>
        }
      />
      <LineasDoc
        columnas={[
          { label: "Producto" },
          { label: "Cant.", align: "center" },
          { label: "Costo", align: "right" },
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
        <span className="text-sm text-slate-500">
          Neto recibido:{" "}
          <b className="text-lg tabular-nums text-navy-950">{formatCLP(neto)}</b>
          <span className="ml-2 text-slate-400">· {r.unidades} unidades</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
        >
          Cerrar
        </button>
      </div>
    </ModalDoc>
  );
}

const PAGINA = 10;

export function EntradasLista({ rows }: { rows: EntradaRow[] }) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtradas = rows.filter(
    (r) =>
      !q ||
      r.folio.toLowerCase().includes(q) ||
      r.proveedor.toLowerCase().includes(q) ||
      (r.oc?.folio ?? "").toLowerCase().includes(q) ||
      (r.guia ?? "").toLowerCase().includes(q),
  );
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">{filtradas.length} entradas</span>
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Folio, OC, proveedor o guía…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Folio</th>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Doc. base</th>
            <th className="px-4 py-2.5">Proveedor</th>
            <th className="px-4 py-2.5">Local</th>
            <th className="px-4 py-2.5">Guía</th>
            <th className="px-4 py-2.5 text-right">Unidades</th>
            <th className="px-4 py-2.5">Recibió</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => (
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
              <td className="px-4 py-2">
                {r.oc ? (
                  <a
                    href={`/dashboard/compras/${r.oc.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-xs font-bold text-electric-600 hover:underline"
                  >
                    {r.oc.folio}
                  </a>
                ) : (
                  <span className="text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-slate-600">{r.proveedor}</td>
              <td className="px-4 py-2 text-slate-600">{r.local}</td>
              <td className="px-4 py-2 text-slate-600">{r.guia ?? "—"}</td>
              <td className="px-4 py-2 text-right font-bold text-navy-950">{r.unidades}</td>
              <td className="px-4 py-2 text-slate-600">{r.recibio}</td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0
                  ? "Aún no hay entradas de mercadería. Se crean al recepcionar una Orden de Compra."
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
          return r ? <EntradaModal r={r} onClose={() => setAbierto(null)} /> : null;
        })()}
    </div>
  );
}
