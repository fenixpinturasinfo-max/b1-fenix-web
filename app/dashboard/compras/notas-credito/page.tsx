import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NCLista, type NCRow } from "@/features/purchases/components/NCLista";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function NotasCreditoPage() {
  const session = await requireSeccion("compras.notas-credito");

  const notas = await prisma.notaCredito.findMany({
    where:
      esRolGlobal(session.rol)
        ? {}
        : { factura: { ordenCompra: { localDestinoId: session.localId! } } },
    include: {
      creadoPor: true,
      lineas: { include: { producto: true } },
      factura: {
        select: {
          id: true,
          correlativo: true,
          numero: true,
          proveedor: { select: { razonSocial: true, nombreFantasia: true } },
        },
      },
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  const rows: NCRow[] = notas.map((n) => ({
    id: n.id,
    folio: `NC-${String(n.correlativo).padStart(6, "0")}`,
    fecha: fmt.format(n.creadoEn),
    factura: {
      id: n.factura.id,
      folio: `FC-${String(n.factura.correlativo).padStart(6, "0")}`,
      numero: n.factura.numero,
    },
    proveedor: n.factura.proveedor.nombreFantasia ?? n.factura.proveedor.razonSocial,
    motivo: n.motivo,
    unidades: n.lineas.reduce((t, l) => t + l.cantidad, 0),
    total: n.total,
    creo: n.creadoPor.nombre,
    lineas: n.lineas.map((l) => ({
      id: l.id,
      producto: l.producto.nombre,
      sku: l.producto.sku,
      cantidad: l.cantidad,
      costo: l.costoUnitario,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Notas de Crédito</h1>
        <p className="mt-1 text-slate-500">
          Devoluciones a proveedor: rebajan stock y el total a pagar de la factura base.
        </p>
      </div>

      <NCLista rows={rows} />
    </div>
  );
}
