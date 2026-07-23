import { notFound } from "next/navigation";
import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { PrintButton } from "@/features/pos/components/PrintButton";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

const medioLabel: Record<string, string> = {
  EFECTIVO: "Efectivo",
  DEBITO: "Débito",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

export default async function BoletaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireModulo("pos");
  const { id } = await params;

  const venta = await prisma.venta.findUnique({
    where: { id },
    include: {
      local: true,
      usuario: true,
      detalle: { include: { producto: true } },
    },
  });

  if (!venta) notFound();
  // Solo su local, salvo administrador
  if (session.rol !== "ADMINISTRADOR" && venta.localId !== session.localId) notFound();

  const folio = `${venta.local.codigo}-${String(venta.correlativo).padStart(6, "0")}`;

  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex items-center justify-between print:hidden">
        <a href="/dashboard/pos/boletas" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Volver a boletas
        </a>
        <PrintButton />
      </div>

      {/* Boleta / ticket */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <div className="text-center">
          <p className="text-xl font-black text-navy-950">PINTURAS FENIX</p>
          <p className="text-sm text-slate-600">{venta.local.nombre}</p>
          <p className="text-xs text-slate-500">
            {venta.local.direccion}, {venta.local.comuna}
          </p>
        </div>

        <div className="my-5 border-y border-dashed border-slate-300 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Boleta de venta {venta.estado === "ANULADA" ? "· ANULADA" : ""}
          </p>
          <p className="font-mono text-3xl font-black text-navy-950">{folio}</p>
          <p className="mt-1 text-xs text-slate-500">{fmt.format(venta.creadoEn)}</p>
          <p className="text-xs text-slate-500">Atendido por {venta.usuario.nombre}</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="pb-2">Producto</th>
              <th className="pb-2 text-center">Cant</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {venta.detalle.map((d) => (
              <tr key={d.id} className="border-t border-slate-100">
                <td className="py-2">
                  <p className="font-semibold text-navy-950">{d.producto.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {formatCLP(d.precioUnitario)} c/u
                  </p>
                </td>
                <td className="py-2 text-center text-slate-600">{d.cantidad}</td>
                <td className="py-2 text-right font-semibold tabular-nums text-navy-950">
                  {formatCLP(d.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 border-t border-dashed border-slate-300 pt-3 text-sm">
          {venta.descuento > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatCLP(venta.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Descuento</span>
                <span className="tabular-nums">−{formatCLP(venta.descuento)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between text-lg font-black text-navy-950">
            <span>TOTAL</span>
            <span className="tabular-nums">{formatCLP(venta.total)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Medio de pago</span>
            <span>{medioLabel[venta.medioPago]}</span>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          ¡Gracias por tu compra! · Instagram @pinturas.fenix
        </p>
      </div>
    </div>
  );
}
