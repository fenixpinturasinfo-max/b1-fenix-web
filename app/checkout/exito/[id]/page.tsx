import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";

export const metadata = { robots: { index: false } };

/**
 * Confirmación de compra. Pública sin sesión: la "llave" es el id cuid del pedido, que
 * viaja solo en el redirect del retorno de Webpay y no se puede adivinar.
 */
export default async function ExitoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pedido = await prisma.pedidoOnline.findUnique({
    where: { id },
    include: {
      lineas: { include: { producto: { select: { nombre: true } } } },
      local: { select: { nombre: true, direccion: true, comuna: true, horario: true } },
    },
  });
  if (!pedido || pedido.estado === "PENDIENTE_PAGO" || pedido.estado === "ANULADO") notFound();

  const folio = `WEB-${String(pedido.correlativo).padStart(6, "0")}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-cloud p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <p className="text-center text-5xl">✅</p>
        <h1 className="mt-3 text-center text-2xl font-black text-navy-950">¡Compra confirmada!</h1>
        <p className="mt-1 text-center font-mono text-lg font-bold text-electric-600">{folio}</p>
        <p className="mt-2 text-center text-sm text-slate-500">
          Gracias {pedido.nombre}. Te enviamos el comprobante a <b>{pedido.email}</b>.
          {pedido.tbkTarjeta ? ` Pago Webpay con tarjeta terminada en ${pedido.tbkTarjeta}.` : ""}
        </p>

        <ul className="mt-6 space-y-1.5 border-t border-dashed border-slate-200 pt-4 text-sm">
          {pedido.lineas.map((l) => (
            <li key={l.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-slate-600">
                {l.cantidad} × {l.producto.nombre}
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-navy-950">
                {formatCLP(l.subtotal)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-500">Envío</dt>
            <dd className="text-navy-950">
              {pedido.tipoEntrega === "RETIRO"
                ? "Gratis (retiro en tienda)"
                : pedido.montoEnvio > 0
                  ? formatCLP(pedido.montoEnvio)
                  : `Por pagar al recibir (${pedido.courier})`}
            </dd>
          </div>
          <div className="flex justify-between text-base">
            <dt className="font-bold text-navy-950">Total pagado</dt>
            <dd className="font-black tabular-nums text-navy-950">{formatCLP(pedido.total)}</dd>
          </div>
        </dl>

        <div className="mt-5 rounded-xl bg-cloud/70 p-4 text-sm text-slate-600">
          {pedido.tipoEntrega === "RETIRO" ? (
            <>
              🏬 <b className="text-navy-950">Retiro en {pedido.local.nombre}</b> —{" "}
              {pedido.local.direccion}, {pedido.local.comuna}
              {pedido.local.horario ? ` · ${pedido.local.horario}` : ""}. Te avisaremos por
              correo o WhatsApp cuando esté listo (mismo día hábil).
            </>
          ) : pedido.tipoEntrega === "DESPACHO_ANILLO" ? (
            <>
              🚚 <b className="text-navy-950">Despacho a domicilio</b> — {pedido.direccion},{" "}
              {pedido.comuna}. Te contactaremos para coordinar la entrega.
            </>
          ) : (
            <>
              📦 <b className="text-navy-950">Envío por {pedido.courier}</b> a {pedido.direccion},{" "}
              {pedido.comuna}. El envío se paga al recibir; te mandaremos el número de
              seguimiento.
            </>
          )}
        </div>

        <a
          href="/"
          className="bg-flame mt-6 block h-12 w-full rounded-xl text-center font-bold leading-[48px] text-white transition hover:opacity-90"
        >
          Volver a la tienda
        </a>
      </div>
    </main>
  );
}
