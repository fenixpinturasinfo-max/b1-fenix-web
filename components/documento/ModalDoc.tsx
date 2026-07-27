"use client";

import { useEffect } from "react";

/** Shell estándar de modal de documento: overlay + diálogo + cierre por ✕/Escape/clic afuera */
export function ModalDoc({
  etiqueta,
  onClose,
  children,
}: {
  etiqueta: string;
  onClose: () => void;
  children: React.ReactNode;
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
        aria-label={etiqueta}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}

/** Cabecera estándar del modal de documento */
export function CabeceraDoc({
  folio,
  badge,
  detalle,
  onClose,
  extra,
}: {
  folio: string;
  badge?: { label: string; cls: string };
  detalle: React.ReactNode;
  onClose: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-mono text-xl font-black text-navy-950">{folio}</h3>
          {badge && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
              {badge.label}
            </span>
          )}
          {extra}
        </div>
        <p className="mt-1 text-sm text-slate-500">{detalle}</p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
      >
        ✕
      </button>
    </div>
  );
}

/** Tabla de líneas de solo lectura del documento */
export function LineasDoc({
  columnas,
  children,
}: {
  columnas: { label: string; align?: "right" | "center" }[];
  children: React.ReactNode;
}) {
  return (
    <div className="max-h-[45vh] overflow-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-cloud/90 text-[11px] uppercase tracking-wider text-slate-500">
          <tr>
            {columnas.map((c) => (
              <th
                key={c.label}
                className={`px-3 py-2 ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                }`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
