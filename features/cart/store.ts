"use client";

import { create } from "zustand";
import type { Product } from "@/features/catalog/types";

export interface CartItem {
  product: Product;
  qty: number;
}

interface CartState {
  items: CartItem[];
  localId: string;
  isOpen: boolean;
  add: (product: Product) => void;
  remove: (sku: string) => void;
  setQty: (sku: string, qty: number) => void;
  setLocal: (localId: string) => void;
  open: () => void;
  close: () => void;
  clear: () => void;
}

const MAX_QTY = 99;

export const useCart = create<CartState>((set) => ({
  items: [],
  localId: "san-bernardo",
  isOpen: false,
  add: (product) =>
    set((s) => {
      const existing = s.items.find((i) => i.product.sku === product.sku);
      const items = existing
        ? s.items.map((i) =>
            i.product.sku === product.sku
              ? { ...i, qty: Math.min(i.qty + 1, MAX_QTY) }
              : i,
          )
        : [...s.items, { product, qty: 1 }];
      return { items, isOpen: true };
    }),
  remove: (sku) => set((s) => ({ items: s.items.filter((i) => i.product.sku !== sku) })),
  setQty: (sku, qty) =>
    set((s) => ({
      items:
        qty <= 0
          ? s.items.filter((i) => i.product.sku !== sku)
          : s.items.map((i) =>
              i.product.sku === sku ? { ...i, qty: Math.min(qty, MAX_QTY) } : i,
            ),
    })),
  setLocal: (localId) => set({ localId }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  clear: () => set({ items: [] }),
}));

export const cartCount = (items: CartItem[]) => items.reduce((n, i) => n + i.qty, 0);
export const cartTotal = (items: CartItem[]) =>
  items.reduce((n, i) => n + i.qty * i.product.precioVenta, 0);
