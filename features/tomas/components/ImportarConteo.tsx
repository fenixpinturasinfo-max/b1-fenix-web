"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  importarConteo,
  previsualizarConteo,
  type ActionState,
  type PreviewConteoState,
} from "../actions";

const estadoBadge: Record<string, string> = {
  CARGA: "bg-lime-400/15 text-[#4d7c0f]",
  NUEVA: "bg-electric-50 text-electric-600",
  SOBREESCRIBE: "bg-[#f59e0b]/15 text-[#b45309]",
  SIN_CONTAR: "bg-slate-100 text-slate-500",
  ERROR: "bg-fenix-600/10 text-fenix-600",
};

const estadoLabel: Record<string, string> = {
  CARGA: "Se carga",
  NUEVA: "Línea nueva",
  SOBREESCRIBE: "Reemplaza conteo",
  SIN_CONTAR: "Queda pendiente",
  ERROR: "Error",
};

/**
 * Importa la planilla de conteo, con vista previa antes de escribir.
 *
 * La fecha del conteo es el control más importante de esta pantalla, no un detalle: de ella
 * sale el `contadoEn` de cada línea, y por lo tanto qué movimientos se suman de vuelta al
 * calcular las diferencias. Por eso va destacada y editable, no escondida.
 */
export function ImportarConteo({ tomaId, folio }: { tomaId: string; folio: string }) {
  const [abierto, setAbierto] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [preview, previsualizar, pendingPreview] = useActionState<PreviewConteoState, FormData>(
    previsualizarConteo,
    {},
  );
  const [state, aplicar, pendingAplicar] = useActionState<ActionState, FormData>(
    importarConteo,
    {},
  );

  // Ajuste de estado derivado en render (sin efecto), igual que en ImportProductos:
  // al llegar un resultado nuevo de "aplicar", oculta la vista previa ya consumida.
  const [ultimoOk, setUltimoOk] = useState(state.ok);
  if (state.ok !== ultimoOk) {
    setUltimoOk(state.ok);
    if (state.ok) setAplicado(true);
  }

  // La fecha declarada en la planilla se propone como valor inicial del campo
  const [ultimaFechaLeida, setUltimaFechaLeida] = useState(preview.fechaConteo);
  if (preview.fechaConteo !== ultimaFechaLeida) {
    setUltimaFechaLeida(preview.fechaConteo);
    if (preview.fechaConteo) setFecha(preview.fechaConteo);
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

  const r = preview.resumen;
  const aEscribir = r ? r.carga + r.nuevas + r.sobreescribe : 0;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-11 rounded-xl border border-electric-600 px-4 text-sm font-bold text-electric-600 transition hover:bg-electric-600 hover:text-white"
      >
        ⬆ Importar conteo
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
            aria-label="Importar conteo"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-6 text-left shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-navy-950">
                  ⬆ Importar conteo · <span className="font-mono">{folio}</span>
                </h3>
                <p className="text-sm text-slate-500">
                  Nada se guarda hasta que confirmes la vista previa.
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
                  Descarga la planilla, cuenta y anota las cantidades.
                </span>
                <a
                  href={`/dashboard/inventario/tomas/${tomaId}/planilla`}
                  className="font-bold text-electric-600 hover:underline"
                >
                  ⬇ Descargar planilla
                </a>
              </li>
              <li className="flex flex-wrap items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">
                  2
                </span>
                <span className="text-slate-600">Sube la planilla llena:</span>
                <form
                  ref={formRef}
                  action={previsualizar}
                  onChange={() => {
                    setAplicado(false);
                    formRef.current?.requestSubmit();
                  }}
                >
                  <input type="hidden" name="tomaId" value={tomaId} />
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
              <p className="mt-3 text-sm font-semibold text-slate-500">Analizando planilla…</p>
            )}
            {preview.error && (
              <p role="alert" className="mt-3 text-sm font-semibold text-fenix-600">
                {preview.error}
              </p>
            )}

            {preview.filas && r && !aplicado && (
              <div className="mt-5 space-y-4">
                {/* El control que decide si las diferencias van a ser correctas */}
                <div className="rounded-xl border border-electric-500/40 bg-electric-50 p-4">
                  <div className="flex flex-wrap items-end gap-4">
                    <div>
                      <label
                        htmlFor="ic-fecha"
                        className="mb-1 block text-sm font-bold text-navy-950"
                      >
                        Fecha del conteo *
                      </label>
                      <input
                        id="ic-fecha"
                        type="date"
                        required
                        max={hoy}
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="ic-hora"
                        className="mb-1 block text-sm font-semibold text-slate-700"
                      >
                        Hora aproximada
                      </label>
                      <input
                        id="ic-hora"
                        type="time"
                        value={hora}
                        onChange={(e) => setHora(e.target.value)}
                        className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-navy-950">
                    Es el día en que se contó físicamente, no el de hoy. De esta fecha depende
                    el cálculo: las ventas posteriores al conteo se suman de vuelta para que no
                    aparezcan como faltantes. Sin hora se asume la mañana.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-lime-400/15 px-3 py-1 text-[#4d7c0f]">
                    {r.carga} se cargan
                  </span>
                  {r.nuevas > 0 && (
                    <span className="rounded-full bg-electric-50 px-3 py-1 text-electric-600">
                      {r.nuevas} línea{r.nuevas === 1 ? "" : "s"} nueva{r.nuevas === 1 ? "" : "s"}
                    </span>
                  )}
                  {r.sobreescribe > 0 && (
                    <span className="rounded-full bg-[#f59e0b]/15 px-3 py-1 text-[#b45309]">
                      {r.sobreescribe} reemplaza{r.sobreescribe === 1 ? "" : "n"} un conteo previo
                    </span>
                  )}
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                    {r.sinContar} sin contar
                  </span>
                  {r.errores > 0 && (
                    <span className="rounded-full bg-fenix-600/10 px-3 py-1 text-fenix-600">
                      {r.errores} con error
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
                        <th className="px-3 py-2 text-center">Contado</th>
                        <th className="px-3 py-2">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.filas.map((f) => (
                        <tr key={f.fila} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">{f.fila}</td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-500">
                            {f.sku || "—"}
                          </td>
                          <td
                            className="max-w-56 truncate px-3 py-2 font-semibold text-navy-950"
                            title={f.motivo}
                          >
                            {f.estado === "ERROR" ? f.motivo : f.nombre}
                          </td>
                          <td className="px-3 py-2 text-center font-bold tabular-nums text-navy-950">
                            {f.contado ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${estadoBadge[f.estado]}`}
                            >
                              {estadoLabel[f.estado]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {aEscribir > 0 && (
                  <form action={aplicar} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="tomaId" value={tomaId} />
                    <input type="hidden" name="conteos" value={preview.payload ?? "[]"} />
                    <input type="hidden" name="fechaConteo" value={fecha} />
                    <input type="hidden" name="horaConteo" value={hora} />
                    <button
                      type="submit"
                      disabled={pendingAplicar || !fecha}
                      className="bg-flame h-11 rounded-xl px-6 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
                    >
                      {pendingAplicar
                        ? "Importando…"
                        : `Cargar ${aEscribir} conteo${aEscribir === 1 ? "" : "s"}`}
                    </button>
                    {!fecha && (
                      <span className="text-sm font-semibold text-slate-500">
                        Indica la fecha del conteo para continuar.
                      </span>
                    )}
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
