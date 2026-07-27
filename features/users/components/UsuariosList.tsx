"use client";

import { useState } from "react";
import { toggleUsuarioActivo } from "../actions";
import { ROLES_OPCIONES, rolLabel } from "../roles";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";
import { Paginacion } from "@/components/ui/Paginacion";

export interface UsuarioItem {
  id: string;
  nombre: string;
  email: string;
  rol: string;
  localNombre: string | null;
  activo: boolean;
}

type Estado = "TODOS" | "ACTIVOS" | "INACTIVOS";

const PAGINA = 10;

export function UsuariosList({
  usuarios,
  sessionUserId,
}: {
  usuarios: UsuarioItem[];
  /** El usuario logueado no puede desactivarse a sí mismo */
  sessionUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<Estado>("TODOS");
  const [rol, setRol] = useState("");
  const [pagina, setPagina] = useState(1);

  const q = query.trim().toLowerCase();
  const filtrados = usuarios.filter((u) => {
    if (q && !`${u.nombre} ${u.email} ${u.localNombre ?? ""}`.toLowerCase().includes(q)) return false;
    if (rol && u.rol !== rol) return false;
    if (estado === "ACTIVOS" && !u.activo) return false;
    if (estado === "INACTIVOS" && u.activo) return false;
    return true;
  });
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const nActivos = usuarios.filter((u) => u.activo).length;

  const reset = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPagina(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Estado>
          opciones={[
            { valor: "TODOS", label: "Todos", n: usuarios.length },
            { valor: "ACTIVOS", label: "Activos", n: nActivos },
            { valor: "INACTIVOS", label: "Inactivos", n: usuarios.length - nActivos },
          ]}
          valor={estado}
          onChange={reset(setEstado)}
        />

        <select
          value={rol}
          onChange={(e) => reset(setRol)(e.target.value)}
          aria-label="Filtrar por rol"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none focus:border-electric-500"
        >
          <option value="">Todos los roles</option>
          {ROLES_OPCIONES.map((r) => (
            <option key={r.valor} value={r.valor}>
              {r.label}
            </option>
          ))}
        </select>

        <BuscadorLista
          value={query}
          onChange={reset(setQuery)}
          placeholder="Buscar por nombre, correo o local…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-5 py-3">Nombre</th>
            <th className="px-5 py-3">Correo</th>
            <th className="px-5 py-3">Rol</th>
            <th className="px-5 py-3">Local</th>
            <th className="px-5 py-3">Estado</th>
            <th className="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((u) => (
            <tr key={u.id} className="border-b border-slate-100 last:border-0">
              <td className="px-5 py-3 font-semibold text-navy-950">{u.nombre}</td>
              <td className="px-5 py-3 text-slate-600">{u.email}</td>
              <td className="px-5 py-3 text-slate-600">{rolLabel[u.rol] ?? u.rol}</td>
              <td className="px-5 py-3 text-slate-600">{u.localNombre ?? "Todos"}</td>
              <td className="px-5 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                    u.activo ? "bg-lime-400/15 text-[#4d7c0f]" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {u.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="px-5 py-3 text-right">
                {u.id !== sessionUserId && (
                  <form action={toggleUsuarioActivo}>
                    <input type="hidden" name="id" value={u.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                    >
                      {u.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">
                {usuarios.length === 0
                  ? "Aún no hay usuarios. Crea el primero con “＋ Nuevo usuario”."
                  : "Sin resultados para tu búsqueda."}
              </td>
            </tr>
          )}
        </tbody>
      </TablaScroll>

      <div className="flex justify-center">
        <Paginacion
          total={filtrados.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>
    </div>
  );
}
