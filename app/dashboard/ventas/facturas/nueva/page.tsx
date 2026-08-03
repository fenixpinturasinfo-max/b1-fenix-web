import Link from "next/link";
import { requireSeccion } from "@/lib/auth/guards";
import { esRolGlobal } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos } from "@/lib/cache";
import {
  FacturaVentaForm,
  type PedidoDisponible,
} from "@/features/sales/components/FacturaVentaForm";

export default async function NuevaFacturaVentaPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const session = await requireSeccion("ventas.facturas");
  const { pedido: pedidoParam } = await searchParams;
  const esGlobal = esRolGlobal(session.rol);
  const alcance = esGlobal ? {} : { localId: session.localId! };

  const [clientes, locales, productos, stockRows, pedidosSinFacturar] = await Promise.all([
    prisma.socioNegocio.findMany({
      where: { tipo: "CLIENTE", activo: true },
      orderBy: { razonSocial: "asc" },
      select: {
        id: true,
        rut: true,
        razonSocial: true,
        nombreFantasia: true,
        condicionPago: true,
      },
    }),
    getLocalesActivos(),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.stockLocal.findMany({
      where: { local: { activo: true } },
      select: { productoId: true, localId: true, cantidad: true },
    }),
    // Solo los que se pueden facturar: sin factura y no anulados
    prisma.pedidoCliente.findMany({
      where: { ...alcance, factura: null, estado: { notIn: ["ANULADO", "FACTURADO"] } },
      include: { lineas: { select: { productoId: true, cantidad: true } } },
      orderBy: { creadoEn: "desc" },
      take: 100,
    }),
  ]);

  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stockRows) (stocks[s.productoId] ??= {})[s.localId] = s.cantidad;

  const pedidos: PedidoDisponible[] = pedidosSinFacturar.map((p) => ({
    id: p.id,
    folio: `PED-${String(p.correlativo).padStart(6, "0")}`,
    clienteId: p.clienteId,
    nombreCliente: p.nombreCliente,
    total: p.total,
    lineas: p.lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
  }));

  const pedidoInicial = pedidoParam ? pedidos.find((p) => p.id === pedidoParam) : undefined;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/ventas/facturas"
          className="text-sm font-semibold text-slate-500 hover:text-electric-600"
        >
          ← Volver a facturas
        </Link>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Nueva factura de venta</h1>
        <p className="mt-1 text-slate-500">
          Al emitir se descuenta el stock del local, igual que una boleta del POS. El precio
          de lista se toma como neto y el IVA se suma encima.
        </p>
      </div>

      {clientes.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          ⚠️ No hay clientes registrados. Una factura necesita RUT y razón social: crea la
          ficha en{" "}
          <Link href="/dashboard/socios" className="font-bold text-electric-600 hover:underline">
            Socios
          </Link>{" "}
          primero.
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <FacturaVentaForm
            clientes={clientes.map((c) => ({
              id: c.id,
              nombre: c.nombreFantasia ?? c.razonSocial,
              rut: c.rut,
              condicionPago: c.condicionPago,
            }))}
            locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
            productos={productos.map((p) => ({
              id: p.id,
              sku: p.sku,
              nombre: p.nombre,
              marca: p.marca,
              codigoBarra: p.codigoBarra,
              precioVenta: p.precioVenta,
            }))}
            localFijo={esGlobal ? null : session.localId}
            stocks={stocks}
            pedidos={pedidos}
            pedidoInicial={pedidoInicial}
          />
        </div>
      )}
    </div>
  );
}
