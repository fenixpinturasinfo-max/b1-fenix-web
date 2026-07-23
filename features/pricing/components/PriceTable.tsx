"use client";

import { useActionState, useState } from "react";
import { actualizarPrecio, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

export interface PriceRow {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  categoria: string;
  precioCosto: number;
  precioVenta: number;
  precioAnterior: number | null;
  codigoBarra: string | null;
  imagen: string | null;
}

function margen(row: PriceRow): number | null {
  if (row.precioVenta <= 0 || row.precioCosto <= 0) return null;
  return Math.round(((row.precioVenta - row.precioCosto) / row.precioVenta) * 100);
}

function margenBadge(m: number | null): { label: string; cls: string } {
  if (m === null) return { label: "sin costo", cls: "bg-slate-100 text-slate-400" };
  if (m < 15) return { label: `${m}%`, cls: "bg-fenix-600/10 text-fenix-600" };
  if (m < 30) return { label: `${m}%`, cls: "bg-[#f59e0b]/15 text-[#b45309]" };
  return { label: `${m}%`, cls: "bg-lime-400/15 text-[#4d7c0f]" };
}

function exportCSV(rows: PriceRow[]) {
  const head = "SKU;Producto;Marca;Categoría;Precio Costo;Precio Venta;Margen %\n";
  const body = rows
    .map((r) => {
      const m = margen(r);
      return [r.sku, r.nombre, r.marca, r.categoria, r.precioCosto, r.precioVenta, m ?? ""].join(";");
    })
    .join("\n");
  const blob = new Blob(["﻿" + head + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lista-precios-fenix-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function EditRow({ row, onClose }: { row: PriceRow; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(actualizarPrecio, {});
  const input =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-navy-950 outline-none focus:border-electric-500";

  return (
    <tr className="border-b border-slate-100 bg-cloud/60">
      <td colSpan={7} className="px-5 py-4">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="productoId" value={row.productoId} />
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Precio costo</label>
            <input name="precioCosto" type="number" min={0} defaultValue={row.precioCosto} className={input} />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Precio venta</label>
            <input name="precioVenta" type="number" min={1} required defaultValue={row.precioVenta} className={input} />
          </div>
          <div className="w-40">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Código de barra</label>
            <input
              name="codigoBarra"
              defaultValue={row.codigoBarra ?? ""}
              placeholder="Escanea aquí"
              className={input}
            />
          </div>
          <div className="min-w-56 flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Imagen (URL o /productos/archivo.jpg)
            </label>
            <input
              name="imagen"
              defaultValue={row.imagen ?? ""}
              placeholder="https://… o /productos/laca-hs.jpg"
              className={input}
            />
          </div>
          <div className="w-36">
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Precio anterior (oferta)
            </label>
            <input
              name="precioAnterior"
              type="number"
              min={0}
              defaultValue={row.precioAnterior ?? ""}
              placeholder="Vacío = sin oferta"
              className={input}
            />
          </div>
          <button
            type="submit"
            disabled={pending}
            className="bg-flame h-10 rounded-lg px-5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-600"
          >
            Cerrar
          </button>
          {state.error && <p className="text-sm font-semibold text-fenix-600">{state.error}</p>}
          {state.ok && <p className="text-sm font-semibold text-[#4d7c0f]">{state.ok}</p>}
        </form>
      </td>
    </tr>
  );
}

export function PriceTable({ rows, categorias }: { rows: PriceRow[]; categorias: string[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("todas");
  const [editing, setEditing] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visibles = rows.filter((r) => {
    if (cat !== "todas" && r.categoria !== cat) return false;
    if (q && !r.nombre.toLowerCase().includes(q) && !r.sku.toLowerCase().includes(q) && !r.marca.toLowerCase().includes(q) && !(r.codigoBarra ?? "").includes(q))
      return false;
    return true;
  });

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por nombre, SKU o marca…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-11 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          aria-label="Filtrar por categoría"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400">{visibles.length} productos</span>
        <button
          type="button"
          onClick={() => exportCSV(visibles)}
          className="ml-auto h-11 rounded-xl border-2 border-navy-950 px-5 text-sm font-bold text-navy-950 transition hover:bg-navy-950 hover:text-white"
        >
          ⬇ Exportar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Categoría</th>
              <th className="px-5 py-3 text-right">Costo</th>
              <th className="px-5 py-3 text-right">Venta</th>
              <th className="px-5 py-3 text-right">Margen</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => {
              const badge = margenBadge(margen(r));
              return (
                <FragmentRow
                  key={r.productoId}
                  row={r}
                  badge={badge}
                  editing={editing === r.productoId}
                  onEdit={() => setEditing(editing === r.productoId ? null : r.productoId)}
                  onClose={() => setEditing(null)}
                />
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">Sin resultados.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Margen = (venta − costo) / venta. Rojo &lt;15% · Ámbar &lt;30% · Verde ≥30%. Los precios
        rigen para todos los locales y se actualizan al instante en la tienda online y el POS.
      </p>
    </div>
  );
}

function FragmentRow({
  row,
  badge,
  editing,
  onEdit,
  onClose,
}: {
  row: PriceRow;
  badge: { label: string; cls: string };
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.sku}</td>
        <td className="px-5 py-3">
          <p className="font-semibold text-navy-950">{row.nombre}</p>
          <p className="text-xs text-slate-400">{row.marca}</p>
        </td>
        <td className="px-5 py-3 text-slate-600">{row.categoria}</td>
        <td className="px-5 py-3 text-right tabular-nums text-slate-600">
          {row.precioCosto > 0 ? formatCLP(row.precioCosto) : "—"}
        </td>
        <td className="px-5 py-3 text-right">
          <span className="font-bold tabular-nums text-navy-950">{formatCLP(row.precioVenta)}</span>
          {row.precioAnterior && (
            <span className="ml-2 text-xs text-slate-400 line-through">
              {formatCLP(row.precioAnterior)}
            </span>
          )}
        </td>
        <td className="px-5 py-3 text-right">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
        </td>
        <td className="px-5 py-3 text-right">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
        </td>
      </tr>
      {editing && <EditRow row={row} onClose={onClose} />}
    </>
  );
}
