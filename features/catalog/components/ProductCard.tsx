import type { Product } from "../types";
import { formatCLP } from "@/lib/format";
import { AddToCartButton } from "@/features/cart/components/AddToCartButton";
import { locations } from "@/features/stores/data/locations";
import { ProductImage } from "./ProductImage";

const categoryHue: Record<string, string> = {
  "pinturas-lacas": "from-fenix-600/10 to-cloud",
  primers: "from-fenix-300/15 to-cloud",
  "pulido-detailing": "from-lime-400/15 to-cloud",
  "lijas-abrasivos": "from-slate-200 to-cloud",
  accesorios: "from-fenix-400/10 to-cloud",
  kits: "from-fenix-500/10 to-cloud",
};

export function ProductCard({ product }: { product: Product }) {
  const discount = product.precioAnterior
    ? Math.round((1 - product.precioVenta / product.precioAnterior) * 100)
    : null;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-electric-500 hover:shadow-card">
      <div
        className={`relative flex h-40 items-center justify-center bg-gradient-to-br ${categoryHue[product.categoria]}`}
        role="img"
        aria-label={`Imagen de ${product.nombre}`}
      >
        {/* Foto real (link de Drive o URL); si no hay, ícono de lata */}
        <ProductImage imagen={product.imagen} nombre={product.nombre} />
        {discount && (
          <span className="absolute left-3 top-3 rounded-full bg-fenix-600 px-2.5 py-1 text-xs font-bold text-white">
            -{discount}%
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-fenix-600">{product.marca}</p>
        <h3 className="font-semibold text-navy-950">{product.nombre}</h3>
        {product.stock && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {locations.map((l) => {
              const qty = product.stock?.[l.id] ?? 0;
              return (
                <span
                  key={l.id}
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    qty > 0 ? "bg-lime-400/15 text-[#4d7c0f]" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {qty > 0 ? "✓" : "✕"} {l.comuna}
                </span>
              );
            })}
          </div>
        )}
        <div className="mt-auto pt-3">
          <div className="mb-3 flex items-baseline gap-2">
            <span className="text-xl font-bold text-navy-950">{formatCLP(product.precioVenta)}</span>
            {product.precioAnterior && (
              <span className="text-sm text-slate-400 line-through">{formatCLP(product.precioAnterior)}</span>
            )}
          </div>
          <AddToCartButton product={product} />
        </div>
      </div>
    </article>
  );
}
