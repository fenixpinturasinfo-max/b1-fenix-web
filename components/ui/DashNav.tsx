"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface DashNavItem {
  href?: string; // sin href = encabezado de grupo (no navega)
  label: string;
  icon?: React.ReactNode;
  sub?: boolean;
}

interface Grupo {
  cabeza: DashNavItem;
  hijos: DashNavItem[];
}

const STORAGE_KEY = "fenix-nav-colapsados";

function Chevron({ abierto }: { abierto: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-auto text-xs text-slate-400 transition-transform ${
        abierto ? "rotate-90" : ""
      }`}
    >
      ▸
    </span>
  );
}

export function DashNav({ items }: { items: DashNavItem[] }) {
  const pathname = usePathname();
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());

  // Restaurar preferencia del usuario
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setColapsados(new Set(JSON.parse(raw)));
    } catch {
      /* sin preferencia guardada */
    }
  }, []);

  const toggle = (label: string) =>
    setColapsados((s) => {
      const next = new Set(s);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        /* almacenamiento no disponible */
      }
      return next;
    });

  // Agrupar: un ítem no-sub encabeza; los sub que siguen son sus hijos
  const grupos: Grupo[] = [];
  for (const it of items) {
    if (!it.sub) grupos.push({ cabeza: it, hijos: [] });
    else if (grupos.length > 0) grupos[grupos.length - 1].hijos.push(it);
  }

  // Activo = la coincidencia más específica (evita marcar POS y Boletas a la vez)
  const activo = items
    .filter((i) => i.href && (pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => (b.href?.length ?? 0) - (a.href?.length ?? 0))[0]?.href;

  const filaCls = (active: boolean, sub = false) =>
    `relative flex w-full items-center gap-3 rounded-xl px-4 py-2.5 font-semibold transition ${
      sub ? "pl-11 text-sm" : ""
    } ${
      active
        ? "bg-electric-50 text-electric-600"
        : "text-slate-600 hover:bg-electric-50 hover:text-electric-600"
    }`;

  const marca = (
    <span
      aria-hidden="true"
      className="bg-flame absolute left-1 top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full"
    />
  );

  return (
    <nav className="flex-1 space-y-1 p-3" aria-label="Módulos">
      {grupos.map((g) => {
        const abierto = !colapsados.has(g.cabeza.label);
        const hijoActivo = g.hijos.some((h) => h.href === activo);
        const cabezaActiva = g.cabeza.href === activo;

        return (
          <div key={g.cabeza.href ?? `grupo-${g.cabeza.label}`}>
            {/* Cabeza: encabezado de grupo (toggle) o link con chevron */}
            {!g.cabeza.href ? (
              <button
                type="button"
                onClick={() => toggle(g.cabeza.label)}
                aria-expanded={abierto}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 font-semibold transition hover:bg-electric-50 hover:text-electric-600 ${
                  !abierto && hijoActivo ? "bg-electric-50 text-electric-600" : "text-slate-600"
                }`}
              >
                {g.cabeza.icon} {g.cabeza.label}
                {!abierto && hijoActivo && (
                  <span
                    aria-hidden="true"
                    className="ml-1 h-1.5 w-1.5 rounded-full bg-[#ff4d26]"
                  />
                )}
                <Chevron abierto={abierto} />
              </button>
            ) : g.hijos.length > 0 ? (
              <div className="flex items-center gap-1">
                <a
                  href={g.cabeza.href}
                  aria-current={cabezaActiva ? "page" : undefined}
                  className={filaCls(cabezaActiva)}
                >
                  {cabezaActiva && marca}
                  {g.cabeza.icon} {g.cabeza.label}
                </a>
                <button
                  type="button"
                  onClick={() => toggle(g.cabeza.label)}
                  aria-expanded={abierto}
                  aria-label={`${abierto ? "Ocultar" : "Mostrar"} submenú de ${g.cabeza.label}`}
                  className={`flex h-9 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-electric-50 ${
                    !abierto && hijoActivo ? "text-electric-600" : "text-slate-400"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`text-xs transition-transform ${abierto ? "rotate-90" : ""}`}
                  >
                    ▸
                  </span>
                </button>
              </div>
            ) : (
              <a
                href={g.cabeza.href}
                aria-current={cabezaActiva ? "page" : undefined}
                className={filaCls(cabezaActiva)}
              >
                {cabezaActiva && marca}
                {g.cabeza.icon} {g.cabeza.label}
              </a>
            )}

            {/* Hijos: sangría con línea guía vertical */}
            {abierto && g.hijos.length > 0 && (
              <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-slate-100 pl-2">
                {g.hijos.map((h) => {
                  const active = h.href === activo;
                  return (
                    <a
                      key={h.href}
                      href={h.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-electric-50 text-electric-600"
                          : "text-slate-500 hover:bg-electric-50 hover:text-electric-600"
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="bg-flame absolute -left-2.5 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full"
                        />
                      )}
                      {h.label}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
