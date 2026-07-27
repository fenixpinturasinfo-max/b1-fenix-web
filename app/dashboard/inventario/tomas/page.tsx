import Link from "next/link";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { esRolGlobal, puedeEscribir } from "@/lib/auth/permissions";
import { getLocalesActivos } from "@/lib/cache";
import { listaTomas, opcionesDeAlcance } from "@/features/tomas/queries";
import { NuevaTomaModal } from "@/features/tomas/components/NuevaTomaModal";
import { alcanceLabel, estadoToma } from "@/features/tomas/toma";
import { formatCLP } from "@/lib/format";
import { fmtFecha } from "@/lib/fechas";

export default async function TomasPage() {
  const { session, escribe } = await requireSeccionConNivel("inventario.toma");
  const esGlobal = esRolGlobal(session.rol);

  const [tomas, locales, opciones] = await Promise.all([
    listaTomas({ esGlobal, localId: esGlobal ? null : session.localId }),
    esGlobal ? getLocalesActivos() : Promise.resolve([]),
    // Categorías y marcas son del catálogo, único para la cadena: sirven para cualquier
    // local. Solo las ubicaciones dependen de la sucursal, y vienen agrupadas por local.
    opcionesDeAlcance(esGlobal ? null : session.localId),
  ]);

  // Solo bloquea la toma abierta del propio local: la de otra sucursal no es asunto de acá
  const abierta = esGlobal ? undefined : tomas.find((t) => t.estado === "ABIERTA");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Toma de inventario</h1>
          <p className="mt-1 text-slate-500">
            Conteo físico del stock. Cuenta por partes y aplica cuando esté revisado.
          </p>
        </div>
        {escribe && !abierta && (
          <NuevaTomaModal
            locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
            esGlobal={esGlobal}
            localPropio={session.localId}
            opciones={opciones}
          />
        )}
      </div>

      {abierta && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-electric-500/40 bg-white px-4 py-3">
          <span className="font-mono font-bold text-navy-950">{abierta.folio}</span>
          <span className="text-sm text-slate-600">
            {alcanceLabel[abierta.alcance] ?? abierta.alcance}
            {abierta.filtro && ` · ${abierta.filtro}`} · {abierta.contadas} de {abierta.total}{" "}
            contados
          </span>
          <Link
            href={`/dashboard/inventario/tomas/${abierta.id}/contar`}
            className="bg-flame ml-auto h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
          >
            Seguir contando
          </Link>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Toma</th>
              <th className="px-4 py-2.5">Alcance</th>
              {esGlobal && <th className="px-4 py-2.5">Local</th>}
              <th className="px-4 py-2.5">Avance</th>
              <th className="px-4 py-2.5 text-right">Impacto</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {tomas.map((t) => {
              const badge = estadoToma[t.estado];
              return (
                <tr key={t.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-mono font-bold text-navy-950">{t.folio}</span>
                    <span className="block text-xs text-slate-400">
                      {fmtFecha(t.creadoEn)} · {t.creadoPor}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {alcanceLabel[t.alcance] ?? t.alcance}
                    {t.filtro && <span className="block text-xs text-slate-400">{t.filtro}</span>}
                  </td>
                  {esGlobal && <td className="px-4 py-2 text-slate-600">{t.localNombre}</td>}
                  <td className="px-4 py-2 text-slate-600">
                    {t.contadas} de {t.total}
                    {t.conDiferencia > 0 && (
                      <span className="block text-xs text-[#b45309]">
                        {t.conDiferencia} con diferencia
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {t.impacto === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <span
                        className={`font-bold ${t.impacto < 0 ? "text-fenix-600" : "text-[#4d7c0f]"}`}
                      >
                        {formatCLP(t.impacto)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={
                        t.estado === "ABIERTA"
                          ? `/dashboard/inventario/tomas/${t.id}/contar`
                          : `/dashboard/inventario/tomas/${t.id}`
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                    >
                      {t.estado === "ABIERTA" ? "Contar" : "Ver"}
                    </Link>
                  </td>
                </tr>
              );
            })}
            {tomas.length === 0 && (
              <tr>
                <td colSpan={esGlobal ? 7 : 6} className="px-4 py-10 text-center text-sm text-slate-400">
                  Aún no has hecho ninguna toma. Empieza por un pasillo: contar de a poco cada
                  semana rinde más que un inventario total al año.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {!(await puedeEscribir(session.rol, "inventario.toma-aprobar")) && (
        <p className="text-sm text-slate-400">
          Puedes contar y cerrar la toma. El ajuste al stock lo aplica el encargado, después de
          revisar las diferencias.
        </p>
      )}
    </div>
  );
}
