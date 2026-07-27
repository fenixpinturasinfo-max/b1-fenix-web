"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";

export type TipoPartidaVenta = "PED" | "BOL";

export interface PartidaVenta {
  key: string;
  tipo: TipoPartidaVenta;
  folio: string;
  fecha: string;
  contraparte: string; // cliente (pedido) o vendedor (boleta)
  local: string;
  detalle: string;
  total: number;
  estado: string;
  tono: "warn" | "ok" | "info" | "error";
  abierto: boolean;
  href: string;
}

const tipoBadge: Record<TipoPartidaVenta, { label: string; cls: string }> = {
  PED: { label: "Pedido", cls: "bg-electric-50 text-electric-600" },
  BOL: { label: "Boleta", cls: "bg-lime-400/15 text-[#4d7c0f]" },
};

const tonoCls: Record<PartidaVenta["tono"], string> = {
  warn: "bg-[#f59e0b]/15 text-[#b45309]",
  ok: "bg-lime-400/15 text-[#4d7c0f]",
  info: "bg-electric-50 text-electric-600",
  error: "bg-fenix-600/10 text-fenix-600",
};

const PAGINA = 10;
type Filtro = TipoPartidaVenta | "TODOS";

export function ListaPartidasVentas({ partidas }: { partidas: PartidaVenta[] }) {
  const [tipo, setTipo] = useState<Filtro>("TODOS");
  const [local, setLocal] = useState("TODOS");
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(1);

  const locales = [...new Set(partidas.map((p) => p.local))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const q = query.trim().toLowerCase();
  const filtradas = partidas.filter((p) => {
    if (tipo !== "TODOS" && p.tipo !== tipo) return false;
    if (local !== "TODOS" && p.local !== local) return false;
    if (soloAbiertos && !p.abierto) return false;
    if (
      q &&
      !p.folio.toLowerCase().includes(q) &&
      !p.contraparte.toLowerCase().includes(q) &&
      !p.local.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(["TODOS", "PED", "BOL"] as const).map((f) => ({
            valor: f,
            label: f === "TODOS" ? "Todos" : `${tipoBadge[f].label}s`,
            n:
              f === "TODOS"
                ? partidas.length
                : partidas.filter((p) => p.tipo === f).length,
          }))}
          valor={tipo}
          onChange={(f) => {
            setTipo(f);
            setPagina(1);
          }}
        />
        {locales.length > 1 && (
          <>
            <span aria-hidden="true" className="mx-1 h-6 w-px bg-slate-200" />
            <ChipsFiltro<string>
              opciones={[
                { valor: "TODOS", label: "🏪 Todos", n: partidas.length },
                ...locales.map((l) => ({
                  valor: l,
                  label: l,
                  n: partidas.filter((p) => p.local === l).length,
                })),
              ]}
              valor={local}
              onChange={(l) => {
                setLocal(l);
                setPagina(1);
              }}
            />
          </>
        )}
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={soloAbiertos}
            onChange={(e) => {
              setSoloAbiertos(e.target.checked);
              setPagina(1);
            }}
            className="h-4 w-4 accent-[#0e518d]"
          />
          Solo por entregar
        </label>
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Folio, cliente o local…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Tipo</th>
            <th className="px-4 py-2.5">Folio</th>
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-4 py-2.5">Cliente / Vendedor</th>
            <th className="px-4 py-2.5">Local</th>
            <th className="px-4 py-2.5">Detalle</th>
            <th className="px-4 py-2.5 text-right">Total</th>
            <th className="px-4 py-2.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((p) => {
            const tb = tipoBadge[p.tipo];
            return (
              <tr key={p.key} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${tb.cls}`}>
                    {tb.label}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-mono text-xs font-bold text-navy-950">
                  <a href={p.href} className="hover:text-electric-600 hover:underline">
                    {p.folio}
                  </a>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{p.fecha}</td>
                <td className="px-4 py-2 text-slate-600">{p.contraparte}</td>
                <td className="px-4 py-2 text-slate-600">{p.local}</td>
                <td className="whitespace-nowrap px-4 py-2 text-slate-500">{p.detalle}</td>
                <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(p.total)}
                </td>
                <td className="px-4 py-2">
                  <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${tonoCls[p.tono]}`}>
                    {p.estado}
                  </span>
                </td>
              </tr>
            );
          })}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                {partidas.length === 0
                  ? "Aún no hay documentos de ventas."
                  : "Sin resultados para el filtro actual."}
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
