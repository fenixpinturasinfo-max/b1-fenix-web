"use client";

import { useState } from "react";
import { formatCLP } from "@/lib/format";
import { cambiarEstadoPedido } from "../actions";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, theadSticky } from "@/components/ui/lista";

export interface PedidoLineaRow {
  id: string;
  producto: string;
  sku: string;
  cantidad: number;
  precio: number;
}

export interface PedidoRow {
  id: string;
  folio: string;
  fecha: string;
  cliente: string;
  telefono: string | null;
  local: string;
  nota: string | null;
  total: number;
  estado: "PENDIENTE" | "PREPARADO" | "ENTREGADO" | "ANULADO";
  puedeGestionar: boolean;
  lineas: PedidoLineaRow[];
}

const badges: Record<PedidoRow["estado"], { label: string; cls: string }> = {
  PENDIENTE: { label: "Pendiente", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  PREPARADO: { label: "Preparado", cls: "bg-electric-50 text-electric-600" },
  ENTREGADO: { label: "Entregado", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  ANULADO: { label: "Anulado", cls: "bg-fenix-600/10 text-fenix-600" },
};

const PAGINA = 10;
export type FiltroPedido = "TODOS" | "PENDIENTE" | "PREPARADO" | "ENTREGADO" | "ANULADO";
type Filtro = FiltroPedido;

const pasa = (r: PedidoRow, f: Filtro) => (f === "TODOS" ? true : r.estado === f);

function BotonEstado({
  id,
  accion,
  label,
  primario,
}: {
  id: string;
  accion: string;
  label: string;
  primario?: boolean;
}) {
  return (
    <form action={cambiarEstadoPedido} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="accion" value={accion} />
      <button
        type="submit"
        onClick={(e) => {
          if (accion === "anular" && !window.confirm("¿Anular este pedido?")) e.preventDefault();
        }}
        className={
          primario
            ? "whitespace-nowrap rounded-lg bg-electric-600 px-3 py-1 text-xs font-bold text-white transition hover:opacity-90"
            : "whitespace-nowrap rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600"
        }
      >
        {label}
      </button>
    </form>
  );
}

export function PedidosLista({
  rows,
  filtroInicial = "TODOS",
}: {
  rows: PedidoRow[];
  /** Prefiltro al entrar desde el dashboard (?estado=PENDIENTE) */
  filtroInicial?: FiltroPedido;
}) {
  const [filtro, setFiltro] = useState<Filtro>(filtroInicial);
  const [query, setQuery] = useState("");
  const [pagina, setPagina] = useState(1);
  const [abierto, setAbierto] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const filtrados = rows.filter(
    (r) =>
      pasa(r, filtro) &&
      (!q ||
        r.folio.toLowerCase().includes(q) ||
        r.cliente.toLowerCase().includes(q) ||
        r.lineas.some((l) => l.producto.toLowerCase().includes(q))),
  );
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const etiquetas: Record<Filtro, string> = {
    TODOS: "Todos",
    PENDIENTE: "Pendientes",
    PREPARADO: "Preparados",
    ENTREGADO: "Entregados",
    ANULADO: "Anulados",
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={(
            ["TODOS", "PENDIENTE", "PREPARADO", "ENTREGADO", "ANULADO"] as const
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
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Folio, cliente o producto…"
        />
      </div>

      <div className="max-h-[calc(100vh-320px)] overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className={theadSticky}>
            <tr>
              <th className="px-4 py-2.5">Pedido</th>
              <th className="px-4 py-2.5">Fecha</th>
              <th className="px-4 py-2.5">Cliente</th>
              <th className="px-4 py-2.5">Retiro en</th>
              <th className="px-4 py-2.5 text-right">Ítems</th>
              <th className="px-4 py-2.5 text-right">Total</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => {
              const badge = badges[r.estado];
              const abiertoEste = abierto === r.id;
              return (
                <FilaPedido
                  key={r.id}
                  r={r}
                  badge={badge}
                  abierto={abiertoEste}
                  onToggle={() => setAbierto(abiertoEste ? null : r.id)}
                />
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  {rows.length === 0
                    ? "Aún no hay pedidos. Crea el primero con el botón de arriba."
                    : "Sin resultados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-center">
        <Paginacion total={filtrados.length} pagina={pagina} porPagina={PAGINA} onChange={setPagina} />
      </div>
    </div>
  );
}

function FilaPedido({
  r,
  badge,
  abierto,
  onToggle,
}: {
  r: PedidoRow;
  badge: { label: string; cls: string };
  abierto: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="whitespace-nowrap px-4 py-2">
          <button
            type="button"
            onClick={onToggle}
            className="font-mono font-bold text-navy-950 hover:text-electric-600"
            title="Ver detalle"
          >
            <span
              aria-hidden="true"
              className={`mr-1 inline-block text-xs text-slate-400 transition-transform ${
                abierto ? "rotate-90" : ""
              }`}
            >
              ▸
            </span>
            {r.folio}
          </button>
        </td>
        <td className="whitespace-nowrap px-4 py-2 text-slate-600">{r.fecha}</td>
        <td className="px-4 py-2">
          <p className="font-semibold text-navy-950">{r.cliente}</p>
          {r.telefono && <p className="text-xs text-slate-400">{r.telefono}</p>}
        </td>
        <td className="px-4 py-2 text-slate-600">{r.local}</td>
        <td className="px-4 py-2 text-right text-slate-600">
          {r.lineas.reduce((n, l) => n + l.cantidad, 0)}
        </td>
        <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
          {formatCLP(r.total)}
        </td>
        <td className="px-4 py-2">
          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          {r.puedeGestionar && (
            <div className="flex justify-end gap-1.5">
              {r.estado === "PENDIENTE" && (
                <BotonEstado id={r.id} accion="preparar" label="▸ Preparado" primario />
              )}
              {r.estado === "PREPARADO" && (
                <BotonEstado id={r.id} accion="entregar" label="✓ Entregado" primario />
              )}
              {(r.estado === "PENDIENTE" || r.estado === "PREPARADO") && (
                <BotonEstado id={r.id} accion="anular" label="Anular" />
              )}
            </div>
          )}
        </td>
      </tr>
      {abierto && (
        <tr className="border-b border-slate-100 bg-electric-50/40">
          <td colSpan={8} className="px-4 py-3">
            <ul className="space-y-1 pl-5 text-sm">
              {r.lineas.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 flex-1 truncate font-semibold text-navy-950">
                    {l.producto}
                    <span className="ml-1.5 font-mono text-xs font-normal text-slate-400">{l.sku}</span>
                  </span>
                  <span className="text-slate-600">× {l.cantidad}</span>
                  <span className="w-24 text-right font-bold tabular-nums text-navy-950">
                    {formatCLP(l.precio * l.cantidad)}
                  </span>
                </li>
              ))}
              {r.nota && <li className="pt-1 text-xs text-slate-500">📝 {r.nota}</li>}
              <li className="pt-1 text-xs text-slate-400">
                💡 El cobro y descuento de stock se hacen en el POS al entregar.
              </li>
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
