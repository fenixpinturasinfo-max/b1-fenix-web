import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { esDescuadre } from "@/features/pos/caja";
import { fmtFechaHora, inicioDia, inicioMes } from "@/lib/fechas";

const fmt = { format: fmtFechaHora };

export default async function ReportesPage() {
  const session = await requireSeccion("reportes.general");
  const whereLocal = esRolGlobal(session.rol) ? {} : { localId: session.localId! };

  // Día y mes chilenos: en Vercel el servidor corre en UTC
  const hoy = inicioDia();
  const mes = inicioMes();

  const [ventasHoy, ventasMes, topDetalle, cierres, emailsHoy, emailsMes, ultimosEmails] = await Promise.all([
    prisma.venta.aggregate({
      where: { ...whereLocal, estado: "COMPLETADA", creadoEn: { gte: hoy } },
      _sum: { total: true },
      _count: true,
    }),
    prisma.venta.aggregate({
      where: {
        ...whereLocal,
        estado: "COMPLETADA",
        creadoEn: { gte: mes },
      },
      _sum: { total: true },
      _count: true,
    }),
    prisma.detalleVenta.groupBy({
      by: ["productoId"],
      where: { venta: { ...whereLocal, estado: "COMPLETADA" } },
      _sum: { cantidad: true, subtotal: true },
      orderBy: { _sum: { subtotal: "desc" } },
      take: 10,
    }),
    prisma.cajaSesion.findMany({
      where: { ...whereLocal, estado: "CERRADA" },
      include: { usuario: true, local: true },
      orderBy: { cerradaEn: "desc" },
      take: 10,
    }),
    prisma.emailBoleta.count({ where: { enviadoEn: { gte: hoy } } }),
    prisma.emailBoleta.count({
      where: { enviadoEn: { gte: mes } },
    }),
    prisma.emailBoleta.findMany({ orderBy: { enviadoEn: "desc" }, take: 10 }),
  ]);

  // Folios de las boletas enviadas
  const ventasEmail = await prisma.venta.findMany({
    where: { id: { in: ultimosEmails.map((e) => e.ventaId) } },
    include: { local: true },
  });
  const folioPor = new Map(
    ventasEmail.map((v) => [v.id, `${v.local.codigo}-${String(v.correlativo).padStart(6, "0")}`]),
  );
  const LIMITE_DIARIO = 100; // plan gratuito de Resend

  const productosTop = await prisma.producto.findMany({
    where: { id: { in: topDetalle.map((t) => t.productoId) } },
  });
  const nombrePor = new Map(productosTop.map((p) => [p.id, p.nombre]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Reportes</h1>
        <p className="mt-1 text-slate-500">
          {esRolGlobal(session.rol) ? "Consolidado de todos los locales" : session.localNombre}
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Ventas de hoy</p>
          <p className="mt-2 text-3xl font-black text-navy-950">{formatCLP(ventasHoy._sum.total ?? 0)}</p>
          <p className="text-sm text-slate-500">{ventasHoy._count} transacciones</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Ventas del mes</p>
          <p className="mt-2 text-3xl font-black text-navy-950">{formatCLP(ventasMes._sum.total ?? 0)}</p>
          <p className="text-sm text-slate-500">{ventasMes._count} transacciones</p>
        </div>
      </div>

      {/* Correos de boletas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-navy-950">Boletas enviadas por correo</h2>
          <span className="text-sm text-slate-500">{emailsMes} este mes</span>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-semibold text-navy-950">Hoy: {emailsHoy} de {LIMITE_DIARIO}</span>
            <span className="text-slate-500">
              {LIMITE_DIARIO - emailsHoy} disponibles (plan gratis Resend)
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-cloud">
            <div
              className={`h-full rounded-full ${
                emailsHoy / LIMITE_DIARIO > 0.8
                  ? "bg-fenix-600"
                  : "bg-[linear-gradient(90deg,#1d6fb0,#0e518d)]"
              }`}
              style={{ width: `${Math.min(100, Math.round((emailsHoy / LIMITE_DIARIO) * 100))}%` }}
            />
          </div>
        </div>
        {ultimosEmails.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th className="py-2">Boleta</th>
                <th className="py-2">Destinatario</th>
              </tr>
            </thead>
            <tbody>
              {ultimosEmails.map((e) => (
                <tr key={e.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 text-slate-600">{fmt.format(e.enviadoEn)}</td>
                  <td className="py-2.5 font-mono text-xs font-bold text-navy-950">
                    {folioPor.get(e.ventaId) ?? "—"}
                  </td>
                  <td className="py-2.5 text-slate-600">{e.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navy-950">Productos más vendidos</h2>
        {topDetalle.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay ventas registradas.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2">Producto</th>
                <th className="py-2 text-right">Unidades</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {topDetalle.map((t) => (
                <tr key={t.productoId} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 font-semibold text-navy-950">
                    {nombrePor.get(t.productoId) ?? "—"}
                  </td>
                  <td className="py-2.5 text-right text-slate-600">{t._sum.cantidad}</td>
                  <td className="py-2.5 text-right font-bold text-navy-950">
                    {formatCLP(t._sum.subtotal ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navy-950">Últimos cierres de caja</h2>
        {cierres.length === 0 ? (
          <p className="text-sm text-slate-400">Aún no hay cierres de caja.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-2">Fecha</th>
                <th className="py-2">Local</th>
                <th className="py-2">Usuario</th>
                <th className="py-2 text-right">Esperado</th>
                <th className="py-2 text-right">Contado</th>
                <th className="py-2 text-right">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              {cierres.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2.5 text-slate-600">{c.cerradaEn ? fmt.format(c.cerradaEn) : "—"}</td>
                  <td className="py-2.5 text-slate-600">{c.local.comuna}</td>
                  <td className="py-2.5 text-slate-600">{c.usuario.nombre}</td>
                  <td className="py-2.5 text-right text-slate-600">{formatCLP(c.montoEsperado ?? 0)}</td>
                  <td className="py-2.5 text-right text-slate-600">{formatCLP(c.montoCierre ?? 0)}</td>
                  <td
                    className={`py-2.5 text-right font-bold ${
                      !esDescuadre(c.diferencia)
                        ? "text-[#4d7c0f]"
                        : "text-fenix-600"
                    }`}
                  >
                    {formatCLP(c.diferencia ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
