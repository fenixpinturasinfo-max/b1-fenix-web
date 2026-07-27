import Link from "next/link";
import { tonoChip, type Tono } from "./tonos";

export interface Delta {
  /** Variación porcentual respecto del periodo de comparación */
  pct: number;
  /** Contra qué se compara. Obligatorio: un delta sin referencia no significa nada. */
  contra: string;
  /** Hacia dónde es "bueno". Para cuentas por pagar, subir es malo. */
  bueno?: "arriba" | "abajo";
}

/**
 * Tarjeta de KPI de la franja Z3.
 * Máximo 4 por franja: más de eso deja de leerse de un vistazo.
 */
export function KpiCard({
  label,
  valor,
  sub,
  delta,
  tono = "info",
  icon,
  href,
  nota,
}: {
  label: string;
  /** Ya formateado (CLP, porcentaje, conteo). "—" si no hay dato. */
  valor: string;
  sub?: string;
  delta?: Delta;
  tono?: Tono;
  icon?: React.ReactNode;
  href?: string;
  /** Aclaración corta al pie, p. ej. por qué una cifra es estimada */
  nota?: string;
}) {
  const contenido = (
    <>
      <span
        aria-hidden="true"
        className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-[linear-gradient(90deg,#1d6fb0,rgba(29,111,176,0))]"
      />
      <div className="flex items-start gap-3">
        {icon && (
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tonoChip[tono]}`}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-0.5 text-xl font-black leading-tight tabular-nums text-navy-950">
            {valor}
          </p>
          {(sub || delta) && (
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-slate-500">
              {delta && <DeltaBadge {...delta} />}
              {sub && <span>{sub}</span>}
            </p>
          )}
        </div>
      </div>
      {nota && <p className="mt-2 text-[11px] leading-tight text-slate-400">{nota}</p>}
    </>
  );

  const clase =
    "relative block overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-3.5";

  return href ? (
    <Link href={href} className={`${clase} transition hover:border-electric-500`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

function DeltaBadge({ pct, contra, bueno = "arriba" }: Delta) {
  if (!Number.isFinite(pct)) return null;
  const sube = pct > 0;
  const plano = Math.abs(pct) < 0.5;
  const positivo = plano ? null : bueno === "arriba" ? sube : !sube;
  const color =
    positivo === null ? "text-slate-400" : positivo ? "text-[#4d7c0f]" : "text-fenix-600";
  const flecha = plano ? "→" : sube ? "▲" : "▼";

  return (
    <span className={`font-bold tabular-nums ${color}`}>
      {flecha} {Math.abs(Math.round(pct))}%{" "}
      <span className="font-normal text-slate-400">vs {contra}</span>
    </span>
  );
}
