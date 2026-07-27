"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";

export type TipoPartida = "SOL" | "OC" | "EC" | "FC" | "NC";

export interface Partida {
  key: string;
  tipo: TipoPartida;
  folio: string;
  fecha: string; // ya formateada
  proveedor: string | null;
  local: string | null;
  detalle: string; // ej: "3 líneas · 14 un."
  total: number | null;
  totalNota: "neto" | "c/IVA" | null;
  estado: string;
  tono: "warn" | "ok" | "info" | "muted" | "error";
  abierto: boolean;
  href: string | null;
}

const tipoBadge: Record<TipoPartida, { label: string; cls: string }> = {
  SOL: { label: "Solicitud", cls: "bg-electric-50 text-electric-600" },
  OC: { label: "Orden compra", cls: "bg-[#8b5cf6]/10 text-[#7c3aed]" },
  EC: { label: "Entrada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  FC: { label: "Factura", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  NC: { label: "Nota crédito", cls: "bg-fenix-600/10 text-fenix-600" },
};

const tonoCls: Record<Partida["tono"], string> = {
  warn: "bg-[#f59e0b]/15 text-[#b45309]",
  ok: "bg-lime-400/15 text-[#4d7c0f]",
  info: "bg-electric-50 text-electric-600",
  muted: "bg-slate-100 text-slate-500",
  error: "bg-fenix-600/10 text-fenix-600",
};

const PAGINA = 10;

export function ListaPartidas({ partidas }: { partidas: Partida[] }) {
  const [tipo, setTipo] = useState<TipoPartida | "TODOS">("TODOS");
  const [local, setLocal] = useState("TODOS");
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(1);

  const locales = [...new Set(partidas.map((p) => p.local).filter((l): l is string => !!l))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );

  const q = query.trim().toLowerCase();
  const filtradas = partidas.filter((p) => {
    if (tipo !== "TODOS" && p.tipo !== tipo) return false;
    if (local !== "TODOS" && p.local !== local) return false;
    if (soloAbiertos && !p.abierto) return false;
    if (
      q &&
      !p.folio.toLowerCase().includes(q) &&
      !(p.proveedor ?? "").toLowerCase().includes(q) &&
      !(p.local ?? "").toLowerCase().includes(q)
    )
      return false;
    return true;
  });
  const visibles = filtradas.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const nDe = (t: TipoPartida | "TODOS") =>
    t === "TODOS" ? partidas.length : partidas.filter((p) => p.tipo === t).length;

  const chips: (TipoPartida | "TODOS")[] = ["TODOS", "SOL", "OC", "EC", "FC", "NC"];

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTipo(t);
              setPagina(1);
            }}
            className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
              tipo === t
                ? "bg-electric-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
            }`}
          >
            {t === "TODOS" ? "Todos" : tipoBadge[t].label}
            <span
              className={`rounded-full px-1.5 text-xs ${tipo === t ? "bg-white/20" : "bg-cloud"}`}
            >
              {nDe(t)}
            </span>
          </button>
        ))}
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
                  {partidas.filter((p) => p.local === l).length}
                </span>
              </button>
            ))}
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
          Solo abiertos
        </label>
        <input
          type="search"
          placeholder="Folio, proveedor o local…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPagina(1);
          }}
          className="ml-auto h-10 w-full max-w-64 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Folio</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Proveedor</th>
              <th className="px-5 py-3">Local</th>
              <th className="px-5 py-3">Detalle</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => {
              const tb = tipoBadge[p.tipo];
              const fila = (
                <>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${tb.cls}`}>
                      {tb.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 font-mono text-xs font-bold text-navy-950">
                    {p.href ? (
                      <a href={p.href} className="hover:text-electric-600 hover:underline">
                        {p.folio}
                      </a>
                    ) : (
                      p.folio
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{p.fecha}</td>
                  <td className="px-5 py-3 text-slate-600">{p.proveedor ?? "—"}</td>
                  <td className="px-5 py-3 text-slate-600">{p.local ?? "—"}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-slate-500">{p.detalle}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {p.total !== null ? (
                      <>
                        <span className="font-bold tabular-nums text-navy-950">
                          {formatCLP(p.total)}
                        </span>
                        {p.totalNota && (
                          <span className="ml-1 text-xs text-slate-400">{p.totalNota}</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${tonoCls[p.tono]}`}
                    >
                      {p.estado}
                    </span>
                  </td>
                </>
              );
              return (
                <tr key={p.key} className="border-b border-slate-100 last:border-0">
                  {fila}
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  {partidas.length === 0
                    ? "Aún no hay documentos de compras."
                    : "Sin resultados para el filtro actual."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <Paginacion
          total={filtradas.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>
    </div>
  );
}
