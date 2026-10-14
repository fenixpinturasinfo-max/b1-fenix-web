"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatearRut } from "@/lib/rut";
import {
  previsualizarImportacionSocios,
  aplicarImportacionSocios,
  type PreviewSociosState,
  type ActionState,
} from "../actions";

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

/**
 * Carga masiva de proveedores o clientes desde la plantilla .xlsx.
 * Mismo flujo que "Importar productos": plantilla → archivo → vista previa → aplicar.
 */
export function ImportSocios({ tipo }: { tipo: "CLIENTE" | "PROVEEDOR" }) {
  const [abierto, setAbierto] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const etiqueta = tipo === "CLIENTE" ? "clientes" : "proveedores";

  const [preview, previsualizar, pendingPreview] = useActionState<PreviewSociosState, FormData>(
    previsualizarImportacionSocios,
    {},
  );
  const [state, aplicar, pendingAplicar] = useActionState<ActionState, FormData>(
    aplicarImportacionSocios,
    {},
  );

  // Estado derivado durante el render: cuando "aplicar" termina bien, se oculta la vista previa.
  const [ultimoOk, setUltimoOk] = useState(state.ok);
  if (state.ok !== ultimoOk) {
    setUltimoOk(state.ok);
    if (state.ok) setAplicado(true);
  }

  const cerrar = useCallback(() => setAbierto(false), []);
  const cambiosAplicables = preview.resumen ? preview.resumen.nuevos + preview.resumen.actualiza : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-10 rounded-xl border border-electric-600 px-4 text-sm font-bold leading-10 text-electric-600 transition hover:bg-electric-600 hover:text-white"
      >
        ⬆ Importar {etiqueta}
      </button>

      {abierto && (
        <Modal
          titulo={`⬆ Importar ${etiqueta}`}
          descripcion="Crea o actualiza por RUT. Nada se guarda hasta que confirmes la vista previa."
          ancho="max-w-3xl"
          onClose={cerrar}
        >
          <ol className="space-y-4 text-sm">
            <li className="flex flex-wrap items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-electric-600 text-xs font-bold text-white">
                1
              </span>
              <span className="text-slate-600">
                Descarga la plantilla y complétala en Excel (una fila por {tipo === "CLIENTE" ? "cliente" : "proveedor"}).
              </span>
              <a
                href={`/dashboard/socios/plantilla?tipo=${tipo}`}
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
                <input type="hidden" name="tipo" value={tipo} />
                <input
                  type="file"
                  name="archivo"
                  accept=".xlsx"
                  className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-electric-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-electric-600 hover:file:bg-electric-600 hover:file:text-white"
                />
              </form>
            </li>
          </ol>

          {pendingPreview && <p className="mt-3 text-sm font-semibold text-slate-500">Analizando archivo…</p>}
          {preview.error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-fenix-600">
              {preview.error}
            </p>
          )}

          {preview.filas && preview.resumen && !aplicado && (
            <div className="mt-5 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-lime-400/15 px-3 py-1 text-[#4d7c0f]">{preview.resumen.nuevos} nuevos</span>
                <span className="rounded-full bg-electric-50 px-3 py-1 text-electric-600">{preview.resumen.actualiza} actualizan</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">{preview.resumen.sinCambio} sin cambio</span>
                {preview.resumen.errores > 0 && (
                  <span className="rounded-full bg-fenix-600/10 px-3 py-1 text-fenix-600">{preview.resumen.errores} con error</span>
                )}
              </div>

              <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-cloud/90 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">RUT</th>
                      <th className="px-3 py-2">Razón social</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.filas.map((f) => (
                      <tr key={f.fila} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-400">{f.fila}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {f.estado === "ERROR" ? f.rut || "—" : formatearRut(f.rut)}
                        </td>
                        <td className="max-w-72 truncate px-3 py-2 font-semibold text-navy-950" title={f.motivo ?? f.razonSocial}>
                          {f.estado === "ERROR" ? <span className="text-fenix-600">{f.motivo}</span> : f.razonSocial}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${estadoBadge[f.estado]}`}>
                            {estadoLabel[f.estado]}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {preview.resumen.errores > 0 && (
                <p className="text-xs text-slate-500">
                  Las filas con error no se cargan: corrígelas en el Excel y vuelve a subirlo, o aplica solo las demás.
                </p>
              )}

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
        </Modal>
      )}
    </>
  );
}
