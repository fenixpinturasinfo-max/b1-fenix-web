"use client";

import { useActionState, useState } from "react";
import { guardarPrecioCompra, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";

export interface PrecioRow {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  cpp: number; // costo promedio ponderado (referencia)
  precio: number | null; // precio de compra con este proveedor
  origen: string | null;
  actualizadoEn: string | null; // ya formateado
}

function Fila({ row, proveedorId }: { row: PrecioRow; proveedorId: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    guardarPrecioCompra,
    {},
  );

  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.sku}</td>
      <td className="px-5 py-3">
        <p className="font-semibold text-navy-950">{row.nombre}</p>
        <p className="text-xs text-slate-400">{row.marca}</p>
      </td>
      <td className="px-5 py-3 text-right tabular-nums text-slate-500">{formatCLP(row.cpp)}</td>
      <td className="px-5 py-3">
        <form action={action} className="flex items-center justify-end gap-2">
          <input type="hidden" name="proveedorId" value={proveedorId} />
          <input type="hidden" name="productoId" value={row.productoId} />
          <input
            name="precio"
            type="number"
            min={0}
            defaultValue={row.precio ?? ""}
            placeholder="—"
            aria-label={`Precio de compra de ${row.nombre}`}
            className="h-10 w-28 rounded-lg border border-slate-300 bg-white px-2 text-right font-bold tabular-nums text-navy-950 outline-none focus:border-electric-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-600 transition hover:border-electric-500 hover:text-electric-600 disabled:opacity-50"
          >
            {pending ? "…" : "Guardar"}
          </button>
        </form>
        {state.error && (
          <p className="mt-1 text-right text-xs font-semibold text-fenix-600">{state.error}</p>
        )}
        {state.ok && (
          <p className="mt-1 text-right text-xs font-semibold text-[#4d7c0f]">✓ {state.ok}</p>
        )}
      </td>
      <td className="px-5 py-3 text-xs text-slate-500">
        {row.origen ?? "—"}
        {row.actualizadoEn && <p className="text-slate-400">{row.actualizadoEn}</p>}
      </td>
    </tr>
  );
}

export function PreciosCompra({
  rows,
  proveedorId,
}: {
  rows: PrecioRow[];
  proveedorId: string;
}) {
  const [query, setQuery] = useState("");
  const [soloConPrecio, setSoloConPrecio] = useState(false);
  const [pagina, setPagina] = useState(1);
  const PAGINA = 10;

  const q = query.trim().toLowerCase();
  const filtrados = rows.filter((r) => {
    if (
      q &&
      !r.nombre.toLowerCase().includes(q) &&
      !r.sku.toLowerCase().includes(q) &&
      !r.marca.toLowerCase().includes(q)
    )
      return false;
    if (soloConPrecio && r.precio === null) return false;
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
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={soloConPrecio}
            onChange={(e) => {
              setSoloConPrecio(e.target.checked);
              setPagina(1);
            }}
            className="h-4 w-4 accent-[#0e518d]"
          />
          Solo con precio
        </label>
        <span className="ml-auto text-sm text-slate-400">{filtrados.length} productos</span>
      </div>

      <div className="max-h-[calc(100vh-320px)] overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wider text-slate-500 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3 text-right">CPP ref.</th>
              <th className="px-5 py-3 text-right">Precio compra (neto)</th>
              <th className="px-5 py-3">Origen</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => (
              <Fila key={r.productoId} row={r} proveedorId={proveedorId} />
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                  Sin resultados.
                </td>
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
    </div>
  );
}
