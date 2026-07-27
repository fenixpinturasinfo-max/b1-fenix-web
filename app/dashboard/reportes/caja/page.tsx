import Link from "next/link";
import { requireSeccion } from "@/lib/auth/guards";
import { esRolGlobal } from "@/lib/auth/permissions";
import { fmtFecha, inicioDia, partesSantiago, sumarDias } from "@/lib/fechas";
import { diasDeCaja } from "@/features/pos/queries";
import { LineaTiempoCaja } from "@/features/pos/components/LineaTiempoCaja";
import { TOLERANCIA_DESCUADRE } from "@/features/pos/caja";
import { formatCLP } from "@/lib/format";

/** `?dia=YYYY-MM-DD`; sin parámetro, hoy. */
function fechaDe(param: string | undefined): Date {
  if (!param || !/^\d{4}-\d{2}-\d{2}$/.test(param)) return inicioDia();
  const [a, m, d] = param.split("-").map(Number);
  return inicioDia(new Date(Date.UTC(a, m - 1, d, 12)));
}

function claveDia(f: Date): string {
  const p = partesSantiago(f);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export default async function ReporteCajaPage({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const session = await requireSeccion("reportes.caja");
  const { dia } = await searchParams;
  const fecha = fechaDe(dia);

  const dias = await diasDeCaja(fecha, {
    esGlobal: esRolGlobal(session.rol),
    localId: esRolGlobal(session.rol) ? null : session.localId,
  });

  const anterior = claveDia(sumarDias(fecha, -1));
  const siguiente = claveDia(sumarDias(fecha, 1));
  const esHoy = claveDia(fecha) === claveDia(inicioDia());

  const nav =
    "flex h-10 items-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Caja y turnos</h1>
          <p className="mt-1 text-slate-500">
            {esRolGlobal(session.rol) ? "Todos los locales" : session.localNombre} ·{" "}
            {fmtFecha(fecha)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/reportes/caja?dia=${anterior}`} className={nav}>
            ‹ Día anterior
          </Link>
          {!esHoy && (
            <Link href="/dashboard/reportes/caja" className={nav}>
              Hoy
            </Link>
          )}
          <Link
            href={`/dashboard/reportes/caja?dia=${siguiente}`}
            aria-disabled={esHoy}
            className={`${nav} ${esHoy ? "pointer-events-none opacity-40" : ""}`}
          >
            Día siguiente ›
          </Link>
        </div>
      </div>

      {dias.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-400">
          Nadie abrió caja este día.
        </p>
      ) : (
        dias.map((d) => <LineaTiempoCaja key={d.localId} dia={d} />)
      )}

      <p className="text-sm text-slate-400">
        Una diferencia bajo {formatCLP(TOLERANCIA_DESCUADRE)} no se marca: perseguir el vuelto
        de $200 desgasta al equipo y convierte el rojo en ruido. Los movimientos de caja
        —sangrías, gastos e ingresos— ya están descontados del efectivo esperado.
      </p>
    </div>
  );
}
