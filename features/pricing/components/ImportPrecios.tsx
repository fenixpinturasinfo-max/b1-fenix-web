"use client";

import { useActionState, useEffect, useState } from "react";
import { importarPrecios, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

interface FilaImport {
  sku: string;
  precioVenta: number;
}

interface Vista {
  filas: FilaImport[];
  cambios: { sku: string; nombre: string; antes: number; despues: number }[];
  sinCambio: number;
  desconocidos: string[];
  invalidas: number;
}

/** Parsea CSV simple (separador ; o ,) y extrae SKU + Precio venta por nombre de columna */
function parseCsv(texto: string): FilaImport[] | null {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return null;
  const sep = (lineas[0].match(/;/g)?.length ?? 0) >= (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const celdas = (l: string) =>
    l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "").replaceAll('""', '"'));

  const headers = celdas(lineas[0]).map((h) => h.toLowerCase());
  const iSku = headers.findIndex((h) => h.includes("sku"));
  const iPrecio = headers.findIndex((h) => h.includes("venta"));
  if (iSku < 0 || iPrecio < 0) return null;

  return lineas.slice(1).map((l) => {
    const c = celdas(l);
    // Normalizar precio: "$12.990" → 12990
    const precio = Number((c[iPrecio] ?? "").replace(/[^\d]/g, ""));
    return { sku: (c[iSku] ?? "").toUpperCase(), precioVenta: precio };
  });
}

export function ImportPrecios({
  precios,
}: {
  /** sku (mayúscula) → { nombre, precioVenta } actual */
  precios: Record<string, { nombre: string; precioVenta: number }>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(importarPrecios, {});

  // Tras importar con éxito, limpiar la vista previa
  useEffect(() => {
    if (state.ok) setVista(null);
  }, [state.ok]);

  const cerrar = () => {
    setAbierto(false);
    setVista(null);
    setErrorArchivo(null);
  };

  useEffect(() => {
    if (!abierto) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const onArchivo = (file: File | undefined) => {
    setErrorArchivo(null);
    setVista(null);
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const filas = parseCsv(String(reader.result ?? ""));
      if (!filas) {
        setErrorArchivo(
          'No pude leer el archivo. Debe ser CSV con columnas "SKU" y "Precio venta" (usa la lista exportada como plantilla).',
        );
        return;
      }
      const cambios: Vista["cambios"] = [];
      const desconocidos: string[] = [];
      let sinCambio = 0;
      let invalidas = 0;
      for (const f of filas) {
        if (!f.sku || !Number.isFinite(f.precioVenta) || f.precioVenta <= 0) {
          invalidas++;
          continue;
        }
        const actual = precios[f.sku];
        if (!actual) {
          desconocidos.push(f.sku);
          continue;
        }
        if (actual.precioVenta === f.precioVenta) sinCambio++;
        else
          cambios.push({
            sku: f.sku,
            nombre: actual.nombre,
            antes: actual.precioVenta,
            despues: f.precioVenta,
          });
      }
      setVista({ filas, cambios, sinCambio, desconocidos, invalidas });
    };
    reader.readAsText(file);
  };

  const payload = vista?.cambios.map((c) => ({ sku: c.sku, precioVenta: c.despues })) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-10 rounded-xl border border-electric-600 px-4 text-sm font-bold leading-10 text-electric-600 transition hover:bg-electric-600 hover:text-white"
      >
        ⬆ Importar
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
            aria-label="Importar precios"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-950">⬆ Importar precios de venta</h3>
                <p className="text-sm text-slate-500">
                  Actualización masiva por SKU. Nada se aplica hasta que confirmes la vista previa.
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

            {/* Paso 1: plantilla */}
            <ol className="space-y-4 text-sm">
              <li className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">1</span>
                <span className="text-slate-600">Descarga la lista actual, edita la columna <b>Precio venta</b> en Excel y guarda como CSV.</span>
                <a
                  href="/dashboard/precios/export"
                  className="font-bold text-electric-600 hover:underline"
                >
                  ⬇ Descargar lista actual
                </a>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">2</span>
                <span className="text-slate-600">Sube el archivo:</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => onArchivo(e.target.files?.[0])}
                  className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-electric-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-electric-600 hover:file:bg-electric-600 hover:file:text-white"
                />
              </li>
            </ol>

            {errorArchivo && (
              <p role="alert" className="mt-3 text-sm font-semibold text-fenix-600">{errorArchivo}</p>
            )}

            {/* Paso 3: vista previa */}
            {vista && (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-electric-50 px-3 py-1 text-electric-600">
                    {vista.cambios.length} por actualizar
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                    {vista.sinCambio} sin cambio
                  </span>
                  {vista.desconocidos.length > 0 && (
                    <span
                      className="rounded-full bg-[#f59e0b]/15 px-3 py-1 text-[#b45309]"
                      title={vista.desconocidos.slice(0, 20).join(", ")}
                    >
                      {vista.desconocidos.length} SKU no encontrados
                    </span>
                  )}
                  {vista.invalidas > 0 && (
                    <span className="rounded-full bg-fenix-600/10 px-3 py-1 text-fenix-600">
                      {vista.invalidas} filas inválidas
                    </span>
                  )}
                </div>

                {vista.cambios.length > 0 ? (
                  <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-cloud/90 text-xs uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-2">SKU</th>
                          <th className="px-4 py-2">Producto</th>
                          <th className="px-4 py-2 text-right">Actual</th>
                          <th className="px-4 py-2 text-right">Nuevo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vista.cambios.map((c) => (
                          <tr key={c.sku} className="border-t border-slate-100">
                            <td className="px-4 py-2 font-mono text-xs text-slate-500">{c.sku}</td>
                            <td className="max-w-56 truncate px-4 py-2 font-semibold text-navy-950">
                              {c.nombre}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-slate-400 line-through">
                              {formatCLP(c.antes)}
                            </td>
                            <td
                              className={`px-4 py-2 text-right font-bold tabular-nums ${
                                c.despues > c.antes ? "text-[#4d7c0f]" : "text-fenix-600"
                              }`}
                            >
                              {formatCLP(c.despues)} {c.despues > c.antes ? "↑" : "↓"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
                    El archivo no trae cambios de precio respecto a la lista actual.
                  </p>
                )}

                {/* Paso 4: confirmar */}
                <form action={action} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="lineas" value={JSON.stringify(payload)} />
                  <button
                    type="submit"
                    disabled={pending || vista.cambios.length === 0}
                    className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    {pending
                      ? "Aplicando…"
                      : `Aplicar ${vista.cambios.length} cambio${vista.cambios.length === 1 ? "" : "s"}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setVista(null)}
                    className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
                  >
                    Descartar
                  </button>
                </form>
              </div>
            )}

            {state.error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-fenix-600">{state.error}</p>
            )}
            {state.ok && (
              <p role="status" className="mt-3 text-sm font-semibold text-[#4d7c0f]">✅ {state.ok}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
