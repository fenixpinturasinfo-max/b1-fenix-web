import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth/guards";
import { esRolGlobal, puedeEscribir } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { fmtFechaHora, fmtFechaSola, inicioDia } from "@/lib/fechas";
import { PrintButton } from "@/features/pos/components/PrintButton";
import {
  AccionesFactura,
  type PedidoVinculable,
} from "@/features/sales/components/AccionesFactura";
import {
  condicionPagoLabel,
  diasDeAtraso,
  estadoFacturaVenta,
  type EstadoFacturaVenta,
} from "@/features/sales/factura";

export default async function FacturaVentaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSeccion("ventas.facturas");
  const { id } = await params;

  const factura = await prisma.facturaVenta.findUnique({
    where: { id },
    include: {
      cliente: true,
      local: true,
      pedido: { select: { id: true, correlativo: true } },
      creadoPor: { select: { nombre: true } },
      anuladaPor: { select: { nombre: true } },
      lineas: { include: { producto: { select: { nombre: true, sku: true, marca: true } } } },
    },
  });
  if (!factura) notFound();
  if (!esRolGlobal(session.rol) && factura.localId !== session.localId) notFound();

  const escribe = await puedeEscribir(session.rol, "ventas.facturas");

  // Pedidos que se podrían vincular: del mismo local, mismo cliente y sin factura
  const vinculables: PedidoVinculable[] = factura.pedidoId
    ? []
    : (
        await prisma.pedidoCliente.findMany({
          where: {
            localId: factura.localId,
            factura: null,
            estado: { notIn: ["ANULADO", "FACTURADO"] },
            OR: [{ clienteId: factura.clienteId }, { clienteId: null }],
          },
          orderBy: { creadoEn: "desc" },
          take: 50,
          select: { id: true, correlativo: true, nombreCliente: true, total: true },
        })
      ).map((p) => ({
        id: p.id,
        folio: `PED-${String(p.correlativo).padStart(6, "0")}`,
        nombreCliente: p.nombreCliente,
        total: p.total,
      }));

  const folio = `FV-${String(factura.correlativo).padStart(6, "0")}`;
  const badge = estadoFacturaVenta[factura.estado as EstadoFacturaVenta];
  const atraso = factura.fechaVencimiento
    ? diasDeAtraso(factura.fechaVencimiento, inicioDia())
    : null;
  const vencida = factura.estado === "ABIERTA" && (atraso ?? -1) > 0;

  return (
    <div className="space-y-5">
      <div className="print:hidden">
        <Link
          href="/dashboard/ventas/facturas"
          className="text-sm font-bold text-electric-600 hover:underline"
        >
          ← Facturas de venta
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-black text-navy-950">{folio}</h1>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.cls}`}>
            {badge.label}
          </span>
          {vencida && (
            <span className="rounded-full bg-fenix-600/10 px-2.5 py-0.5 text-xs font-bold text-fenix-600">
              {atraso} día{atraso === 1 ? "" : "s"} de atraso
            </span>
          )}
          <PrintButton />
        </div>
        <p className="text-xs text-slate-400">
          Emitida por {factura.creadoPor.nombre} el {fmtFechaHora(factura.creadoEn)}
          {factura.pagadaEn && ` · pagada el ${fmtFechaSola(factura.pagadaEn)}`}
          {factura.anuladaPor &&
            ` · anulada por ${factura.anuladaPor.nombre} el ${fmtFechaHora(factura.anuladaEn!)}`}
        </p>
      </div>

      {factura.estado === "ANULADA" && (
        <div className="rounded-2xl border border-fenix-600/30 bg-fenix-600/5 px-4 py-3 print:hidden">
          <p className="text-sm font-bold text-fenix-600">
            Factura anulada · el stock volvió al inventario
          </p>
          {factura.motivoAnulacion && (
            <p className="mt-1 text-sm text-slate-600">
              Motivo: <span className="italic">“{factura.motivoAnulacion}”</span>
            </p>
          )}
        </div>
      )}

      {escribe && (
        <AccionesFactura
          facturaId={factura.id}
          folio={folio}
          total={factura.total}
          estado={factura.estado as EstadoFacturaVenta}
          tienePedido={factura.pedidoId !== null}
          pedidos={vinculables}
        />
      )}

      {/* Documento */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-black text-navy-950">PINTURAS FENIX</p>
            <p className="text-sm text-slate-600">{factura.local.nombre}</p>
            <p className="text-xs text-slate-500">
              {factura.local.direccion}, {factura.local.comuna}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Factura de venta {factura.estado === "ANULADA" ? "· ANULADA" : ""}
            </p>
            <p className="font-mono text-2xl font-black text-navy-950">{folio}</p>
            {factura.folioSii && (
              <p className="text-xs text-slate-500">Folio SII {factura.folioSii}</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Emisión {fmtFechaSola(factura.fechaEmision)}
            </p>
          </div>
        </div>

        <div className="my-5 grid gap-4 border-y border-dashed border-slate-300 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Cliente
            </p>
            <p className="font-bold text-navy-950">{factura.cliente.razonSocial}</p>
            <p className="font-mono text-xs text-slate-600">RUT {factura.cliente.rut}</p>
            {factura.cliente.giro && (
              <p className="text-xs text-slate-500">{factura.cliente.giro}</p>
            )}
            {factura.cliente.direccion && (
              <p className="text-xs text-slate-500">
                {factura.cliente.direccion}
                {factura.cliente.comuna ? `, ${factura.cliente.comuna}` : ""}
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Condición de pago
            </p>
            <p className="font-bold text-navy-950">
              {factura.condicionPago
                ? (condicionPagoLabel[factura.condicionPago] ?? factura.condicionPago)
                : "—"}
            </p>
            {factura.fechaVencimiento && (
              <p className={`text-xs ${vencida ? "font-bold text-fenix-600" : "text-slate-500"}`}>
                Vence {fmtFechaSola(factura.fechaVencimiento)}
              </p>
            )}
            {factura.pedido && (
              <p className="mt-1 text-xs text-slate-500">
                Pedido{" "}
                <span className="font-mono">
                  PED-{String(factura.pedido.correlativo).padStart(6, "0")}
                </span>
              </p>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400">
              <th className="pb-2">Producto</th>
              <th className="pb-2 text-center">Cant</th>
              <th className="pb-2 text-right">P. neto</th>
              <th className="pb-2 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {factura.lineas.map((l) => (
              <tr key={l.id} className="border-t border-slate-100">
                <td className="py-2">
                  <span className="font-semibold text-navy-950">{l.producto.nombre}</span>
                  <span className="block text-xs text-slate-400">
                    {l.producto.marca} · {l.producto.sku}
                  </span>
                </td>
                <td className="py-2 text-center tabular-nums text-slate-600">{l.cantidad}</td>
                <td className="py-2 text-right tabular-nums text-slate-600">
                  {formatCLP(l.precioUnitario)}
                </td>
                <td className="py-2 text-right font-semibold tabular-nums text-navy-950">
                  {formatCLP(l.subtotal)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <dl className="w-56 space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Neto</dt>
              <dd className="tabular-nums text-navy-950">{formatCLP(factura.neto)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">IVA 19%</dt>
              <dd className="tabular-nums text-navy-950">{formatCLP(factura.iva)}</dd>
            </div>
            <div className="flex justify-between border-t border-slate-300 pt-1">
              <dt className="font-bold text-navy-950">Total</dt>
              <dd className="text-lg font-black tabular-nums text-navy-950">
                {formatCLP(factura.total)}
              </dd>
            </div>
          </dl>
        </div>

        {factura.nota && (
          <p className="mt-4 border-t border-dashed border-slate-300 pt-3 text-sm italic text-slate-500">
            {factura.nota}
          </p>
        )}
      </div>
    </div>
  );
}
