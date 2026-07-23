"use client";

import { cartCount, useCart } from "../store";

export function CartButton() {
  const items = useCart((s) => s.items);
  const open = useCart((s) => s.open);
  const count = cartCount(items);

  return (
    <button
      type="button"
      onClick={open}
      className="relative flex h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-navy-950 transition hover:border-fenix-500"
      aria-label={`Abrir carro de compras, ${count} productos`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span
        aria-live="polite"
        className={`absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-fenix-600 px-1 text-xs font-bold text-white transition ${
          count === 0 ? "scale-0" : "scale-100"
        }`}
      >
        {count}
      </span>
    </button>
  );
}
