"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { abrirToma, type ActionState } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { ALCANCES, type AlcanceToma } from "../toma";

export interface OpcionesAlcance {
  categorias: { id: string; nombre: string }[];
  marcas: string[];
  /** Las ubicaciones son del local; el resto del catálogo es común a la cadena */
  ubicacionesPorLocal: Record<string, string[]>;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function NuevaTomaModal({
  locales,
  esGlobal,
  localPropio,
  opciones,
}: {
  locales: { id: string; nombre: string }[];
  esGlobal: boolean;
  /** Para roles de local: su sucursal, que no se elige */
  localPropio: string | null;
  opciones: OpcionesAlcance;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [local, setLocal] = useState(localPropio ?? "");
  const [alcance, setAlcance] = useState<AlcanceToma>("UBICACION");

  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await abrirToma(prev, fd);
      // Al detalle, no directo al contador uno-a-uno: hay dos formas de contar y con 40
      // productos la planilla es la rápida. Empujar al contador escondía esa opción.
      if (res.tomaId) router.push(`/dashboard/inventario/tomas/${res.tomaId}`);
      return res;
    },
    {},
  );

  const ubicaciones = local ? (opciones.ubicacionesPorLocal[local] ?? []) : [];
  const sinUbicaciones = ubicaciones.length === 0;

  // Si el local elegido no tiene ubicaciones cargadas, "por pasillo" no se puede usar:
  // en vez de dejar el formulario sin salida, cae en categoría.
  const efectivo: AlcanceToma =
    alcance === "UBICACION" && sinUbicaciones ? "CATEGORIA" : alcance;
  const necesitaFiltro =
    efectivo === "CATEGORIA" || efectivo === "MARCA" || efectivo === "UBICACION";

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-flame h-10 rounded-xl px-4 text-sm font-bold leading-10 text-white transition hover:opacity-90"
      >
        ＋ Nueva toma
      </button>

      {abierto && (
        <Modal
          titulo="＋ Nueva toma de inventario"
          descripcion="Se congela el stock actual como referencia y empieza el conteo."
          onClose={() => setAbierto(false)}
        >
          <form action={action} className="space-y-4">
            {esGlobal && (
              <div>
                <label htmlFor="t-local" className="mb-1 block text-sm font-semibold text-slate-700">
                  Local *
                </label>
                <select
                  id="t-local"
                  name="localId"
                  required
                  className={input}
                  value={local}
                  onChange={(e) => setLocal(e.target.value)}
                >
                  <option value="" disabled>
                    — Selecciona —
                  </option>
                  {locales.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-700">Qué contar</span>
              <div role="radiogroup" aria-label="Alcance de la toma" className="grid gap-2">
                {ALCANCES.map((a) => {
                  const bloqueada =
                    a.valor === "UBICACION" && (sinUbicaciones || (esGlobal && !local));
                  return (
                    <label
                      key={a.valor}
                      className={`flex items-start gap-3 rounded-xl border p-3 transition ${
                        bloqueada
                          ? "cursor-not-allowed border-slate-200 opacity-50"
                          : efectivo === a.valor
                            ? "cursor-pointer border-electric-500 bg-electric-50"
                            : "cursor-pointer border-slate-300 hover:border-electric-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="alcance"
                        value={a.valor}
                        checked={efectivo === a.valor}
                        disabled={bloqueada}
                        onChange={() => setAlcance(a.valor)}
                        className="mt-0.5 h-4 w-4 accent-[#0e518d]"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-navy-950">{a.label}</span>
                        <span className="block text-xs text-slate-500">
                          {!bloqueada
                            ? a.ayuda
                            : esGlobal && !local
                              ? "Elige primero el local"
                              : "Ningún producto de este local tiene ubicación cargada"}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {necesitaFiltro && (
              <div>
                <label htmlFor="t-filtro" className="mb-1 block text-sm font-semibold text-slate-700">
                  {efectivo === "CATEGORIA" ? "Categoría" : efectivo === "MARCA" ? "Marca" : "Ubicación"} *
                </label>
                <select
                  key={efectivo}
                  id="t-filtro"
                  name="filtro"
                  required
                  className={input}
                  defaultValue=""
                >
                  <option value="" disabled>
                    — Selecciona —
                  </option>
                  {efectivo === "CATEGORIA" &&
                    opciones.categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  {efectivo === "MARCA" &&
                    opciones.marcas.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  {efectivo === "UBICACION" &&
                    ubicaciones.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="t-nota" className="mb-1 block text-sm font-semibold text-slate-700">
                Nota (opcional)
              </label>
              <input id="t-nota" name="nota" placeholder="Ej: conteo semanal" className={input} />
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-slate-300 p-3">
              <input
                type="checkbox"
                name="ciego"
                defaultChecked
                value="on"
                className="mt-0.5 h-4 w-4 accent-[#0e518d]"
              />
              <span>
                <span className="block text-sm font-bold text-navy-950">Conteo a ciegas</span>
                <span className="block text-xs text-slate-500">
                  No mostrar la cantidad del sistema mientras se cuenta. Verla hace que uno
                  confirme en vez de contar.
                </span>
              </span>
            </label>

            {state.error && (
              <p role="alert" className="text-sm font-semibold text-fenix-600">
                {state.error}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAbierto(false)}
                className="h-11 flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {pending ? "Abriendo…" : "Abrir toma"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
