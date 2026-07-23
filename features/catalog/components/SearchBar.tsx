"use client";

import { useEffect, useRef, useState } from "react";
import { products } from "../data/products";
import { formatCLP } from "@/lib/format";
import { useCart } from "@/features/cart/store";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const add = useCart((s) => s.add);
  const rootRef = useRef<HTMLDivElement>(null);

  const q = query.trim().toLowerCase();
  const results =
    q.length >= 2
      ? products
          .filter(
            (p) =>
              p.nombre.toLowerCase().includes(q) ||
              p.marca.toLowerCase().includes(q) ||
              p.sku.toLowerCase().includes(q),
          )
          .slice(0, 6)
      : [];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={rootRef} className="relative w-full max-w-xs">
      <label htmlFor="buscador" className="sr-only">
        Buscar productos
      </label>
      <input
        id="buscador"
        type="search"
        placeholder="Buscar producto o marca…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="h-11 w-full rounded-xl border border-slate-200 bg-cloud px-4 pr-9 text-sm text-navy-950 outline-none transition focus:border-electric-500 focus:bg-white"
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
        width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>

      {open && q.length >= 2 && (
        <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-slate-500">
              Sin resultados para &ldquo;{query}&rdquo;. Escríbenos por WhatsApp y te ayudamos.
            </p>
          ) : (
            <ul>
              {results.map((p) => (
                <li key={p.sku} className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-navy-950">{p.nombre}</p>
                    <p className="text-xs text-slate-500">
                      {p.marca} · {formatCLP(p.precioVenta)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      add(p);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="bg-flame shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition hover:opacity-90"
                  >
                    + Agregar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
