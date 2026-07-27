import Link from "next/link";
import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { OCLista, type FiltroOC, type OCRow } from "@/features/purchases/components/OCLista";

const fmt = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" });

const FILTROS: FiltroOC[] = ["TODAS", "ABIERTAS", "CERRADAS", "ANULADAS"];

export default async function ComprasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await requireSeccion("compras.ordenes");
  const { estado } = await searchParams;
  const filtroInicial = FILTROS.includes(estado as FiltroOC) ? (estado as FiltroOC) : "TODAS";

  const ordenes = await prisma.ordenCompra.findMany({
    where: esRolGlobal(session.rol) ? {} : { localDestinoId: session.localId! },
    include: { proveedor: true, localDestino: true, lineas: { include: { producto: true } } },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  const fmtFecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "UTC" });
  const rows: OCRow[] = ordenes.map((oc) => ({
    id: oc.id,
    folio: `OC-${String(oc.correlativo).padStart(6, "0")}`,
    fecha: fmt.format(oc.creadoEn),
    proveedor: oc.proveedor.nombreFantasia ?? oc.proveedor.razonSocial,
    local: oc.localDestino.comuna,
    neto: oc.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0),
    pedido: oc.lineas.reduce((n, l) => n + l.cantidad, 0),
    recibido: oc.lineas.reduce((n, l) => n + l.cantidadRecibida, 0),
    estado: oc.estado,
    fechaRequerida: oc.fechaRequerida ? fmtFecha.format(oc.fechaRequerida) : null,
    fechaEntrega: oc.fechaEntrega ? fmtFecha.format(oc.fechaEntrega) : null,
    nota: oc.nota,
    lineas: oc.lineas.map((l) => ({
      id: l.id,
      producto: l.producto.nombre,
      sku: l.producto.sku,
      cantidad: l.cantidad,
      recibido: l.cantidadRecibida,
      costo: l.costoUnitario,
    })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Órdenes de Compra</h1>
          <p className="mt-1 text-slate-500">
            Compras a proveedores. Al recepcionar sube el stock y se recalcula el costo promedio.
          </p>
        </div>
        <Link
          href="/dashboard/compras/nueva"
          className="bg-flame h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
        >
          ＋ Nueva OC
        </Link>
      </div>

      <OCLista rows={rows} filtroInicial={filtroInicial} />
    </div>
  );
}
