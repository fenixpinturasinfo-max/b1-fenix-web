"use client";

import { useState } from "react";
import { categories, products } from "../data/products";
import type { CategoryId } from "../types";
import { ProductCard } from "./ProductCard";

export function ProductExplorer() {
  const [filter, setFilter] = useState<CategoryId | "todos">("todos");

  const visible =
    filter === "todos" ? products : products.filter((p) => p.categoria === filter);

  // Solo categorías con productos cargados
  const activeCategories = categories.filter((c) =>
    products.some((p) => p.categoria === c.id),
  );

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filtrar por categoría">
        <button
          type="button"
          onClick={() => setFilter("todos")}
          aria-pressed={filter === "todos"}
          className={`h-10 rounded-full px-5 text-sm font-bold transition ${
            filter === "todos"
              ? "bg-flame text-white"
              : "border border-slate-300 bg-white text-slate-600 hover:border-fenix-500"
          }`}
        >
          Todos
        </button>
        {activeCategories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            aria-pressed={filter === c.id}
            className={`h-10 rounded-full px-5 text-sm font-bold transition ${
              filter === c.id
                ? "bg-flame text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-fenix-500"
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
    </div>
  );
}
