"use client";

import { useActionState, useEffect, useState } from "react";
import { importarPreciosCompra, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

interface FilaImport {
  sku: string;
  precio: number;
}

interface Vista {
  cambios: { sku: string; nombre: string; antes: number | null; despues: number }[];
  sinCambio: number;
  desconocidos: string[];
  invalidas: number;
}

/** Parsea CSV simple (separador ; o ,) y extrae SKU + Precio compra por nombre de columna */
function parseCsv(texto: string): FilaImport[] | null {
  const lineas = texto.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2) return null;
  const sep = (lineas[0].match(/;/g)?.length ?? 0) >= (lineas[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const celdas = (l: string) =>
    l.split(sep).map((c) => c.trim().replace(/^"|"$/g, "").replaceAll('""', '"'));

  const headers = celdas(lineas[0]).map((h) => h.toLowerCase());
  const iSku = headers.findIndex((h) => h.includes("sku"));
  const iPrecio = headers.findIndex((h) => h.includes("compra"));
  if (iSku < 0 || iPrecio < 0) return null;

  return lineas.slice(1).map((l) => {
    const c = celdas(l);
    const precio = Number((c[iPrecio] ?? "").replace(/[^\d]/g, ""));
    return { sku: (c[iSku] ?? "").toUpperCase(), precio };
  });
}

export function ImportPreciosCompra({
  proveedorId,
  proveedorNombre,
  precios,
}: {
  proveedorId: string;
  proveedorNombre: string;
  /** sku (mayúscula) → { nombre, precio actual (null = sin precio aún) } */
  precios: Record<string, { nombre: string; precio: number | null }>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista | null>(null);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    importarPreciosCompra,
    {},
  );

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
          'No pude leer el archivo. Debe ser CSV con columnas "SKU" y "Precio compra" (usa la lista exportada como plantilla).',
        );
        return;
      }
      const cambios: Vista["cambios"] = [];
      const desconocidos: string[] = [];
      let sinCambio = 0;
      let invalidas = 0;
      for (const f of filas) {
        if (!f.sku) {
          invalidas++;
          continue;
        }
        // Precio vacío en el CSV = fila sin cotizar, se ignora
        if (!Number.isFinite(f.precio) || f.precio <= 0) {
          sinCambio++;
          continue;
        }
        const actual = precios[f.sku];
        if (!actual) {
          desconocidos.push(f.sku);
          continue;
        }
        if (actual.precio === f.precio) sinCambio++;
        else
          cambios.push({
            sku: f.sku,
            nombre: actual.nombre,
            antes: actual.precio,
            despues: f.precio,
          });
      }
      setVista({ cambios, sinCambio, desconocidos, invalidas });
    };
    reader.readAsText(file);
  };

  const payload = vista?.cambios.map((c) => ({ sku: c.sku, precio: c.despues })) ?? [];

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
            aria-label={`Importar precios de compra de ${proveedorNombre}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-950">
                  ⬆ Importar precios de compra
                </h3>
                <p className="text-sm text-slate-500">
                  Los precios se aplicarán solo al proveedor{" "}
                  <b className="text-electric-600">🚚 {proveedorNombre}</b>. Nada se guarda
                  hasta confirmar la vista previa.
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
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">1</span>
                <span className="text-slate-600">
                  Descarga la lista de este proveedor, completa la columna{" "}
                  <b>Precio compra (neto)</b> y guarda como CSV. Las filas sin precio se ignoran.
                </span>
                <a
                  href={`/dashboard/compras/precios/export?proveedor=${proveedorId}`}
                  className="font-bold text-electric-600 hover:underline"
                >
                  ⬇ Descargar lista de {proveedorNombre}
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

            {vista && (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-electric-50 px-3 py-1 text-electric-600">
                    {vista.cambios.length} por actualizar
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                    {vista.sinCambio} sin cambio / sin precio
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
                            <td className="px-4 py-2 text-right tabular-nums text-slate-400">
                              {c.antes != null ? (
                                <span className="line-through">{formatCLP(c.antes)}</span>
                              ) : (
                                <span className="text-xs font-bold text-electric-600">nuevo</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-bold tabular-nums text-navy-950">
                              {formatCLP(c.despues)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-300 py-6 text-center text-sm text-slate-400">
                    El archivo no trae cambios respecto a la lista actual de {proveedorNombre}.
                  </p>
                )}

                <form action={action} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="proveedorId" value={proveedorId} />
                  <input type="hidden" name="lineas" value={JSON.stringify(payload)} />
                  <button
                    type="submit"
                    disabled={pending || vista.cambios.length === 0}
                    className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                  >
                    {pending
                      ? "Aplicando…"
                      : `Aplicar ${vista.cambios.length} cambio${vista.cambios.length === 1 ? "" : "s"} a ${proveedorNombre}`}
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
