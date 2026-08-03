import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth/guards";
import { esRolGlobal, puedeEscribir } from "@/lib/auth/permissions";
import { tomaDetalle } from "@/features/tomas/queries";
import { cerrarConteo } from "@/features/tomas/actions";
import { alcanceLabel, estadoToma } from "@/features/tomas/toma";
import { RevisionToma } from "@/features/tomas/components/RevisionToma";
import { AnularTomaButton } from "@/features/tomas/components/AnularTomaButton";
import { ImportarConteo } from "@/features/tomas/components/ImportarConteo";
import { diasEntre, fmtFecha, fmtFechaHora } from "@/lib/fechas";
import { DIAS_CONTEO_ANTIGUO } from "@/features/tomas/toma";

export default async function TomaPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSeccion("inventario.toma");
  const { id } = await params;

  const toma = await tomaDetalle(id);
  if (!toma) notFound();
  if (!esRolGlobal(session.rol) && toma.localId !== session.localId) notFound();

  const [puedeAplicar, escribeToma] = await Promise.all([
    puedeEscribir(session.rol, "inventario.toma-aprobar"),
    puedeEscribir(session.rol, "inventario.toma"),
  ]);
  const badge = estadoToma[toma.estado];
  const contadas = toma.lineas.filter((l) => l.contado !== null).length;

  // Cuanto más viejo el conteo, más movimientos hay que sumar de vuelta y más chance de que
  // alguno esté mal registrado. La corrección funciona igual, pero conviene decirlo.
  const diasDelConteo = toma.fechaConteo ? diasEntre(toma.fechaConteo) : null;
  const conteoAntiguo =
    toma.estado === "CONTADA" && diasDelConteo !== null && diasDelConteo >= DIAS_CONTEO_ANTIGUO;

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
          {toma.fechaConteo && ` · contado el ${fmtFecha(toma.fechaConteo)}`}
        </p>
        <p className="text-xs text-slate-400">
          Abierta por {toma.creadoPor} el {fmtFechaHora(toma.creadoEn)}
          {toma.aplicadaPor &&
            ` · aplicada por ${toma.aplicadaPor} el ${fmtFechaHora(toma.aplicadaEn!)}`}
          {toma.anuladaPor &&
            ` · anulada por ${toma.anuladaPor} el ${fmtFechaHora(toma.anuladaEn!)}`}
        </p>
        {toma.nota && <p className="mt-1 text-sm italic text-slate-500">“{toma.nota}”</p>}
      </div>

      {toma.estado === "ANULADA" && (
        <div className="rounded-2xl border border-fenix-600/30 bg-fenix-600/5 px-4 py-3">
          <p className="text-sm font-bold text-fenix-600">
            Toma anulada · el stock no fue modificado
          </p>
          {toma.motivoAnulacion && (
            <p className="mt-1 text-sm text-slate-600">
              Motivo: <span className="italic">“{toma.motivoAnulacion}”</span>
            </p>
          )}
          <p className="mt-1 text-xs text-slate-400">
            El conteo queda como registro histórico, pero ya no puede aplicarse. Para volver a
            contar este alcance, abre una toma nueva.
          </p>
        </div>
      )}

      {toma.estado === "ABIERTA" && (
        <div className="space-y-4 rounded-2xl border border-electric-500/40 bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="font-bold text-navy-950">
                {contadas === toma.lineas.length
                  ? "Contaste todo. Cierra el conteo para que lo revisen."
                  : `¿Cómo quieres contar? Quedan ${toma.lineas.length - contadas} de ${toma.lineas.length} productos.`}
              </p>
              <p className="text-sm text-slate-500">
                {toma.ciego
                  ? "Conteo a ciegas: no se muestra la cantidad del sistema hasta la revisión."
                  : "Conteo con verificación: la cantidad del sistema está a la vista."}
              </p>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              {escribeToma && (
                <AnularTomaButton
                  tomaId={toma.id}
                  folio={toma.folio}
                  estado="ABIERTA"
                  contadas={contadas}
                  total={toma.lineas.length}
                />
              )}
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

          {/* Los dos métodos como iguales. Antes abrir una toma llevaba directo al contador
              uno-a-uno, que para 40 productos en un escritorio es el camino más lento. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-cloud/40 p-4">
              <p className="font-bold text-navy-950">📄 Con planilla Excel</p>
              <p className="mt-1 text-sm text-slate-500">
                Descarga la lista, cuenta con el papel o el celular en la mano y súbela cuando
                termines. Lo más rápido para muchos productos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={`/dashboard/inventario/tomas/${toma.id}/planilla`}
                  className="flex h-11 items-center rounded-xl bg-electric-600 px-4 text-sm font-bold text-white transition hover:opacity-90"
                >
                  ⬇ Descargar planilla
                </a>
                {escribeToma && <ImportarConteo tomaId={toma.id} folio={toma.folio} />}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-cloud/40 p-4">
              <p className="font-bold text-navy-950">📱 Producto por producto</p>
              <p className="mt-1 text-sm text-slate-500">
                Pantalla para contar de pie entre las estanterías, con lector de código de
                barra. Conviene para pocos productos o para recontar diferencias.
              </p>
              <div className="mt-3">
                <Link
                  href={`/dashboard/inventario/tomas/${toma.id}/contar`}
                  className="flex h-11 w-fit items-center rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                >
                  {contadas > 0 ? "Seguir contando" : "Empezar a contar"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {conteoAntiguo && (
        <p className="rounded-2xl border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-4 py-3 text-sm text-[#b45309]">
          ⚠️ Este conteo tiene {diasDelConteo} días. Las diferencias ya descuentan los
          movimientos posteriores, pero mientras más tiempo pasa, más movimientos hay que
          corregir y más peso tiene cualquiera que esté mal registrado. Conviene recontar las
          diferencias grandes antes de aplicar.
        </p>
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
