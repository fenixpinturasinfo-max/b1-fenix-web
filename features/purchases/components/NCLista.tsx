"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, TablaScroll, theadSticky } from "@/components/ui/lista";
import { CabeceraDoc, LineasDoc, ModalDoc } from "@/components/documento/ModalDoc";

export interface NCLinea {
  id: string;
  producto: string;
  sku: string;
  cantidad: number;
  costo: number;
}

export interface NCRow {
  id: string;
  folio: string;
  fecha: string;
  factura: { id: string; folio: string; numero: string };
  proveedor: string;
  motivo: string;
  unidades: number;
  total: number;
  creo: string;
  lineas: NCLinea[];
}

/** Modal de vista de la Nota de Crédito */
function NCModal({ r, onClose }: { r: NCRow; onClose: () => void }) {
  return (
    <ModalDoc etiqueta={`Nota de crédito ${r.folio}`} onClose={onClose}>
      <CabeceraDoc
        folio={r.folio}
        badge={{ label: "Registrada", cls: "bg-lime-400/15 text-[#4d7c0f]" }}
        onClose={onClose}
        extra={
          <a
            href={`/dashboard/compras/facturas/${r.factura.id}`}
            className="font-mono text-xs font-bold text-electric-600 hover:underline"
          >
            ← {r.factura.folio}
          </a>
        }
        detalle={
          <>
            🚚 {r.proveedor} · sobre factura N°{" "}
            <b className="text-navy-950">{r.factura.numero}</b> · {r.fecha} · creó {r.creo}
            <br />📝 {r.motivo}
          </>
        }
      />
      <LineasDoc
        columnas={[
          { label: "Producto" },
          { label: "Cant. devuelta", align: "center" },
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
        <span className="text-sm text-slate-500">
          Total devuelto (c/IVA):{" "}
          <b className="text-lg tabular-nums text-fenix-600">−{formatCLP(r.total)}</b>
          <span className="ml-2 text-slate-400">· {r.unidades} unidades · rebaja stock y deuda</span>
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

export function NCLista({ rows }: { rows: NCRow[] }) {
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtradas = rows.filter(
    (r) =>
      !q ||
      r.folio.toLowerCase().includes(q) ||
      r.factura.folio.toLowerCase().includes(q) ||
      r.factura.numero.toLowerCase().includes(q) ||
      r.proveedor.toLowerCase().includes(q) ||
      r.motivo.toLowerCase().includes(q),
  );
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-400">{filtradas.length} notas de crédito</span>
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Folio, factura, proveedor…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Folio</th>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Doc. base</th>
            <th className="px-4 py-2.5">Proveedor</th>
            <th className="px-4 py-2.5">Motivo</th>
            <th className="px-4 py-2.5 text-right">Unidades</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Creó</th>
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
                <a
                  href={`/dashboard/compras/facturas/${r.factura.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-xs font-bold text-electric-600 hover:underline"
                >
                  {r.factura.folio}
                </a>
                <p className="text-xs text-slate-400">N° {r.factura.numero}</p>
              </td>
              <td className="px-4 py-2 text-slate-600">{r.proveedor}</td>
              <td className="max-w-56 truncate px-4 py-2 text-slate-600" title={r.motivo}>
                {r.motivo}
              </td>
              <td className="px-4 py-2 text-right font-bold text-navy-950">{r.unidades}</td>
              <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                {formatCLP(r.total)}
              </td>
              <td className="px-4 py-2 text-slate-600">{r.creo}</td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0
                  ? "Aún no hay notas de crédito. Se crean desde el detalle de una Factura de Compra."
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
          return r ? <NCModal r={r} onClose={() => setAbierto(null)} /> : null;
        })()}
    </div>
  );
}
