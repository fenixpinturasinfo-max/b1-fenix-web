"use client";

import { useActionState, useState } from "react";
import { actualizarParametros, type ActionState } from "../actions";

export interface StockRow {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  cantidad: number;
  stockMin: number;
  stockMax: number | null;
  ubicacion: string | null;
  codigoBarra: string | null;
}

function estadoDe(row: StockRow): { label: string; cls: string } {
  if (row.cantidad <= 0) return { label: "Sin stock", cls: "bg-fenix-600/10 text-fenix-600" };
  if (row.cantidad <= row.stockMin) return { label: "Bajo mínimo", cls: "bg-[#f59e0b]/15 text-[#b45309]" };
  return { label: "OK", cls: "bg-lime-400/15 text-[#4d7c0f]" };
}

function EditRow({ row, localId, onClose }: { row: StockRow; localId: string; onClose: () => void }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    actualizarParametros,
    {},
  );
  const input =
    "h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-sm text-navy-950 outline-none focus:border-electric-500";

  return (
    <tr className="border-b border-slate-100 bg-cloud/60">
      <td colSpan={7} className="px-5 py-4">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="productoId" value={row.productoId} />
          <input type="hidden" name="localId" value={localId} />
          <div className="w-24">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Stock mín</label>
            <input name="stockMin" type="number" min={0} defaultValue={row.stockMin} className={input} />
          </div>
          <div className="w-24">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Stock máx</label>
            <input name="stockMax" type="number" min={0} defaultValue={row.stockMax ?? ""} className={input} />
          </div>
          <div className="min-w-48 flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-600">Ubicación</label>
            <input
              name="ubicacion"
              defaultValue={row.ubicacion ?? ""}
              placeholder="Ej: Pasillo 2 - Estante B"
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

export function StockTable({ rows, localId }: { rows: StockRow[]; localId: string }) {
  const [query, setQuery] = useState("");
  const [soloBajos, setSoloBajos] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const q = query.trim().toLowerCase();
  const visibles = rows.filter((r) => {
    if (q && !r.nombre.toLowerCase().includes(q) && !r.sku.toLowerCase().includes(q) && !r.marca.toLowerCase().includes(q) && !(r.codigoBarra ?? "").includes(q))
      return false;
    if (soloBajos && r.cantidad > r.stockMin) return false;
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
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={soloBajos}
            onChange={(e) => setSoloBajos(e.target.checked)}
            className="h-4 w-4 accent-[#ff4d26]"
          />
          Solo bajo mínimo / sin stock
        </label>
        <span className="ml-auto text-sm text-slate-400">{visibles.length} productos</span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">SKU</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3 text-right">Stock</th>
              <th className="px-5 py-3 text-right">Mín / Máx</th>
              <th className="px-5 py-3">Ubicación</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((r) => {
              const estado = estadoDe(r);
              return (
                <FragmentRow
                  key={r.productoId}
                  row={r}
                  estado={estado}
                  localId={localId}
                  editing={editing === r.productoId}
                  onEdit={() => setEditing(editing === r.productoId ? null : r.productoId)}
                  onClose={() => setEditing(null)}
                />
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FragmentRow({
  row,
  estado,
  localId,
  editing,
  onEdit,
  onClose,
}: {
  row: StockRow;
  estado: { label: string; cls: string };
  localId: string;
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
        <td className="px-5 py-3 text-right text-lg font-bold text-navy-950">{row.cantidad}</td>
        <td className="px-5 py-3 text-right text-slate-600">
          {row.stockMin} / {row.stockMax ?? "—"}
        </td>
        <td className="px-5 py-3 text-slate-600">{row.ubicacion ?? "—"}</td>
        <td className="px-5 py-3">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${estado.cls}`}>
            {estado.label}
          </span>
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
      {editing && <EditRow row={row} localId={localId} onClose={onClose} />}
    </>
  );
}
