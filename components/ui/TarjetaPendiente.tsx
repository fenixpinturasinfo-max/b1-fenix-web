import Link from "next/link";
import { tonoBorde, tonoChip, tonoTexto, type Tono } from "./tonos";

export interface Pendiente {
  n: number;
  titulo: string;
  /** Qué implica, no qué es. "Se están perdiendo ventas ahora" > "productos en cero". */
  descripcion: string;
  /** Debe apuntar a la lista ya prefiltrada, no al módulo completo. */
  href: string;
  cta: string;
  tono: Tono;
  icon?: React.ReactNode;
}

/**
 * Bandeja de pendientes (Z2).
 *
 * Regla del sistema: **un pendiente con contador 0 no se renderiza**. Mostrar ceros
 * entrena al usuario a ignorar la zona; la ausencia es la señal. Si no queda ninguno,
 * aparece el estado "todo al día".
 */
export function BandejaPendientes({
  items,
  titulo = "Pendientes",
  vacio = "Todo al día · no hay nada esperando por ti",
}: {
  items: Pendiente[];
  titulo?: string;
  vacio?: string;
}) {
  const visibles = items.filter((i) => i.n > 0);

  return (
    <section>
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{titulo}</h2>
      {visibles.length === 0 ? (
        <p className="flex items-center gap-2 rounded-2xl border border-lime-400/40 bg-lime-400/5 px-4 py-3 text-sm font-semibold text-[#4d7c0f]">
          <span aria-hidden="true">✓</span>
          {vacio}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {visibles.map((p) => (
            <TarjetaPendiente key={p.titulo} {...p} />
          ))}
        </div>
      )}
    </section>
  );
}

export function TarjetaPendiente({ n, titulo, descripcion, href, cta, tono, icon }: Pendiente) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-2xl border bg-white p-4 transition hover:shadow-card ${tonoBorde[tono]}`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tonoChip[tono]}`}
        >
          {icon}
        </span>
        <span className={`text-2xl font-black tabular-nums ${tonoTexto[tono]}`}>{n}</span>
      </div>
      <p className="mt-2 text-sm font-bold uppercase tracking-wide text-navy-950">{titulo}</p>
      <p className="mt-0.5 flex-1 text-xs leading-snug text-slate-500">{descripcion}</p>
      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-electric-600">
        {cta}
        <span aria-hidden="true" className="transition group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
