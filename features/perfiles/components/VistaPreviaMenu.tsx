"use client";

import { agruparMenu, SECCIONES, type ModuloId, type Nivel } from "@/lib/auth/secciones";
import {
  IconBox,
  IconCart,
  IconChart,
  IconEye,
  IconHome,
  IconReceipt,
  IconSettings,
  IconUsers,
} from "@/components/ui/icons";

const icono: Record<ModuloId, React.ReactNode> = {
  inventario: <IconBox size={15} />,
  compras: <IconCart size={15} />,
  ventas: <IconReceipt size={15} />,
  socios: <IconUsers size={15} />,
  reportes: <IconChart size={15} />,
  configuracion: <IconSettings size={15} />,
};

/**
 * El menú que esa persona verá al entrar.
 *
 * Usa el mismo `agruparMenu` que el sidebar real, así que no puede mentir. Convierte una
 * lista abstracta de permisos en el artefacto concreto que el administrador está tratando
 * de controlar, y enseña la regla sin explicarla: al cerrar las secciones de un módulo,
 * el grupo entero desaparece.
 */
export function VistaPreviaMenu({ niveles }: { niveles: Record<string, Nivel> }) {
  const visibles = SECCIONES.filter((s) => (niveles[s.id] ?? "SIN_ACCESO") !== "SIN_ACCESO");
  const grupos = agruparMenu(visibles);

  return (
    <div className="lg:sticky lg:top-4">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
        Así verá el menú
      </p>

      <div className="rounded-xl border border-slate-200 bg-white p-2 text-sm">
        <div className="flex items-center gap-2 px-2 py-1.5 font-semibold text-slate-600">
          <span className="text-electric-600">
            <IconHome size={15} />
          </span>
          Dashboard
        </div>

        {grupos.map((g) => (
          <div key={g.modulo}>
            <div className="flex items-center gap-2 px-2 py-1.5 font-semibold text-slate-600">
              <span className="text-electric-600">{icono[g.modulo]}</span>
              {g.plano ? g.secciones[0].label : g.label}
            </div>
            {!g.plano &&
              g.secciones.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-1.5 py-1 pl-9 pr-2 text-xs text-slate-500"
                >
                  {s.label}
                  {niveles[s.id] === "LECTURA" && (
                    <span className="text-[#b45309]" title="Solo lectura">
                      <IconEye size={12} />
                    </span>
                  )}
                </div>
              ))}
          </div>
        ))}

        {grupos.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-slate-400">
            Solo verá el dashboard. Sin ninguna sección abierta no puede trabajar.
          </p>
        )}
      </div>

      <p className="mt-2 text-xs leading-snug text-slate-400">
        Se actualiza con cada clic. Un módulo sin secciones abiertas desaparece completo.
      </p>
    </div>
  );
}
