"use client";

/**
 * Átomos estándar para listas del sistema:
 * ChipsFiltro (con contador) · BuscadorLista · TablaScroll (scroll interno + thead sticky)
 * Se combinan con <Paginacion /> (10 por página) al pie.
 */

export function ChipsFiltro<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: { valor: T; label: string; n: number }[];
  valor: T;
  onChange: (v: T) => void;
}) {
  return (
    <>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
            valor === o.valor
              ? "bg-electric-600 text-white"
              : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
          }`}
        >
          {o.label}
          <span
            className={`rounded-full px-1.5 text-xs ${
              valor === o.valor ? "bg-white/20" : "bg-cloud"
            }`}
          >
            {o.n}
          </span>
        </button>
      ))}
    </>
  );
}

export function BuscadorLista({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="ml-auto h-10 w-full max-w-64 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-navy-950 outline-none focus:border-electric-500"
    />
  );
}

/** Contenedor de tabla con scroll interno; usar <thead> con la clase theadSticky */
export function TablaScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-[calc(100vh-320px)] overflow-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export const theadSticky =
  "sticky top-0 z-10 bg-white text-xs uppercase tracking-wider text-slate-500 shadow-[inset_0_-1px_0_var(--color-slate-200)]";
