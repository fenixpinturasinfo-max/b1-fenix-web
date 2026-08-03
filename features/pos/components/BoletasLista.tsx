"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";

export interface BoletaRow {
  id: string;
  folio: string;
  fecha: string;
  local: string;
  vendedor: string;
  medio: string; // clave del enum
  items: number;
  total: number;
  anulada: boolean;
  premium: boolean;
}

const medioLabel: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

const PAGINA = 10;
type Filtro = "TODAS" | "EFECTIVO" | "DEBITO" | "CREDITO" | "TRANSFERENCIA";

const pasa = (r: BoletaRow, f: Filtro) => (f === "TODAS" ? true : r.medio === f);

export function BoletasLista({ rows }: { rows: BoletaRow[] }) {
  const [filtro, setFiltro] = useState<Filtro>("TODAS");
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtradas = rows.filter(
    (r) =>
      pasa(r, filtro) &&
      (!q ||
        r.folio.toLowerCase().includes(q) ||
        r.vendedor.toLowerCase().includes(q) ||
        r.local.toLowerCase().includes(q)),
  );
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(["TODAS", "EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"] as const).map(
            (f) => ({
              valor: f,
              label: f === "TODAS" ? "Todas" : medioLabel[f],
              n: rows.filter((r) => pasa(r, f)).length,
            }),
          )}
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
          placeholder="Folio, vendedor o local…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Boleta</th>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Local</th>
            <th className="px-4 py-2.5">Vendedor</th>
            <th className="px-4 py-2.5">Medio</th>
            <th className="px-4 py-2.5 text-right">Ítems</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => (
            <tr key={r.id} className="border-b border-slate-100 last:border-0">
              <td className="whitespace-nowrap px-4 py-2">
                <span className="font-mono font-bold text-navy-950">{r.folio}</span>
                {r.anulada && (
                  <span className="ml-2 rounded-full bg-fenix-600/10 px-2 py-0.5 text-xs font-bold text-fenix-600">
                    Anulada
                  </span>
                )}
                {r.premium && (
                  <span className="ml-2 rounded-full bg-[#f59e0b]/15 px-2 py-0.5 text-xs font-bold text-[#b45309]">
                    ⭐ Premium
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.fecha}</td>
              <td className="px-4 py-2 text-slate-600">{r.local}</td>
              <td className="px-4 py-2 text-slate-600">{r.vendedor}</td>
              <td className="px-4 py-2 text-slate-600">{medioLabel[r.medio]}</td>
              <td className="px-4 py-2 text-right text-slate-600">{r.items}</td>
              <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                {formatCLP(r.total)}
              </td>
              <td className="px-4 py-2 text-right">
                <a
                  href={`/dashboard/pos/boletas/${r.id}`}
                  className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                >
                  Ver
                </a>
              </td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0 ? "Aún no hay ventas registradas." : "Sin resultados."}
              </td>
            </tr>
          )}
        </tbody>
      </TablaScroll>

      <div className="flex justify-center">
        <Paginacion total={filtradas.length} pagina={pagina} porPagina={PAGINA} onChange={setPagina} />
      </div>
    </div>
  );
}
