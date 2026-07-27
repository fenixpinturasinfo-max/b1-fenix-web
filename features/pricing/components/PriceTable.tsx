"use client";

import { useActionState, useEffect, useState } from "react";
import { actualizarPrecio, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";

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

function EditModal({ row, onClose }: { row: PriceRow; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(actualizarPrecio, {});
  const input =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

  // Cerrar con Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar producto ${row.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-navy-950">
              ✏️ Editar producto ·{" "}
              <span className="font-mono text-electric-600">{row.sku}</span>
            </h3>
            <p className="text-sm text-slate-500">
              {row.nombre} · {row.marca} · los cambios rigen al instante en POS y tienda online.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
          >
            ✕
          </button>
        </div>

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="productoId" value={row.productoId} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Precio costo</label>
            <input name="precioCosto" type="number" min={0} defaultValue={row.precioCosto} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Precio venta *</label>
            <input name="precioVenta" type="number" min={1} required defaultValue={row.precioVenta} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">
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
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Código de barra</label>
            <input
              name="codigoBarra"
              defaultValue={row.codigoBarra ?? ""}
              placeholder="Escanea aquí"
              className={input}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Imagen (URL o /productos/archivo.jpg)
            </label>
            <input
              name="imagen"
              defaultValue={row.imagen ?? ""}
              placeholder="https://… o /productos/laca-hs.jpg"
              className={input}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
            >
              Cerrar
            </button>
          </div>
          {state.error && (
            <p className="text-sm font-semibold text-fenix-600 sm:col-span-2">{state.error}</p>
          )}
          {state.ok && (
            <p className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2">✅ {state.ok}</p>
          )}
        </form>
      </div>
    </div>
  );
}

const PAGINA = 10;

export function PriceTable({ rows, categorias }: { rows: PriceRow[]; categorias: string[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("todas");
  const [editing, setEditing] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtrados = rows.filter((r) => {
    if (cat !== "todas" && r.categoria !== cat) return false;
    if (q && !r.nombre.toLowerCase().includes(q) && !r.sku.toLowerCase().includes(q) && !r.marca.toLowerCase().includes(q) && !(r.codigoBarra ?? "").includes(q))
      return false;
    return true;
  });
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por nombre, SKU o marca…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPagina(1);
          }}
          className="h-11 w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
        <select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por categoría"
          className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        >
          <option value="todas">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <span className="ml-auto text-sm text-slate-400">{filtrados.length} productos</span>
      </div>

      <div className="max-h-[calc(100vh-320px)] overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wider text-slate-500 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
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
                  onEdit={() => setEditing(editing === r.productoId ? null : r.productoId)}
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

      <div className="mt-3 flex justify-center">
        <Paginacion
          total={filtrados.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Margen = (venta − costo) / venta. Rojo &lt;15% · Ámbar &lt;30% · Verde ≥30%. Los precios
        rigen para todos los locales y se actualizan al instante en la tienda online y el POS.
      </p>

      {/* Modal de edición (fuera de la tabla: HTML válido) */}
      {editing &&
        (() => {
          const r = rows.find((x) => x.productoId === editing);
          return r ? <EditModal row={r} onClose={() => setEditing(null)} /> : null;
        })()}
    </div>
  );
}

function FragmentRow({
  row,
  badge,
  onEdit,
}: {
  row: PriceRow;
  badge: { label: string; cls: string };
  onEdit: () => void;
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
            Editar
          </button>
        </td>
      </tr>
    </>
  );
}
