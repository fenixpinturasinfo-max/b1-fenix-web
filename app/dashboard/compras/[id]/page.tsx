import { esRolGlobal } from "@/lib/auth/permissions";
import { notFound } from "next/navigation";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { RecepcionForm } from "@/features/purchases/components/RecepcionForm";
import { FacturaForm } from "@/features/purchases/components/FacturaForm";
import { anularOC } from "@/features/purchases/actions";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

function Arrow() {
  return <span aria-hidden="true" className="font-bold text-slate-300">→</span>;
}

function FlowChip({
  done,
  label,
  href,
  current,
}: {
  done: boolean;
  label: string;
  href?: string;
  current?: boolean;
}) {
  const cls = current
    ? "bg-electric-600 font-mono text-white"
    : done
      ? "bg-lime-400/15 font-semibold text-[#4d7c0f]"
      : "bg-slate-100 text-slate-400";
  const chip = (
    <span className={`rounded-full px-3 py-1 text-xs ${cls} ${href ? "hover:opacity-80" : ""}`}>
      {done && !current ? "✓ " : ""}{label}
    </span>
  );
  return href ? <a href={href}>{chip}</a> : chip;
}

const estadoBadge: Record<string, { label: string; cls: string }> = {
  BORRADOR: { label: "Borrador", cls: "bg-slate-100 text-slate-500" },
  ENVIADA: { label: "Enviada", cls: "bg-electric-50 text-electric-600" },
  RECIBIDA_PARCIAL: { label: "Recibida parcial", cls: "bg-[#f59e0b]/15 text-[#b45309]" },
  RECIBIDA: { label: "Recibida", cls: "bg-lime-400/15 text-[#4d7c0f]" },
  CERRADA: { label: "Cerrada", cls: "bg-slate-100 text-slate-500" },
  ANULADA: { label: "Anulada", cls: "bg-fenix-600/10 text-fenix-600" },
};

export default async function OCDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSeccion("compras.ordenes");
  const { id } = await params;

  const oc = await prisma.ordenCompra.findUnique({
    where: { id },
    include: {
      proveedor: true,
      localDestino: true,
      creadoPor: true,
      lineas: { include: { producto: true } },
      entradas: { include: { lineas: true, recibidoPor: true }, orderBy: { creadoEn: "desc" } },
      factura: { include: { notasCredito: { select: { id: true, correlativo: true } } } },
      solicitudes: { select: { id: true } },
    },
  });
  if (!oc) notFound();
  if (!esRolGlobal(session.rol) && oc.localDestinoId !== session.localId) notFound();

  const folio = `OC-${String(oc.correlativo).padStart(6, "0")}`;
  const neto = oc.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0);
  const badge = estadoBadge[oc.estado];
  const pendientes = oc.lineas
    .filter((l) => l.cantidad > l.cantidadRecibida)
    .map((l) => ({
      lineaId: l.id,
      nombre: l.producto.nombre,
      sku: l.producto.sku,
      pendiente: l.cantidad - l.cantidadRecibida,
    }));
  const sinRecepciones = oc.lineas.every((l) => l.cantidadRecibida === 0);
  const puedeRecepcionar =
    (oc.estado === "ENVIADA" || oc.estado === "RECIBIDA_PARCIAL") && pendientes.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <a href="/dashboard/compras" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
            ← Volver a compras
          </a>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="font-mono text-2xl font-black text-navy-950">{folio}</h1>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="mt-1 text-slate-500">
            {oc.proveedor.nombreFantasia ?? oc.proveedor.razonSocial} → {oc.localDestino.nombre} ·
            creada por {oc.creadoPor.nombre} el {fmt.format(oc.creadoEn)}
            {oc.fechaRequerida && (
              <>
                {" · "}📦 requerida{" "}
                <b className="text-navy-950">
                  {new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "UTC" }).format(
                    oc.fechaRequerida,
                  )}
                </b>
              </>
            )}
            {oc.fechaEntrega && (
              <>
                {" · "}🚚 entrega proveedor{" "}
                <b className="text-navy-950">
                  {new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "UTC" }).format(
                    oc.fechaEntrega,
                  )}
                </b>
              </>
            )}
          </p>
          {oc.nota && <p className="text-sm text-slate-400">Nota: {oc.nota}</p>}
        </div>
        {sinRecepciones && oc.estado !== "ANULADA" && (
          <form action={anularOC}>
            <input type="hidden" name="id" value={oc.id} />
            <button
              type="submit"
              className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600"
            >
              Anular OC
            </button>
          </form>
        )}
      </div>

      {/* Mapa de relaciones (estilo SAP B1) */}
      <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Flujo del documento
        </span>
        <span className="mx-1 text-slate-300">|</span>
        <FlowChip
          done={oc.solicitudes.length > 0}
          label={
            oc.solicitudes.length > 0
              ? `Solicitud (${oc.solicitudes.length})`
              : "Sin solicitud base"
          }
          href={oc.solicitudes.length > 0 ? "/dashboard/solicitudes?tab=compra" : undefined}
        />
        <Arrow />
        <FlowChip done label={folio} current />
        <Arrow />
        <FlowChip
          done={oc.entradas.length > 0}
          label={oc.entradas.length > 0 ? `Entrada (${oc.entradas.length})` : "Entrada pendiente"}
          href={oc.entradas.length > 0 ? "/dashboard/compras/entradas" : undefined}
        />
        <Arrow />
        <FlowChip
          done={!!oc.factura}
          label={
            oc.factura ? `FC-${String(oc.factura.correlativo).padStart(6, "0")}` : "Sin factura"
          }
          href={oc.factura ? `/dashboard/compras/facturas/${oc.factura.id}` : undefined}
        />
        {oc.factura && oc.factura.notasCredito.length > 0 && (
          <>
            <Arrow />
            <FlowChip
              done
              label={`NC (${oc.factura.notasCredito.length})`}
              href="/dashboard/compras/notas-credito"
            />
          </>
        )}
      </section>

      {/* Líneas */}
      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Producto</th>
              <th className="px-5 py-3 text-right">Pedido</th>
              <th className="px-5 py-3 text-right">Recibido</th>
              <th className="px-5 py-3 text-right">Pendiente</th>
              <th className="px-5 py-3 text-right">Costo unit.</th>
              <th className="px-5 py-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {oc.lineas.map((l) => (
              <tr key={l.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3">
                  <p className="font-semibold text-navy-950">{l.producto.nombre}</p>
                  <p className="font-mono text-xs text-slate-400">{l.producto.sku}</p>
                </td>
                <td className="px-5 py-3 text-right text-slate-600">{l.cantidad}</td>
                <td className="px-5 py-3 text-right font-bold text-[#4d7c0f]">{l.cantidadRecibida}</td>
                <td className="px-5 py-3 text-right font-bold text-navy-950">
                  {l.cantidad - l.cantidadRecibida}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                  {formatCLP(l.costoUnitario)}
                </td>
                <td className="px-5 py-3 text-right font-bold tabular-nums text-navy-950">
                  {formatCLP(l.cantidad * l.costoUnitario)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200">
              <td colSpan={5} className="px-5 py-3 text-right font-semibold text-slate-600">
                Neto total
              </td>
              <td className="px-5 py-3 text-right text-lg font-black tabular-nums text-navy-950">
                {formatCLP(neto)}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      {/* Recepción */}
      {puedeRecepcionar && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-1 text-lg font-bold text-navy-950">Recepcionar mercadería</h2>
          <p className="mb-3 text-sm text-slate-500">
            Ajusta cantidades si la entrega es parcial. Al confirmar sube el stock en{" "}
            {oc.localDestino.nombre} y se recalcula el costo promedio ponderado.
          </p>
          <RecepcionForm ocId={oc.id} lineas={pendientes} />
        </section>
      )}

      {/* Facturación */}
      {oc.factura ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-2 text-lg font-bold text-navy-950">Factura registrada</h2>
          <p className="text-sm text-slate-600">
            <a
              href={`/dashboard/compras/facturas/${oc.factura.id}`}
              className="font-mono font-bold text-electric-600 hover:underline"
            >
              FC-{String(oc.factura.correlativo).padStart(6, "0")}
            </a>{" "}
            · N° proveedor {oc.factura.numero} · Total {formatCLP(oc.factura.total)}
          </p>
        </section>
      ) : (
        oc.estado !== "ANULADA" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="mb-1 text-lg font-bold text-navy-950">Registrar factura de compra</h2>
            <p className="mb-3 text-sm text-slate-500">
              Factura por el total de la OC. IVA 19% · vencimiento según condición de pago del proveedor.
            </p>
            <FacturaForm ocId={oc.id} neto={neto} hayPendientes={pendientes.length > 0} />
          </section>
        )
      )}

      {/* Entradas registradas */}
      {oc.entradas.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-navy-950">Entradas / Guías</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {oc.entradas.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="font-mono font-bold text-navy-950">
                  EC-{String(e.correlativo).padStart(6, "0")}
                </span>
                <span className="text-slate-600">
                  {e.numeroGuia ? `Guía ${e.numeroGuia} · ` : ""}
                  {e.lineas.reduce((n, l) => n + l.cantidad, 0)} un. · {e.recibidoPor.nombre}
                </span>
                <span className="text-slate-400">{fmt.format(e.creadoEn)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
