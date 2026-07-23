import { products } from "@/features/catalog/data/products";
import type { Product } from "@/features/catalog/types";

export type Goal = "pintar" | "retoque" | "pulir";

export interface GoalOption {
  id: Goal;
  label: string;
  icon: string;
  descripcion: string;
}

export const goals: GoalOption[] = [
  { id: "pintar", label: "Pintar completo", icon: "🚗", descripcion: "Piezas grandes o el auto entero" },
  { id: "retoque", label: "Retoque o rayón", icon: "🖌️", descripcion: "Reparaciones puntuales" },
  { id: "pulir", label: "Pulir y abrillantar", icon: "✨", descripcion: "Recuperar el brillo" },
];

export interface SizeOption {
  id: string;
  label: string;
}

export const sizesByGoal: Partial<Record<Goal, SizeOption[]>> = {
  pintar: [
    { id: "pieza", label: "Una o dos piezas" },
    { id: "completo", label: "Auto completo" },
  ],
};

const bySku = (sku: string): Product | undefined => products.find((p) => p.sku === sku);

/** Reglas de recomendación (mock → luego configurable desde el admin). */
export function recommendKit(goal: Goal, size?: string): Product[] {
  const skus: string[] =
    goal === "pulir"
      ? ["MEN-400-1L", "MEN-2400-1L", "MEN-3000-1L"]
      : goal === "retoque"
        ? ["SIK-LCF-1L", "SIK-PCF-14K"]
        : size === "completo"
          ? ["SIK-LHS-5L", "SIK-PHS-14"]
          : ["SIK-LHS-1L", "SIK-P680-14"];
  return skus.map(bySku).filter((p): p is Product => Boolean(p));
}
