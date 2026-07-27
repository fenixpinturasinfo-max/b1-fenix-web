"use client";

/**
 * Grilla de líneas estándar para documentos (estilo SAP B1):
 * Nro | Código (combobox) | Descripción | Stock | Cant. | Precio | Total | 🗑
 * + "Añadir otro artículo ＋".
 * La usan Solicitud de compra, Orden de compra y Pedido de venta.
 */

import { useEffect, useRef, useState } from "react";
import { formatCLP } from "@/lib/format";
import { IconTrash } from "@/components/ui/icons";

export interface ArticuloDoc {
  id: string;
  sku: string;
  nombre: string;
  marca: string;
  codigoBarra: string | null;
}

export interface LineaEditor {
  key: number;
  productoId: string | null;
  cantidad: number;
  precio: number;
}

let seq = 1;
export const nuevaLineaEditor = (): LineaEditor => ({
  key: seq++,
  productoId: null,
  cantidad: 1,
  precio: 0,
});

/* ── Combobox de artículo por línea ── */

function BuscadorArticulo({
  productos,
  usados,
  seleccionado,
  onSelect,
  precioDe,
}: {
  productos: ArticuloDoc[];
  usados: Set<string>;
  seleccionado: ArticuloDoc | null;
  onSelect: (p: ArticuloDoc) => void;
  precioDe: (p: ArticuloDoc) => { valor: number; etiqueta: string };
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const q = query.trim().toLowerCase();
  const opciones = productos
    .filter((p) => !usados.has(p.id) || p.id === seleccionado?.id)
    .filter(
      (p) =>
        !q ||
        p.sku.toLowerCase().includes(q) ||
        p.nombre.toLowerCase().includes(q) ||
        p.marca.toLowerCase().includes(q) ||
        (p.codigoBarra ?? "").includes(q),
    )
    .slice(0, 8);

  return (
    <div ref={ref} className="relative min-w-72">
      <input
        value={open ? query : seleccionado ? `${seleccionado.sku} · ${seleccionado.nombre}` : ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        placeholder="🔍 Buscar por código o descripción…"
        aria-label="Buscar artículo por código o descripción"
        className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 pr-9 text-sm font-semibold text-navy-950 outline-none transition focus:border-electric-500"
        autoComplete="off"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        ▾
      </span>
      {open && opciones.length > 0 && (
        <ul className="absolute left-0 z-20 mt-1 max-h-80 w-[30rem] max-w-[85vw] overflow-auto rounded-xl border border-slate-200 bg-white shadow-xl">
          {opciones.map((p) => {
            const pd = precioDe(p);
            return (
              <li key={p.id} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onSelect(p);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-electric-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-navy-950">
                      {p.nombre}
                    </span>
                    <span className="font-mono text-xs font-bold text-electric-600">{p.sku}</span>
                    <span className="text-xs text-slate-400"> · {p.marca}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-slate-600">
                      {formatCLP(pd.valor)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase ${
                        pd.etiqueta === "Prov." ? "text-electric-600" : "text-slate-400"
                      }`}
                    >
                      {pd.etiqueta}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {open && q && opciones.length === 0 && (
        <p className="absolute left-0 z-20 mt-1 w-[30rem] max-w-[85vw] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400 shadow-xl">
          Sin resultados para “{query}”.
        </p>
      )}
    </div>
  );
}

/* ── Grilla de líneas ── */

export function EditorLineas({
  productos,
  lineas,
  onChange,
  precioDe,
  stockDe,
  etiquetaPrecio = "Precio",
  precioEditable = true,
}: {
  productos: ArticuloDoc[];
  lineas: LineaEditor[];
  onChange: (lineas: LineaEditor[]) => void;
  /** precio sugerido al seleccionar un artículo (y mostrado en el combobox) */
  precioDe: (p: ArticuloDoc) => { valor: number; etiqueta: string };
  /** stock a mostrar (null = ocultar columna) */
  stockDe?: ((productoId: string) => number) | null;
  etiquetaPrecio?: string;
  precioEditable?: boolean;
}) {
  const productoDe = (id: string | null) =>
    id ? productos.find((p) => p.id === id) ?? null : null;
  const usados = new Set(lineas.map((l) => l.productoId).filter(Boolean) as string[]);
  const conStock = stockDe != null;

  const setLinea = (key: number, patch: Partial<LineaEditor>) =>
    onChange(lineas.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const quitar = (key: number) =>
    onChange(lineas.length > 1 ? lineas.filter((l) => l.key !== key) : [nuevaLineaEditor()]);

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-cloud/60 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3 text-center">Nro.</th>
              <th className="px-3 py-3">Código</th>
              <th className="px-3 py-3">Descripción</th>
              {conStock && <th className="px-3 py-3 text-center">Stock</th>}
              <th className="px-3 py-3 text-center">Cant.</th>
              <th className="px-3 py-3 text-right">{etiquetaPrecio}</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {lineas.map((l, idx) => {
              const p = productoDe(l.productoId);
              const stock = p && conStock ? stockDe!(p.id) : null;
              return (
                <tr key={l.key} className="border-b border-slate-100 align-middle last:border-0">
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-500">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2.5">
                    <BuscadorArticulo
                      productos={productos}
                      usados={usados}
                      seleccionado={p}
                      precioDe={precioDe}
                      onSelect={(prod) =>
                        setLinea(l.key, {
                          productoId: prod.id,
                          precio: precioDe(prod).valor,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {p ? (
                      <>
                        <p className="font-semibold text-navy-950">{p.nombre}</p>
                        <p className="text-xs text-slate-400">{p.marca}</p>
                      </>
                    ) : (
                      <span className="text-slate-300">Descripción del artículo…</span>
                    )}
                  </td>
                  {conStock && (
                    <td className="px-3 py-2.5 text-center">
                      {stock !== null ? (
                        <span
                          className={`inline-block min-w-9 rounded-lg border px-2 py-1.5 font-bold ${
                            stock <= 0
                              ? "border-fenix-600/30 bg-fenix-600/5 text-fenix-600"
                              : "border-slate-200 bg-cloud/60 text-navy-950"
                          }`}
                        >
                          {stock}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      min={1}
                      value={l.cantidad}
                      onChange={(e) =>
                        setLinea(l.key, {
                          cantidad: Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                        })
                      }
                      disabled={!p}
                      aria-label="Cantidad"
                      className="mx-auto block h-10 w-16 rounded-lg border border-slate-300 bg-white text-center font-bold text-navy-950 outline-none focus:border-electric-500 disabled:bg-cloud/60"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    {precioEditable ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        value={p ? formatCLP(l.precio) : ""}
                        onChange={(e) =>
                          setLinea(l.key, {
                            precio: Number(e.target.value.replace(/[^\d]/g, "")) || 0,
                          })
                        }
                        disabled={!p}
                        aria-label="Precio unitario"
                        className="ml-auto block h-10 w-28 rounded-lg border border-slate-300 bg-white pr-3 text-right font-semibold tabular-nums text-navy-950 outline-none focus:border-electric-500 disabled:bg-cloud/60"
                      />
                    ) : (
                      <span className="block text-right font-semibold tabular-nums text-navy-950">
                        {p ? formatCLP(l.precio) : "—"}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold tabular-nums text-navy-950">
                    {p ? formatCLP(l.cantidad * l.precio) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => quitar(l.key)}
                      aria-label={`Quitar línea ${idx + 1}`}
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-fenix-600/10 hover:text-fenix-600"
                    >
                      <IconTrash />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => onChange([...lineas, nuevaLineaEditor()])}
          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-electric-600 transition hover:bg-electric-50"
        >
          Añadir otro artículo
          <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-electric-600 text-base leading-none">
            +
          </span>
        </button>
      </div>
    </>
  );
}
