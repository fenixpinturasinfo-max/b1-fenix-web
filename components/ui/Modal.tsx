"use client";

import { useEffect } from "react";

/**
 * Shell estándar de modal del sistema: overlay + diálogo + cierre por ✕ / Escape / clic afuera.
 * El padre decide en `onClose` si el cierre procede (p. ej. confirmar datos sin guardar).
 */
export function Modal({
  titulo,
  descripcion,
  onClose,
  children,
  ancho = "max-w-2xl",
}: {
  titulo: string;
  descripcion?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Clase de ancho máximo del diálogo */
  ancho?: string;
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[85vh] w-full ${ancho} overflow-auto rounded-2xl bg-white p-6 shadow-2xl`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-navy-950">{titulo}</h2>
            {descripcion && <p className="text-sm text-slate-500">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
