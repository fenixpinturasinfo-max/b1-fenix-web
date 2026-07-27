import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth/guards";
import { esRolGlobal, puedeEscribir } from "@/lib/auth/permissions";
import { tomaDetalle } from "@/features/tomas/queries";
import { cerrarConteo } from "@/features/tomas/actions";
import { alcanceLabel, estadoToma } from "@/features/tomas/toma";
import { RevisionToma } from "@/features/tomas/components/RevisionToma";
import { fmtFechaHora } from "@/lib/fechas";

export default async function TomaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSeccion("inventario.toma");
  const { id } = await params;

  const toma = await tomaDetalle(id);
  if (!toma) notFound();
  if (!esRolGlobal(session.rol) && toma.localId !== session.localId) notFound();

  const puedeAplicar = await puedeEscribir(session.rol, "inventario.toma-aprobar");
  const badge = estadoToma[toma.estado];
  const contadas = toma.lineas.filter((l) => l.contado !== null).length;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/inventario/tomas"
          className="text-sm font-bold text-electric-600 hover:underline"
        >
          ← Tomas de inventario
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-black text-navy-950">{toma.folio}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
            {badge.label}
          </span>
        </div>
        <p className="mt-1 text-slate-500">
          {toma.localNombre} · {alcanceLabel[toma.alcance] ?? toma.alcance}
          {toma.filtro && ` · ${toma.filtro}`} · {contadas} de {toma.lineas.length} contados
        </p>
        <p className="text-xs text-slate-400">
          Abierta por {toma.creadoPor} el {fmtFechaHora(toma.creadoEn)}
          {toma.aplicadaPor &&
            ` · aplicada por ${toma.aplicadaPor} el ${fmtFechaHora(toma.aplicadaEn!)}`}
        </p>
        {toma.nota && <p className="mt-1 text-sm italic text-slate-500">“{toma.nota}”</p>}
      </div>

      {toma.estado === "ABIERTA" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-electric-500/40 bg-white px-4 py-3">
          <span className="text-sm text-slate-600">
            {contadas === toma.lineas.length
              ? "Contaste todo. Cierra el conteo para que lo revisen."
              : `Quedan ${toma.lineas.length - contadas} productos por contar.`}
          </span>
          <div className="ml-auto flex gap-2">
            <Link
              href={`/dashboard/inventario/tomas/${toma.id}/contar`}
              className="flex h-11 items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
            >
              Seguir contando
            </Link>
            {contadas > 0 && (
              <form action={cerrarConteo}>
                <input type="hidden" name="tomaId" value={toma.id} />
                <button
                  type="submit"
                  className="bg-flame h-11 rounded-xl px-5 font-bold text-white transition hover:opacity-90"
                >
                  Cerrar conteo
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {toma.estado === "CONTADA" && !puedeAplicar && (
        <p className="rounded-2xl border border-[#f59e0b]/40 bg-white px-4 py-3 text-sm font-semibold text-[#b45309]">
          El conteo está cerrado y esperando revisión. El ajuste al stock lo aplica el
          encargado.
        </p>
      )}

      {/* Una toma en conteo no muestra sus diferencias a quien la está contando:
          sería la puerta de atrás al esperado que el conteo ciego oculta. */}
      {(toma.estado !== "ABIERTA" || puedeAplicar) && (
        <RevisionToma toma={toma} puedeAplicar={puedeAplicar} />
      )}
      {toma.estado === "ABIERTA" && !puedeAplicar && (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          Las diferencias se ven al cerrar el conteo. Mientras cuentas no se muestran, para
          que el conteo mida lo que hay y no lo que el sistema cree que hay.
        </p>
      )}
    </div>
  );
}
