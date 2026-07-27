"use client";

import { useState } from "react";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";

export interface MovimientoRow {
  id: string;
  fecha: string;
  tipo: string;
  producto: string;
  local: string;
  cantidad: number;
  usuario: string;
  nota: string | null;
}

const tipoBadge: Record<string, { label: string; cls: string }> = {
  ENTRADA: { label: "Entrada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  SALIDA_VENTA: { label: "Venta", cls: "bg-navy-950/5 text-navy-950" },
  AJUSTE: { label: "Ajuste", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  MERMA: { label: "Merma", cls: "bg-fenix-600/10 text-fenix-600" },
  TRANSFERENCIA_SALIDA: { label: "Transf. salida", cls: "bg-slate-100 text-slate-600" },
  TRANSFERENCIA_ENTRADA: { label: "Transf. entrada", cls: "bg-slate-100 text-slate-600" },
};

const PAGINA = 10;
type Filtro = "TODOS" | "ENTRADA" | "SALIDA_VENTA" | "AJUSTE" | "MERMA" | "TRANSFERENCIA";

const pasa = (r: MovimientoRow, f: Filtro) =>
  f === "TODOS"
    ? true
    : f === "TRANSFERENCIA"
      ? r.tipo.startsWith("TRANSFERENCIA")
      : r.tipo === f;

export function MovimientosLista({ rows }: { rows: MovimientoRow[] }) {
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [local, setLocal] = useState("TODOS");
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(1);

  const locales = [...new Set(rows.map((r) => r.local))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const q = query.trim().toLowerCase();
  const filtrados = rows.filter(
    (r) =>
      pasa(r, filtro) &&
      (local === "TODOS" || r.local === local) &&
      (!q ||
        r.producto.toLowerCase().includes(q) ||
        r.usuario.toLowerCase().includes(q) ||
        (r.nota ?? "").toLowerCase().includes(q)),
  );
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const etiquetas: Record<Filtro, string> = {
    TODOS: "Todos",
    ENTRADA: "Entradas",
    SALIDA_VENTA: "Ventas",
    AJUSTE: "Ajustes",
    MERMA: "Mermas",
    TRANSFERENCIA: "Transferencias",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(
            ["TODOS", "ENTRADA", "SALIDA_VENTA", "AJUSTE", "MERMA", "TRANSFERENCIA"] as const
          ).map((f) => ({
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
        {locales.length > 1 && (
          <>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200" />
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  setLocal(local === l ? "TODOS" : l);
                  setPagina(1);
                }}
                className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
                  local === l
                    ? "bg-electric-600 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
                }`}
              >
                🏪 {l}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    local === l ? "bg-white/20" : "bg-cloud"
                  }`}
                >
                  {rows.filter((r) => r.local === l).length}
                </span>
              </button>
            ))}
          </>
        )}
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Producto, usuario o nota…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Tipo</th>
            <th className="px-4 py-2.5">Producto</th>
            <th className="px-4 py-2.5">Local</th>
            <th className="px-4 py-2.5 text-right">Cantidad</th>
            <th className="px-4 py-2.5">Usuario</th>
            <th className="px-4 py-2.5">Nota</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((r) => {
            const t = tipoBadge[r.tipo] ?? tipoBadge.AJUSTE;
            return (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.fecha}</td>
                <td className="px-4 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${t.cls}`}>
                    {t.label}
                  </span>
                </td>
                <td className="px-4 py-2 font-semibold text-navy-950">{r.producto}</td>
                <td className="px-4 py-2 text-slate-600">{r.local}</td>
                <td
                  className={`px-4 py-2 text-right font-bold tabular-nums ${
                    r.cantidad < 0 ? "text-fenix-600" : "text-[#4d7c0f]"
                  }`}
                >
                  {r.cantidad > 0 ? `+${r.cantidad}` : r.cantidad}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.usuario}</td>
                <td className="max-w-56 truncate px-4 py-2 text-slate-400" title={r.nota ?? ""}>
                  {r.nota ?? "—"}
                </td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                {rows.length === 0 ? "Aún no hay movimientos registrados." : "Sin resultados."}
              </td>
            </tr>
          )}
        </tbody>
      </TablaScroll>

      <div className="flex justify-center">
        <Paginacion total={filtrados.length} pagina={pagina} porPagina={PAGINA} onChange={setPagina} />
      </div>
    </div>
  );
}
