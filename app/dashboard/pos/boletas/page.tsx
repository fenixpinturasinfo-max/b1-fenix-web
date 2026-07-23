import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

const medioLabel: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

export default async function BoletasPage() {
  const session = await requireModulo("pos");

  const ventas = await prisma.venta.findMany({
    where: session.rol === "ADMINISTRADOR" ? {} : { localId: session.localId! },
    include: {
      local: true,
      usuario: true,
      _count: { select: { detalle: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard/pos" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Volver al POS
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Boletas</h1>
        <p className="mt-1 text-slate-500">
          Últimas 100 ventas{session.rol !== "ADMINISTRADOR" ? " de tu local" : " de todos los locales"}.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Boleta</th>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Local</th>
              <th className="px-5 py-3">Vendedor</th>
              <th className="px-5 py-3">Medio</th>
              <th className="px-5 py-3 text-right">Ítems</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {ventas.map((v) => (
              <tr key={v.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3">
                  <span className="font-mono font-bold text-navy-950">
                    {v.local.codigo}-{String(v.correlativo).padStart(6, "0")}
                  </span>
                  {v.estado === "ANULADA" && (
                    <span className="ml-2 rounded-full bg-fenix-600/10 px-2 py-0.5 text-xs font-bold text-fenix-600">
                      Anulada
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{fmt.format(v.creadoEn)}</td>
                <td className="px-5 py-3 text-slate-600">{v.local.comuna}</td>
                <td className="px-5 py-3 text-slate-600">{v.usuario.nombre}</td>
                <td className="px-5 py-3 text-slate-600">{medioLabel[v.medioPago]}</td>
                <td className="px-5 py-3 text-right text-slate-600">{v._count.detalle}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(v.total)}
                </td>
                <td className="px-5 py-3 text-right">
                  <a
                    href={`/dashboard/pos/boletas/${v.id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                  >
                    Ver
                  </a>
                </td>
              </tr>
            ))}
            {ventas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                  Aún no hay ventas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
