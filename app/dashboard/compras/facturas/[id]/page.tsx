import { esRolGlobal } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { NCForm } from "@/features/purchases/components/NCForm";

const fmt = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" });

export default async function FacturaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSeccion("compras.facturas");
  const { id } = await params;

  const f = await prisma.facturaCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      creadoPor: true,
      ordenCompra: { include: { localDestino: true } },
      lineas: { include: { producto: true } },
      notasCredito: { include: { lineas: { include: { producto: true } }, creadoPor: true } },
    },
  });
  if (!f) notFound();
  if (!esRolGlobal(session.rol) && f.ordenCompra.localDestinoId !== session.localId) notFound();

  const totalNC = f.notasCredito.reduce((n, nc) => n + nc.total, 0);
  const lineasNC = f.lineas.map((l) => {
    const devuelto = f.notasCredito
      .flatMap((nc) => nc.lineas)
      .filter((x) => x.productoId === l.productoId)
      .reduce((n, x) => n + x.cantidad, 0);
    return { productoId: l.productoId, nombre: l.producto.nombre, maxDevolvible: l.cantidad - devuelto };
  }).filter((l) => l.maxDevolvible > 0);

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard/compras/facturas" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Volver a facturas
        </a>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-black text-navy-950">
            FC-{String(f.correlativo).padStart(6, "0")}
          </h1>
          <span className="text-slate-500">N° proveedor: <b className="text-navy-950">{f.numero}</b></span>
          {f.esRecepcionDirecta && (
            <span className="rounded-full bg-[#f59e0b]/15 px-2.5 py-1 text-xs font-bold text-[#b45309]">
              Recepción directa
            </span>
          )}
        </div>
        <p className="mt-1 text-slate-500">
          {f.proveedor.nombreFantasia ?? f.proveedor.razonSocial} · OC-
          {String(f.ordenCompra.correlativo).padStart(6, "0")} → {f.ordenCompra.localDestino.nombre} ·
          emitida {fmt.format(f.fechaEmision)}
          {f.fechaVencimiento ? ` · vence ${fmt.format(f.fechaVencimiento)}` : ""}
        </p>
      </div>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3 text-right">Cantidad</th>
              <th className="px-5 py-3 text-right">Costo unit.</th>
              <th className="px-5 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {f.lineas.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-semibold text-navy-950">{l.producto.nombre}</td>
                <td className="px-5 py-3 text-right text-slate-600">{l.cantidad}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">{formatCLP(l.costoUnitario)}</td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(l.cantidad * l.costoUnitario)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-sm">
            <tr>
              <td colSpan={3} className="px-5 pt-3 text-right text-slate-500">Neto</td>
              <td className="px-5 pt-3 text-right tabular-nums text-slate-600">{formatCLP(f.neto)}</td>
            </tr>
            <tr>
              <td colSpan={3} className="px-5 text-right text-slate-500">IVA 19%</td>
              <td className="px-5 text-right tabular-nums text-slate-600">{formatCLP(f.iva)}</td>
            </tr>
            {totalNC > 0 && (
              <tr>
                <td colSpan={3} className="px-5 text-right font-semibold text-fenix-600">Notas de crédito</td>
                <td className="px-5 text-right font-semibold tabular-nums text-fenix-600">−{formatCLP(totalNC)}</td>
              </tr>
            )}
            <tr>
              <td colSpan={3} className="px-5 py-3 text-right font-bold text-navy-950">Total a pagar</td>
              <td className="px-5 py-3 text-right text-lg font-black tabular-nums text-navy-950">
                {formatCLP(f.total - totalNC)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Notas de crédito existentes */}
      {f.notasCredito.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-navy-950">Notas de crédito</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {f.notasCredito.map((nc) => (
              <li key={nc.id} className="py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-bold text-navy-950">
                    NC-{String(nc.correlativo).padStart(6, "0")}
                  </span>
                  <span className="text-slate-600">{nc.motivo}</span>
                  <span className="font-bold tabular-nums text-fenix-600">−{formatCLP(nc.total)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-400">
                  {nc.lineas.map((l) => `${l.cantidad}x ${l.producto.nombre}`).join(" · ")} ·{" "}
                  {nc.creadoPor.nombre} · {fmt.format(nc.creadoEn)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Nueva NC */}
      {f.estado !== "ANULADA" && lineasNC.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-bold text-navy-950">Devolución al proveedor</h2>
          <p className="mb-3 text-sm text-slate-500">
            Genera una nota de crédito: rebaja el stock del local y el monto por pagar.
          </p>
          <NCForm facturaId={f.id} lineas={lineasNC} />
        </section>
      )}
    </div>
  );
}
