"use client";

import { useState } from "react";
import { categories, products } from "../data/products";
import type { CategoryId } from "../types";
import { ProductCard } from "./ProductCard";

const PAGE_SIZE = 12;

export function ProductExplorer() {
  const [filter, setFilter] = useState<CategoryId | "todos">("todos");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = (
    filter === "todos" ? products : products.filter((p) => p.categoria === filter)
  )
    // Destacados y ofertas primero
    .slice()
    .sort((a, b) => Number(b.destacado ?? false) - Number(a.destacado ?? false));
  const visible = filtered.slice(0, limit);

  // Solo categorías con productos cargados
  const activeCategories = categories.filter((c) =>
    products.some((p) => p.categoria === c.id),
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
        <button
          type="button"
          onClick={() => {
            setFilter("todos");
            setLimit(PAGE_SIZE);
          }}
          aria-pressed={filter === "todos"}
          className={`h-10 rounded-full px-5 text-sm font-bold transition ${
            filter === "todos"
              ? "bg-electric-600 text-white"
              : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
          }`}
        >
          Todos
        </button>
        {activeCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setFilter(c.id);
              setLimit(PAGE_SIZE);
            }}
            aria-pressed={filter === c.id}
            className={`h-10 rounded-full px-5 text-sm font-bold transition ${
              filter === c.id
                ? "bg-electric-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((p) => (
          <ProductCard key={p.sku} product={p} />
        ))}
      </div>

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
  );
}
