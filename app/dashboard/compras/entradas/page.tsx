import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { EntradasLista, type EntradaRow } from "@/features/purchases/components/EntradasLista";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function EntradasPage() {
  const session = await requireSeccion("compras.entradas");

  // OC enviadas o con recepción parcial: mercadería pendiente de ingresar
  const porRecepcionar = await prisma.ordenCompra.findMany({
    where: {
      estado: { in: ["ENVIADA", "RECIBIDA_PARCIAL"] },
      ...(esRolGlobal(session.rol) ? {} : { localDestinoId: session.localId! }),
    },
    include: { proveedor: true, localDestino: true, lineas: true },
    orderBy: { creadoEn: "asc" },
  });

  const entradas = await prisma.entradaCompra.findMany({
    where: esRolGlobal(session.rol) ? {} : { localId: session.localId! },
    include: {
      proveedor: true,
      local: true,
      recibidoPor: true,
      ordenCompra: { select: { id: true, correlativo: true } },
      lineas: { include: { producto: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  const rows: EntradaRow[] = entradas.map((e) => ({
    id: e.id,
    folio: `EC-${String(e.correlativo).padStart(6, "0")}`,
    fecha: fmt.format(e.creadoEn),
    oc: e.ordenCompra
      ? { id: e.ordenCompra.id, folio: `OC-${String(e.ordenCompra.correlativo).padStart(6, "0")}` }
      : null,
    proveedor: e.proveedor.nombreFantasia ?? e.proveedor.razonSocial,
    local: e.local.nombre,
    guia: e.numeroGuia,
    unidades: e.lineas.reduce((n, l) => n + l.cantidad, 0),
    recibio: e.recibidoPor.nombre,
    lineas: e.lineas.map((l) => ({
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
        <h1 className="text-2xl font-black text-navy-950">Entradas de Mercadería</h1>
        <p className="mt-1 text-slate-500">
          Recepciones de compras (guías). Cada entrada sube stock y recalcula el costo promedio.
        </p>
      </div>

      {/* Bandeja: OC esperando recepción */}
      {porRecepcionar.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-navy-950">
            Por recepcionar{" "}
            <span className="rounded-full bg-cloud px-2 py-0.5 text-sm text-slate-500">
              {porRecepcionar.length}
            </span>
          </h2>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {porRecepcionar.map((oc) => {
              const neto = oc.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0);
              const pedido = oc.lineas.reduce((n, l) => n + l.cantidad, 0);
              const recibido = oc.lineas.reduce((n, l) => n + l.cantidadRecibida, 0);
              const parcial = recibido > 0;
              return (
                <div key={oc.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span className="font-mono text-sm font-bold text-navy-950">
                    OC-{String(oc.correlativo).padStart(6, "0")}
                  </span>
                  <span className="min-w-32 flex-1 truncate text-sm font-semibold text-navy-950">
                    🚚 {oc.proveedor.nombreFantasia ?? oc.proveedor.razonSocial}
                  </span>
                  <span className="text-sm text-slate-500">
                    {oc.localDestino.comuna} · pendiente{" "}
                    <b className="text-navy-950">{pedido - recibido}</b> de {pedido} un. ·{" "}
                    <b className="tabular-nums text-navy-950">{formatCLP(neto)}</b>{" "}
                    <span className="text-slate-400">neto</span>
                  </span>
                  {parcial && (
                    <span className="rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-xs font-bold text-[#b45309]">
                      Parcial
                    </span>
                  )}
                  <a
                    href={`/dashboard/compras/${oc.id}`}
                    className="ml-auto h-10 rounded-xl bg-electric-600 px-4 text-sm font-bold leading-10 text-white transition hover:opacity-90"
                  >
                    Recepcionar →
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <EntradasLista rows={rows} />
    </div>
  );
}
