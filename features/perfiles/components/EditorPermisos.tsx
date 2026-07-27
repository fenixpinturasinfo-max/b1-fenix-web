"use client";

import { useActionState, useMemo, useState } from "react";
import { guardarPermisos, type ActionState } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { VistaPreviaMenu } from "./VistaPreviaMenu";
import { IconoNivel, LeyendaNiveles, nivelChip } from "./nivelUi";
import { IconSearch } from "@/components/ui/icons";
import { MODULOS, NIVELES, SECCIONES, resumenPerfil, type Nivel } from "@/lib/auth/secciones";

export interface UsuarioDelPerfil {
  id: string;
  nombre: string;
}

export interface OtroPerfil {
  rol: string;
  label: string;
  niveles: Record<string, Nivel>;
}

const vacio = (): Record<string, Nivel> =>
  Object.fromEntries(SECCIONES.map((s) => [s.id, "SIN_ACCESO" as Nivel]));

/**
 * Matriz de permisos de un perfil, con vista previa del menú al lado.
 *
 * Guardado explícito con contador de cambios: el autoguardado en una pantalla de permisos
 * es peligroso, porque un clic accidental deja a alguien fuera sin que nadie se entere.
 */
export function EditorPermisos({
  rol,
  perfilLabel,
  inicial,
  usuarios,
  otros,
  esPropio,
  soloLectura,
}: {
  rol: string;
  perfilLabel: string;
  inicial: Record<string, Nivel>;
  usuarios: UsuarioDelPerfil[];
  /** Para "partir desde": la matriz de los demás perfiles editables */
  otros: OtroPerfil[];
  /** Nadie edita el perfil que está usando: evita el autobloqueo */
  esPropio: boolean;
  soloLectura: boolean;
}) {
  const base = useMemo(() => ({ ...vacio(), ...inicial }), [inicial]);
  const [niveles, setNiveles] = useState<Record<string, Nivel>>(base);
  const [query, setQuery] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await guardarPermisos(prev, fd);
      if (res.ok) setConfirmar(false);
      return res;
    },
    {},
  );

  const bloqueado = esPropio || soloLectura;

  const cambios = SECCIONES.filter((s) => niveles[s.id] !== base[s.id]);
  const pierden = cambios.filter((s) => niveles[s.id] === "SIN_ACCESO");
  const aLectura = cambios.filter((s) => niveles[s.id] === "LECTURA");
  const ganan = cambios.filter((s) => niveles[s.id] === "TOTAL");

  const q = query.trim().toLowerCase();
  const coincide = (id: string) => {
    if (!q) return true;
    const s = SECCIONES.find((x) => x.id === id)!;
    return `${s.label} ${s.descripcion}`.toLowerCase().includes(q);
  };

  const setNivel = (id: string, n: Nivel) => setNiveles((p) => ({ ...p, [id]: n }));

  const setModulo = (modulo: string, n: Nivel) =>
    setNiveles((p) => {
      const next = { ...p };
      for (const s of SECCIONES.filter((x) => x.modulo === modulo)) {
        next[s.id] = n === "LECTURA" && !s.permiteLectura ? "SIN_ACCESO" : n;
      }
      return next;
    });

  const copiarDe = (otroRol: string) => {
    const otro = otros.find((o) => o.rol === otroRol);
    if (!otro) return;
    setNiveles({ ...vacio(), ...otro.niveles });
  };

  return (
    <>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className={bloqueado ? "pointer-events-none opacity-60" : ""}>
          {/* Barra de herramientas */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 sm:max-w-56">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <IconSearch size={15} />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar sección…"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-navy-950 outline-none focus:border-electric-500"
              />
            </div>

            {otros.length > 0 && (
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-500">
                Partir desde
                <select
                  defaultValue=""
                  onChange={(e) => {
                    copiarDe(e.target.value);
                    e.target.value = "";
                  }}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-2 text-sm text-navy-950 outline-none focus:border-electric-500"
                >
                  <option value="" disabled>
                    — Elegir —
                  </option>
                  {otros.map((o) => (
                    <option key={o.rol} value={o.rol}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="overflow-clip rounded-2xl border border-slate-200 bg-white">
            {MODULOS.map((m) => {
              const suyas = SECCIONES.filter((s) => s.modulo === m.id && coincide(s.id));
              if (suyas.length === 0) return null;
              const total = SECCIONES.filter((s) => s.modulo === m.id);
              const abiertas = total.filter((s) => niveles[s.id] !== "SIN_ACCESO").length;

              return (
                <div key={m.id}>
                  <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-slate-100 bg-cloud px-4 py-2 first:border-t-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      {m.label}
                    </span>
                    <span className="text-xs text-slate-400">
                      {abiertas} de {total.length}
                    </span>
                    <div className="ml-auto flex gap-1">
                      {NIVELES.map((n) => (
                        <button
                          key={n.valor}
                          type="button"
                          onClick={() => setModulo(m.id, n.valor)}
                          title={`Aplicar "${n.label}" a todo ${m.label}`}
                          className="rounded-md px-2 py-1 text-[11px] font-bold text-slate-500 transition hover:bg-white hover:text-electric-600"
                        >
                          {n.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {suyas.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-navy-950">{s.label}</p>
                        <p className="truncate text-xs text-slate-400">{s.descripcion}</p>
                      </div>

                      <div
                        role="radiogroup"
                        aria-label={`Nivel de acceso para ${s.label}`}
                        className="flex shrink-0 gap-0.5 rounded-lg bg-cloud p-0.5"
                      >
                        {NIVELES.map((n) => {
                          if (n.valor === "LECTURA" && !s.permiteLectura) {
                            return <span key={n.valor} aria-hidden="true" className="w-8" />;
                          }
                          const activo = niveles[s.id] === n.valor;
                          return (
                            <button
                              key={n.valor}
                              type="button"
                              role="radio"
                              aria-checked={activo}
                              aria-label={n.label}
                              title={`${n.label} · ${n.ayuda}`}
                              onClick={() => setNivel(s.id, n.valor)}
                              className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
                                activo
                                  ? nivelChip[n.valor]
                                  : "text-slate-300 hover:bg-white hover:text-slate-500"
                              }`}
                            >
                              <IconoNivel nivel={n.valor} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {SECCIONES.every((s) => !coincide(s.id)) && (
              <p className="px-4 py-10 text-center text-sm text-slate-400">
                Ninguna sección coincide con “{query}”.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <VistaPreviaMenu niveles={niveles} />
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              En una frase
            </p>
            <p className="mt-1 text-sm leading-snug text-slate-600">{resumenPerfil(niveles)}</p>
          </div>
          <LeyendaNiveles />
        </div>
      </div>

      {bloqueado && (
        <p className="mt-4 rounded-2xl border border-[#f59e0b]/40 bg-white px-4 py-3 text-sm font-semibold text-[#b45309]">
          {esPropio
            ? "No puedes cambiar los permisos del perfil que estás usando. Pídeselo a otro administrador."
            : "Tu perfil puede ver esta pantalla, pero no modificarla."}
        </p>
      )}

      {/* Barra de guardado: fuera del flujo para que no tape la última fila */}
      {!bloqueado && (
        <div className="sticky bottom-0 z-30 -mx-4 mt-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-slate-600">
              {cambios.length === 0
                ? "Sin cambios"
                : `${cambios.length} ${cambios.length === 1 ? "cambio" : "cambios"} sin guardar`}
            </span>
            {state.error && (
              <span role="alert" className="text-sm font-semibold text-fenix-600">
                {state.error}
              </span>
            )}
            {state.ok && (
              <span role="status" className="text-sm font-semibold text-[#4d7c0f]">
                ✅ {state.ok}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                disabled={cambios.length === 0}
                onClick={() => setNiveles(base)}
                className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 disabled:opacity-40"
              >
                Descartar
              </button>
              <button
                type="button"
                disabled={cambios.length === 0 || pending}
                onClick={() => setConfirmar(true)}
                className="bg-flame h-11 rounded-xl px-5 font-bold text-white transition hover:opacity-90 disabled:opacity-40"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmar && (
        <Modal
          titulo={`Guardar cambios en ${perfilLabel}`}
          descripcion={
            usuarios.length === 0
              ? "Ningún usuario tiene este perfil todavía."
              : `Afecta a ${usuarios.length} ${usuarios.length === 1 ? "usuario activo" : "usuarios activos"}: ${usuarios.map((u) => u.nombre).join(", ")}.`
          }
          onClose={() => setConfirmar(false)}
        >
          {/* Lo que se quita va primero: es lo que rompe el trabajo de alguien */}
          <div className="space-y-3 text-sm">
            {pierden.length > 0 && (
              <ListaDiff
                titulo="Pierden acceso a"
                items={pierden.map((s) => s.label)}
                tono="text-fenix-600"
              />
            )}
            {aLectura.length > 0 && (
              <ListaDiff
                titulo="Pasan a solo lectura"
                items={aLectura.map((s) => s.label)}
                tono="text-[#b45309]"
              />
            )}
            {ganan.length > 0 && (
              <ListaDiff
                titulo="Ganan acceso total a"
                items={ganan.map((s) => s.label)}
                tono="text-[#4d7c0f]"
              />
            )}
            <p className="text-xs text-slate-400">
              Los cambios se aplican de inmediato, incluso para quienes tengan la sesión
              abierta.
            </p>
          </div>

          <form action={action} className="mt-4 flex gap-2">
            <input type="hidden" name="rol" value={rol} />
            {SECCIONES.map((s) => (
              <input key={s.id} type="hidden" name={`n:${s.id}`} value={niveles[s.id]} />
            ))}
            <button
              type="button"
              onClick={() => setConfirmar(false)}
              className="h-11 flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function ListaDiff({ titulo, items, tono }: { titulo: string; items: string[]; tono: string }) {
  return (
    <div>
      <p className={`font-bold ${tono}`}>{titulo}:</p>
      <ul className="mt-0.5 list-inside list-disc text-slate-600">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
