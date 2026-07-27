"use client";

/** Control de paginación numerada: ‹ 1 … 4 [5] 6 … 12 › */
export function Paginacion({
  total,
  pagina,
  porPagina,
  onChange,
}: {
  total: number;
  pagina: number; // 1-based
  porPagina: number;
  onChange: (p: number) => void;
}) {
  const paginas = Math.ceil(total / porPagina);
  if (paginas <= 1) return null;

  // Ventana de páginas: primera, última, actual ±1, con elipsis
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= paginas; i++) {
    if (i === 1 || i === paginas || Math.abs(i - pagina) <= 1) {
      nums.push(i);
    } else if (nums[nums.length - 1] !== "…") {
      nums.push("…");
    }
  }

  const desde = (pagina - 1) * porPagina + 1;
  const hasta = Math.min(pagina * porPagina, total);
  const btn =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-bold transition disabled:opacity-30";

  return (
    <nav className="flex flex-wrap items-center gap-1.5" aria-label="Paginación">
      <span className="mr-2 text-sm text-slate-400">
        {desde}–{hasta} de {total}
      </span>
      <button
        type="button"
        onClick={() => onChange(pagina - 1)}
        disabled={pagina <= 1}
        aria-label="Página anterior"
        className={`${btn} border border-slate-300 bg-white text-slate-600 hover:border-electric-500`}
      >
        ‹
      </button>
      {nums.map((n, i) =>
        n === "…" ? (
          <span key={`e-${i}`} className="px-1 text-slate-400">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={n === pagina ? "page" : undefined}
            className={`${btn} ${
              n === pagina
                ? "bg-electric-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
            }`}
          >
            {n}
          </button>
        ),
      )}
      <button
        type="button"
        onClick={() => onChange(pagina + 1)}
        disabled={pagina >= paginas}
        aria-label="Página siguiente"
        className={`${btn} border border-slate-300 bg-white text-slate-600 hover:border-electric-500`}
      >
        ›
      </button>
    </nav>
  );
}
