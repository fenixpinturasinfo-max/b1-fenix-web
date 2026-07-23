"use client";

import type { Product } from "@/features/catalog/types";
import { useCart } from "../store";

export function AddToCartButton({ product }: { product: Product }) {
  const add = useCart((s) => s.add);
  return (
    <button
      type="button"
      onClick={() => add(product)}
      className="bg-flame h-11 w-full rounded-xl text-sm font-bold text-white shadow-card transition hover:opacity-90 active:scale-[0.98]"
    >
      + Agregar al carro
    </button>
  );
}
