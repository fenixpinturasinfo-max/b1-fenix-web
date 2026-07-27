import Link from "next/link";

export interface BarraItem {
  id: string;
  label: string;
  valor: number;
  /** Texto a la derecha, ya formateado */
  detalle: string;
  href?: string;
}

/** Ranking horizontal. Ordena descendente y escala contra el mayor del set. */
export function BarrasComparativas({ items }: { items: BarraItem[] }) {
  const max = Math.max(1, ...items.map((i) => i.valor));
  const ordenados = [...items].sort((a, b) => b.valor - a.valor);

  return (
    <div className="space-y-3">
      {ordenados.map((i) => {
        const pct = Math.round((i.valor / max) * 100);
        const fila = (
          <>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-navy-950">{i.label}</span>
              <span className="shrink-0 tabular-nums text-slate-600">{i.detalle}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-cloud">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#1d6fb0,#0e518d)]"
                style={{ width: `${Math.max(pct, i.valor > 0 ? 4 : 0)}%` }}
              />
            </div>
          </>
        );
        return i.href ? (
          <Link key={i.id} href={i.href} className="block rounded-lg transition hover:opacity-80">
            {fila}
          </Link>
        ) : (
          <div key={i.id}>{fila}</div>
        );
      })}
    </div>
  );
}
