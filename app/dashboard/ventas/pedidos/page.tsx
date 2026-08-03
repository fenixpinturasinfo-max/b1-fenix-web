import { esRolGlobal, puedeEscribir } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos } from "@/lib/cache";
import { PedidoForm } from "@/features/sales/components/PedidoForm";
import {
  PedidosLista,
  type FiltroPedido,
  type PedidoRow,
} from "@/features/sales/components/PedidosLista";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

const FILTROS: FiltroPedido[] = [
  "TODOS",
  "PENDIENTE",
  "PREPARADO",
  "ENTREGADO",
  "FACTURADO",
  "ANULADO",
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await requireSeccion("ventas.pedidos");
  const { estado } = await searchParams;
  const filtroInicial = FILTROS.includes(estado as FiltroPedido)
    ? (estado as FiltroPedido)
    : "TODOS";

  const [pedidos, clientes, productos, locales, puedeFacturar] = await Promise.all([
    prisma.pedidoCliente.findMany({
      where: esRolGlobal(session.rol) ? {} : { localId: session.localId! },
      include: {
        local: true,
        factura: { select: { id: true, correlativo: true } },
        lineas: { include: { producto: true } },
      },
      orderBy: { creadoEn: "desc" },
      take: 300,
    }),
    prisma.socioNegocio.findMany({
      where: { activo: true, tipo: "CLIENTE" },
      orderBy: { razonSocial: "asc" },
    }),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    getLocalesActivos(),
    puedeEscribir(session.rol, "ventas.facturas"),
  ]);

  const stockRows = await prisma.stockLocal.findMany({
    where: { local: { activo: true } },
    select: { productoId: true, localId: true, cantidad: true },
  });
  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stockRows) (stocks[s.productoId] ??= {})[s.localId] = s.cantidad;

  const rows: PedidoRow[] = pedidos.map((p) => ({
    id: p.id,
    folio: `PED-${String(p.correlativo).padStart(6, "0")}`,
    fecha: fmt.format(p.creadoEn),
    cliente: p.nombreCliente,
    telefono: p.telefono,
    local: p.local.comuna,
    nota: p.nota,
    total: p.total,
    estado: p.estado,
    puedeGestionar: esRolGlobal(session.rol) || p.localId === session.localId,
    puedeFacturar:
      puedeFacturar &&
      p.factura === null &&
      (esRolGlobal(session.rol) || p.localId === session.localId),
    facturaFolio: p.factura ? `FV-${String(p.factura.correlativo).padStart(6, "0")}` : null,
    facturaId: p.factura?.id ?? null,
    lineas: p.lineas.map((l) => ({
      id: l.id,
      producto: l.producto.nombre,
      sku: l.producto.sku,
      cantidad: l.cantidad,
      precio: l.precioUnitario,
    })),
  }));

  const pendientes = rows.filter((r) => r.estado === "PENDIENTE" || r.estado === "PREPARADO");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Pedidos de clientes</h1>
          <p className="mt-1 text-slate-500">
            Reservas para retiro en local ·{" "}
            {pendientes.length > 0
              ? `${pendientes.length} por entregar`
              : "nada pendiente de entrega"}
          </p>
        </div>
        <PedidoForm
          clientes={clientes.map((c) => ({
            id: c.id,
            nombre: c.nombreFantasia ?? c.razonSocial,
            telefono: c.telefono,
          }))}
          productos={productos.map((p) => ({
            id: p.id,
            sku: p.sku,
            nombre: p.nombre,
            marca: p.marca,
            codigoBarra: p.codigoBarra,
            precioVenta: p.precioVenta,
          }))}
          locales={locales}
          localFijo={esRolGlobal(session.rol) ? null : session.localId}
          stocks={stocks}
        />
      </div>

      <PedidosLista rows={rows} filtroInicial={filtroInicial} />
    </div>
  );
}
