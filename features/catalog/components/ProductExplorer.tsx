"use client";

import { useState } from "react";
import { categories } from "../data/products";
import type { CategoryId, Product } from "../types";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 12;

/* ── Facetas ── */

const RANGOS = [
  { id: "r1", label: "Hasta $15.000", min: 0, max: 15000 },
  { id: "r2", label: "$15.000 a $50.000", min: 15001, max: 50000 },
  { id: "r3", label: "Más de $50.000", min: 50001, max: Infinity },
] as const;

const LOCALES = [
  { id: "san-bernardo", nombre: "San Bernardo" },
  { id: "buin", nombre: "Buin" },
] as const;

interface Filtros {
  cat: CategoryId | "todos";
  marcas: Set<string>;
  rango: string | null;
  locales: Set<string>;
}

const sinFiltros = (): Filtros => ({
  cat: "todos",
  marcas: new Set(),
  rango: null,
  locales: new Set(),
});

/** ¿El producto pasa los filtros? `omitir` permite calcular contadores facetados. */
function pasa(p: Product, f: Filtros, omitir?: keyof Filtros): boolean {
  if (omitir !== "cat" && f.cat !== "todos" && p.categoria !== f.cat) return false;
  if (omitir !== "marcas" && f.marcas.size > 0 && !f.marcas.has(p.marca)) return false;
  if (omitir !== "rango" && f.rango) {
    const r = RANGOS.find((x) => x.id === f.rango);
    if (r && (p.precioVenta < r.min || p.precioVenta > r.max)) return false;
  }
  if (omitir !== "locales" && f.locales.size > 0) {
    const disponible = [...f.locales].some((l) => (p.stock?.[l] ?? 0) > 0);
    if (!disponible) return false;
  }
  return true;
}

/* ── Panel de facetas (compartido desktop / bottom-sheet móvil) ── */

function FacetPanel({
  products,
  f,
  setF,
  onAplicado,
}: {
  products: Product[];
  f: Filtros;
  setF: (next: Filtros) => void;
  onAplicado?: () => void;
}) {
  const marcas = [...new Set(products.map((p) => p.marca))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
  const n = (omitir: keyof Filtros, test: (p: Product) => boolean) =>
    products.filter((p) => pasa(p, f, omitir) && test(p)).length;

  const grupo = "border-b border-slate-200 pb-4";
  const titulo = "mb-2 text-xs font-bold uppercase tracking-wider text-slate-400";
  const fila =
    "flex w-full cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-slate-700 transition hover:text-electric-600";
  const contador = "ml-auto text-xs text-slate-400";

  const marcar = (next: Filtros) => {
    setF(next);
    onAplicado?.();
  };

  return (
    <div className="space-y-4">
      {/* Categoría (selección única) */}
      <div className={grupo}>
        <p className={titulo}>Categoría</p>
        <button
          type="button"
          onClick={() => marcar({ ...f, cat: "todos" })}
          className={`${fila} ${f.cat === "todos" ? "font-bold text-electric-600" : ""}`}
        >
          Todas
          <span className={contador}>{products.length}</span>
        </button>
        {categories
          .filter((c) => products.some((p) => p.categoria === c.id))
          .map((c) => {
            const count = n("cat", (p) => p.categoria === c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => marcar({ ...f, cat: f.cat === c.id ? "todos" : c.id })}
                disabled={count === 0}
                className={`${fila} disabled:cursor-default disabled:opacity-40 ${
                  f.cat === c.id ? "font-bold text-electric-600" : ""
                }`}
              >
                {c.nombre}
                <span className={contador}>{count}</span>
              </button>
            );
          })}
      </div>

      {/* Marca (selección múltiple) */}
      <div className={grupo}>
        <p className={titulo}>Marca</p>
        {marcas.map((m) => {
          const count = n("marcas", (p) => p.marca === m);
          return (
            <label key={m} className={`${fila} ${count === 0 ? "opacity-40" : ""}`}>
              <input
                type="checkbox"
                checked={f.marcas.has(m)}
                disabled={count === 0 && !f.marcas.has(m)}
                onChange={() => {
                  const next = new Set(f.marcas);
                  if (next.has(m)) next.delete(m);
                  else next.add(m);
                  marcar({ ...f, marcas: next });
                }}
                className="h-4 w-4 accent-[#0e518d]"
              />
              {m}
              <span className={contador}>{count}</span>
            </label>
          );
        })}
      </div>

      {/* Precio (selección única) */}
      <div className={grupo}>
        <p className={titulo}>Precio</p>
        {RANGOS.map((r) => {
          const count = n("rango", (p) => p.precioVenta >= r.min && p.precioVenta <= r.max);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => marcar({ ...f, rango: f.rango === r.id ? null : r.id })}
              disabled={count === 0 && f.rango !== r.id}
              className={`${fila} disabled:cursor-default disabled:opacity-40 ${
                f.rango === r.id ? "font-bold text-electric-600" : ""
              }`}
            >
              {r.label}
              <span className={contador}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Disponibilidad por local (selección múltiple) */}
      <div>
        <p className={titulo}>Retiro inmediato en</p>
        {LOCALES.map((l) => {
          const count = n("locales", (p) => (p.stock?.[l.id] ?? 0) > 0);
          return (
            <label key={l.id} className={`${fila} ${count === 0 ? "opacity-40" : ""}`}>
              <input
                type="checkbox"
                checked={f.locales.has(l.id)}
                disabled={count === 0 && !f.locales.has(l.id)}
                onChange={() => {
                  const next = new Set(f.locales);
                  if (next.has(l.id)) next.delete(l.id);
                  else next.add(l.id);
                  marcar({ ...f, locales: next });
                }}
                className="h-4 w-4 accent-[#0e518d]"
              />
              🏪 {l.nombre}
              <span className={contador}>{count}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

/* ── Explorador con facetas estilo marketplace ── */

export function ProductExplorer({ products }: { products: Product[] }) {
  const [f, setF] = useState<Filtros>(sinFiltros);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [panelMovil, setPanelMovil] = useState(false);

  const aplicar = (next: Filtros) => {
    setF(next);
    setLimit(PAGE_SIZE);
  };

  const filtered = products
    .filter((p) => pasa(p, f))
    .slice()
    .sort((a, b) => Number(b.destacado ?? false) - Number(a.destacado ?? false));
  const visible = filtered.slice(0, limit);

  // Chips de filtros activos (removibles)
  const chips: { label: string; quitar: () => void }[] = [];
  if (f.cat !== "todos") {
    const c = categories.find((x) => x.id === f.cat);
    chips.push({ label: c?.nombre ?? f.cat, quitar: () => aplicar({ ...f, cat: "todos" }) });
  }
  for (const m of f.marcas) {
    chips.push({
      label: m,
      quitar: () => {
        const next = new Set(f.marcas);
        next.delete(m);
        aplicar({ ...f, marcas: next });
      },
    });
  }
  if (f.rango) {
    const r = RANGOS.find((x) => x.id === f.rango);
    chips.push({ label: r?.label ?? "", quitar: () => aplicar({ ...f, rango: null }) });
  }
  for (const l of f.locales) {
    const nombre = LOCALES.find((x) => x.id === l)?.nombre ?? l;
    chips.push({
      label: `🏪 ${nombre}`,
      quitar: () => {
        const next = new Set(f.locales);
        next.delete(l);
        aplicar({ ...f, locales: next });
      },
    });
  }

  return (
    <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
      {/* Sidebar de facetas (desktop) */}
      <aside className="hidden lg:block" aria-label="Filtros del catálogo">
        <FacetPanel products={products} f={f} setF={aplicar} />
      </aside>

      <div>
        {/* Barra superior: botón móvil + chips activos + contador */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelMovil(true)}
            className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-600 lg:hidden"
          >
            ⚙ Filtrar{chips.length > 0 ? ` (${chips.length})` : ""}
          </button>
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.quitar}
              className="flex h-9 items-center gap-1.5 rounded-full bg-electric-50 px-3.5 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white"
            >
              {c.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          {chips.length > 0 && (
            <button
              type="button"
              onClick={() => aplicar(sinFiltros())}
              className="text-sm font-semibold text-slate-400 underline-offset-2 hover:text-fenix-600 hover:underline"
            >
              Limpiar todo
            </button>
          )}
          <span className="ml-auto text-sm text-slate-400">
            {filtered.length} producto{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <ProductCard key={p.sku} product={p} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center">
            <p className="font-semibold text-slate-500">
              No encontramos productos con esos filtros.
            </p>
            <button
              type="button"
              onClick={() => aplicar(sinFiltros())}
              className="mt-3 font-bold text-electric-600 hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        {filtered.length > limit && (
          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE_SIZE)}
              className="h-12 rounded-xl border-2 border-navy-950 px-8 font-bold text-navy-950 transition hover:bg-navy-950 hover:text-white"
            >
              Ver más productos ({filtered.length - limit} restantes)
            </button>
          </div>
        )}
      </div>

      {/* Bottom-sheet móvil */}
      {panelMovil && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-navy-950/50 lg:hidden"
          onClick={() => setPanelMovil(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Filtros del catálogo"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] w-full overflow-auto rounded-t-3xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-navy-950">Filtrar catálogo</h3>
              <button
                type="button"
                onClick={() => setPanelMovil(false)}
                aria-label="Cerrar filtros"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-cloud hover:text-navy-950"
              >
                ✕
              </button>
            </div>
            <FacetPanel products={products} f={f} setF={aplicar} />
            <button
              type="button"
              onClick={() => setPanelMovil(false)}
              className="bg-flame mt-5 h-12 w-full rounded-xl font-bold text-white transition hover:opacity-90"
            >
              Ver {filtered.length} producto{filtered.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
