import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const tipoLabel: Record<string, { label: string; cls: string }> = {
  ENTRADA: { label: "Entrada", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  SALIDA_VENTA: { label: "Venta", cls: "bg-navy-950/5 text-navy-950" },
  AJUSTE: { label: "Ajuste", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  MERMA: { label: "Merma", cls: "bg-fenix-600/10 text-fenix-600" },
  TRANSFERENCIA_SALIDA: { label: "Transf. salida", cls: "bg-slate-100 text-slate-600" },
  TRANSFERENCIA_ENTRADA: { label: "Transf. entrada", cls: "bg-slate-100 text-slate-600" },
};

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function MovimientosPage() {
  const session = await requireModulo("inventario");

  const movimientos = await prisma.movimientoInventario.findMany({
    where: session.rol === "ADMINISTRADOR" ? {} : { localId: session.localId! },
    include: { producto: true, local: true, usuario: true },
    orderBy: { creadoEn: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard/inventario" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Volver a inventario
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Historial de movimientos</h1>
        <p className="mt-1 text-slate-500">Últimos 100 movimientos{session.rol !== "ADMINISTRADOR" ? " de tu local" : ""}.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Fecha</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3">Local</th>
              <th className="px-5 py-3 text-right">Cantidad</th>
              <th className="px-5 py-3">Usuario</th>
              <th className="px-5 py-3">Nota</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => {
              const t = tipoLabel[m.tipo];
              return (
                <tr key={m.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 whitespace-nowrap text-slate-600">{fmt.format(m.creadoEn)}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${t.cls}`}>{t.label}</span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-navy-950">{m.producto.nombre}</td>
                  <td className="px-5 py-3 text-slate-600">{m.local.comuna}</td>
                  <td className={`px-5 py-3 text-right font-bold ${m.cantidad < 0 ? "text-fenix-600" : "text-[#4d7c0f]"}`}>
                    {m.cantidad > 0 ? `+${m.cantidad}` : m.cantidad}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{m.usuario.nombre}</td>
                  <td className="px-5 py-3 text-slate-400">{m.nota ?? "—"}</td>
                </tr>
              );
            })}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Aún no hay movimientos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
