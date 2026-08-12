import { requireSeccionConNivel } from "@/lib/auth/guards";
import { esRolGlobal } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import {
  PedidosOnlineLista,
  type PedidoOnlineUi,
} from "@/features/checkout/components/PedidosOnlineLista";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function PedidosWebPage() {
  const { session, escribe } = await requireSeccionConNivel("ventas.online");
  const esGlobal = esRolGlobal(session.rol);

  const pedidos = await prisma.pedidoOnline.findMany({
    where: {
      // Los PENDIENTE_PAGO no se muestran: son intenciones, no pedidos. Se anulan solos.
      estado: { not: "PENDIENTE_PAGO" },
      ...(esGlobal ? {} : { localId: session.localId! }),
    },
    include: {
      local: { select: { nombre: true } },
      lineas: { include: { producto: { select: { nombre: true, sku: true } } } },
    },
    orderBy: { creadoEn: "desc" },
    take: 200,
  });

  const porGestionar = pedidos.filter((p) => p.estado === "PAGADO" || p.estado === "DESPACHADO");
  const totalPorGestionar = porGestionar.reduce((n, p) => n + p.total, 0);

  const rows: PedidoOnlineUi[] = pedidos.map((p) => ({
    id: p.id,
    folio: `WEB-${String(p.correlativo).padStart(6, "0")}`,
    estado: p.estado,
    fecha: fmt.format(p.creadoEn),
    nombre: p.nombre,
    email: p.email,
    telefono: p.telefono,
    entrega:
      p.tipoEntrega === "RETIRO"
        ? `Retiro en ${p.local.nombre}`
        : p.tipoEntrega === "DESPACHO_ANILLO"
          ? `Despacho: ${p.direccion}, ${p.comuna}`
          : `${p.courier} (por pagar): ${p.direccion}, ${p.comuna}`,
    localNombre: p.local.nombre,
    total: p.total,
    montoEnvio: p.montoEnvio,
    envioPorPagar: p.tipoEntrega === "DESPACHO_COURIER",
    tarjeta: p.tbkTarjeta,
    autorizacion: p.tbkAutorizacion,
    nota: p.nota,
    lineas: p.lineas.map((l) => ({
      id: l.id,
      nombre: l.producto.nombre,
      sku: l.producto.sku,
      cantidad: l.cantidad,
      subtotal: l.subtotal,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Pedidos web</h1>
        <p className="mt-1 text-slate-500">
          Compras pagadas con Webpay. El stock ya salió al confirmarse el pago: acá se
          prepara, despacha y entrega.
          {porGestionar.length > 0 && (
            <>
              {" "}
              <b className="text-navy-950">
                {porGestionar.length} por gestionar · {formatCLP(totalPorGestionar)}
              </b>
            </>
          )}
        </p>
      </div>

      <PedidosOnlineLista pedidos={rows} escribe={escribe} />
    </div>
  );
}
