import Link from "next/link";

/** Tarjeta contenedora estándar de las secciones del dashboard (Z4). */
export function PanelDash({
  titulo,
  icon,
  accion,
  children,
}: {
  titulo: string;
  icon?: React.ReactNode;
  accion?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-electric-50 text-electric-600">
            {icon}
          </span>
        )}
        <h2 className="text-base font-bold text-navy-950">{titulo}</h2>
        {accion && (
          <Link
            href={accion.href}
            className="ml-auto text-xs font-bold text-electric-600 transition hover:underline"
          >
            {accion.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
