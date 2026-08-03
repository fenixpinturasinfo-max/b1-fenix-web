"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  previsualizarImportacionProductos,
  aplicarImportacionProductos,
  type PreviewState,
  type ActionState,
} from "../actions";
import { formatCLP } from "@/lib/format";

const estadoBadge: Record<string, string> = {
  NUEVO: "bg-lime-400/15 text-[#4d7c0f]",
  ACTUALIZA: "bg-electric-50 text-electric-600",
  SIN_CAMBIO: "bg-slate-100 text-slate-500",
  ERROR: "bg-fenix-600/10 text-fenix-600",
};

const estadoLabel: Record<string, string> = {
  NUEVO: "Nuevo",
  ACTUALIZA: "Actualiza",
  SIN_CAMBIO: "Sin cambio",
  ERROR: "Error",
};

export function ImportProductos() {
  const [abierto, setAbierto] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [preview, previsualizar, pendingPreview] = useActionState<PreviewState, FormData>(
    previsualizarImportacionProductos,
    {},
  );
  const [state, aplicar, pendingAplicar] = useActionState<ActionState, FormData>(
    aplicarImportacionProductos,
    {},
  );

  // Ajuste de estado derivado durante el render (sin efecto): cuando llega un
  // resultado nuevo de "aplicar", oculta la vista previa ya aplicada.
  const [ultimoOk, setUltimoOk] = useState(state.ok);
  if (state.ok !== ultimoOk) {
    setUltimoOk(state.ok);
    if (state.ok) setAplicado(true);
  }

  const cerrar = () => setAbierto(false);

  useEffect(() => {
    if (!abierto) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [abierto]);

  const cambiosAplicables = preview.resumen ? preview.resumen.nuevos + preview.resumen.actualiza : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-10 rounded-xl border border-electric-600 px-4 text-sm font-bold leading-10 text-electric-600 transition hover:bg-electric-600 hover:text-white"
      >
        ⬆ Importar productos
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={cerrar}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Importar productos"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-950">⬆ Importar productos</h3>
                <p className="text-sm text-slate-500">
                  Crea o actualiza por SKU. Nada se guarda hasta que confirmes la vista previa.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
              >
                ✕
              </button>
            </div>

            <ol className="space-y-4 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">
                  1
                </span>
                <span className="text-slate-600">
                  Descarga la plantilla y complétala en Excel (respeta las columnas y los desplegables).
                </span>
                <a
                  href="/dashboard/inventario/plantilla"
                  className="font-bold text-electric-600 hover:underline"
                >
                  ⬇ Descargar plantilla
                </a>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">
                  2
                </span>
                <span className="text-slate-600">Sube el archivo lleno:</span>
                <form
                  ref={formRef}
                  action={previsualizar}
                  onChange={() => {
                    setAplicado(false);
                    formRef.current?.requestSubmit();
                  }}
                >
                  <input
                    type="file"
                    name="archivo"
                    accept=".xlsx"
                    className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-electric-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-electric-600 hover:file:bg-electric-600 hover:file:text-white"
                  />
                </form>
              </li>
            </ol>

            {pendingPreview && (
              <p className="mt-3 text-sm font-semibold text-slate-500">Analizando archivo…</p>
            )}
            {preview.error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-fenix-600">
                {preview.error}
              </p>
            )}

            {preview.filas && preview.resumen && !aplicado && (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-lime-400/15 px-3 py-1 text-[#4d7c0f]">
                    {preview.resumen.nuevos} nuevos
                  </span>
                  <span className="rounded-full bg-electric-50 px-3 py-1 text-electric-600">
                    {preview.resumen.actualiza} actualizan
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                    {preview.resumen.sinCambio} sin cambio
                  </span>
                  {preview.resumen.errores > 0 && (
                    <span className="rounded-full bg-fenix-600/10 px-3 py-1 text-fenix-600">
                      {preview.resumen.errores} con error
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-cloud/90 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Fila</th>
                        <th className="px-3 py-2">SKU</th>
                        <th className="px-3 py-2">Producto</th>
                        <th className="px-3 py-2 text-right">Precio</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.filas.map((f) => (
                        <tr key={f.fila} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">{f.fila}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">{f.sku || "—"}</td>
                          <td
                            className="max-w-56 truncate px-3 py-2 font-semibold text-navy-950"
                            title={f.motivo}
                          >
                            {f.estado === "ERROR" ? f.motivo : f.nombre}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                            {f.precioVenta > 0 ? formatCLP(f.precioVenta) : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${estadoBadge[f.estado]}`}
                            >
                              {estadoLabel[f.estado]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {cambiosAplicables > 0 && (
                  <form action={aplicar} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="filas" value={preview.payload ?? "[]"} />
                    <button
                      type="submit"
                      disabled={pendingAplicar}
                      className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                    >
                      {pendingAplicar
                        ? "Aplicando…"
                        : `Aplicar ${cambiosAplicables} cambio${cambiosAplicables === 1 ? "" : "s"}`}
                    </button>
                  </form>
                )}
              </div>
            )}

            {state.error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-fenix-600">
                {state.error}
              </p>
            )}
            {state.ok && (
              <p role="status" className="mt-3 text-sm font-semibold text-[#4d7c0f]">
                ✅ {state.ok}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
