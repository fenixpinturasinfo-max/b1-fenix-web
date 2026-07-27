"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "fenix-sidebar-oculta";

function aplicar(oculta: boolean) {
  document.getElementById("dash-root")?.classList.toggle("nav-oculta", oculta);
}

/** Muestra/oculta la barra lateral para trabajar a pantalla completa. */
export function SidebarToggle() {
  const [oculta, setOculta] = useState(false);

  // Restaurar preferencia del usuario
  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY) === "1";
      setOculta(v);
      aplicar(v);
    } catch {
      /* sin preferencia guardada */
    }
  }, []);

  const toggle = () => {
    const v = !oculta;
    setOculta(v);
    aplicar(v);
    try {
      localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* almacenamiento no disponible */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={oculta ? "Mostrar menú lateral" : "Ocultar menú lateral"}
      aria-pressed={oculta}
      title={oculta ? "Mostrar menú" : "Ocultar menú"}
      className="hidden h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-electric-500 hover:text-electric-600 sm:flex"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {oculta ? (
          <>
            <path d="M3 6h18" />
            <path d="M3 12h18" />
            <path d="M3 18h18" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M9 4v16" />
          </>
        )}
      </svg>
    </button>
  );
}
