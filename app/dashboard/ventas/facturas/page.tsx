import Link from "next/link";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { esRolGlobal } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import {
  FacturasVentaLista,
  type FacturaVentaRow,
} from "@/features/sales/components/FacturasVentaLista";
import { diasDeAtraso, type EstadoFacturaVenta } from "@/features/sales/factura";
import { fmtFechaSola, inicioDia } from "@/lib/fechas";

export default async function FacturasVentaPage() {
  const { session, escribe } = await requireSeccionConNivel("ventas.facturas");
  const esGlobal = esRolGlobal(session.rol);

  const facturas = await prisma.facturaVenta.findMany({
    where: esGlobal ? {} : { localId: session.localId! },
    include: {
      cliente: { select: { razonSocial: true, nombreFantasia: true } },
      local: { select: { nombre: true } },
      pedido: { select: { correlativo: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  // "Hoy" chileno: con la medianoche UTC una factura que vence hoy aparecería vencida
  // desde las 20:00 del día anterior.
  const hoy = inicioDia();

  const rows: FacturaVentaRow[] = facturas.map((f) => ({
    id: f.id,
    folio: `FV-${String(f.correlativo).padStart(6, "0")}`,
    folioSii: f.folioSii,
    cliente: f.cliente.nombreFantasia ?? f.cliente.razonSocial,
    local: f.local.nombre,
    pedidoFolio: f.pedido ? `PED-${String(f.pedido.correlativo).padStart(6, "0")}` : null,
    fechaEmision: fmtFechaSola(f.fechaEmision),
    vencimiento: f.fechaVencimiento ? fmtFechaSola(f.fechaVencimiento) : null,
    atraso: f.fechaVencimiento ? diasDeAtraso(f.fechaVencimiento, hoy) : null,
    condicionPago: f.condicionPago,
    total: f.total,
    estado: f.estado as EstadoFacturaVenta,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Facturas de venta</h1>
          <p className="mt-1 text-slate-500">
            Para clientes empresa que no pasan por caja. Emitir descuenta stock; el cobro se
            sigue desde acá.
          </p>
        </div>
        {escribe && (
          <Link
            href="/dashboard/ventas/facturas/nueva"
            className="bg-flame h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
          >
            ＋ Nueva factura
          </Link>
        )}
      </div>

      <FacturasVentaLista rows={rows} mostrarLocal={esGlobal} />
    </div>
  );
}
