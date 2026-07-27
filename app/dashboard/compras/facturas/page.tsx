import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { formatCLP } from "@/lib/format";
import { inicioDia } from "@/lib/fechas";
import {
  FacturasLista,
  type FacturaRow,
  type FiltroFactura,
} from "@/features/purchases/components/FacturasLista";

const fmt = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "America/Santiago" });

const FILTROS: FiltroFactura[] = ["TODAS", "POR_PAGAR", "VENCIDA", "PAGADA"];

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await requireSeccion("compras.facturas");
  const { estado } = await searchParams;
  const filtroInicial = FILTROS.includes(estado as FiltroFactura)
    ? (estado as FiltroFactura)
    : "TODAS";

  const facturas = await prisma.facturaCompra.findMany({
    where:
      esRolGlobal(session.rol)
        ? {}
        : { ordenCompra: { localDestinoId: session.localId! } },
    include: {
      proveedor: true,
      ordenCompra: { include: { localDestino: true } },
      notasCredito: true,
      lineas: { include: { producto: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  // OC con mercadería recibida (total o parcial) que aún no tienen factura
  const porFacturar = await prisma.ordenCompra.findMany({
    where: {
      factura: null,
      estado: { in: ["RECIBIDA", "RECIBIDA_PARCIAL"] },
      ...(esRolGlobal(session.rol) ? {} : { localDestinoId: session.localId! }),
    },
    include: { proveedor: true, localDestino: true, lineas: true },
    orderBy: { creadoEn: "asc" },
  });

  // Vencida = su fecha ya pasó por completo. Una que vence hoy todavía es "por pagar".
  // Mismo criterio que usa el dashboard, para que los contadores cuadren.
  const ahora = inicioDia();
  const abiertas = facturas.filter((f) => f.estado === "ABIERTA");
  const porPagar = abiertas.reduce(
    (n, f) => n + f.total - f.notasCredito.reduce((m, nc) => m + nc.total, 0),
    0,
  );
  const vencidas = abiertas.filter(
    (f) => f.fechaVencimiento && f.fechaVencimiento < ahora,
  ).length;

  const puedeMarcar = esRolGlobal(session.rol) || session.rol === "JEFE_LOCAL";
  const rows: FacturaRow[] = facturas.map((f) => {
    const vencida = f.estado === "ABIERTA" && f.fechaVencimiento !== null && f.fechaVencimiento < ahora;
    return {
      id: f.id,
      folio: `FC-${String(f.correlativo).padStart(6, "0")}`,
      numero: f.numero,
      proveedor: f.proveedor.nombreFantasia ?? f.proveedor.razonSocial,
      oc: `OC-${String(f.ordenCompra.correlativo).padStart(6, "0")}`,
      ocId: f.ordenCompraId,
      neto: f.neto,
      iva: f.iva,
      total: f.total,
      totalNC: f.notasCredito.reduce((n, nc) => n + nc.total, 0),
      emision: fmt.format(f.fechaEmision),
      vence: f.fechaVencimiento ? fmt.format(f.fechaVencimiento) : null,
      estado: vencida
        ? "VENCIDA"
        : f.estado === "ABIERTA"
          ? "POR_PAGAR"
          : f.estado === "PAGADA"
            ? "PAGADA"
            : "ANULADA",
      puedeMarcarPagada: f.estado === "ABIERTA" && puedeMarcar,
      lineas: f.lineas.map((l) => ({
        id: l.id,
        producto: l.producto.nombre,
        sku: l.producto.sku,
        cantidad: l.cantidad,
        costo: l.costoUnitario,
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Facturas de Compra</h1>
        <p className="mt-1 text-slate-500">
          Por pagar: <b className="text-navy-950">{formatCLP(porPagar)}</b>
          {vencidas > 0 && (
            <span className="ml-2 font-bold text-fenix-600">
              · {vencidas} vencida{vencidas === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </div>

      {/* Bandeja: OC recibidas esperando factura */}
      {porFacturar.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-navy-950">
            Por facturar{" "}
            <span className="rounded-full bg-cloud px-2 py-0.5 text-sm text-slate-500">
              {porFacturar.length}
            </span>
          </h2>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {porFacturar.map((oc) => {
              const neto = oc.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0);
              const pedido = oc.lineas.reduce((n, l) => n + l.cantidad, 0);
              const recibido = oc.lineas.reduce((n, l) => n + l.cantidadRecibida, 0);
              return (
                <div
                  key={oc.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
                >
                  <span className="font-mono text-sm font-bold text-navy-950">
                    OC-{String(oc.correlativo).padStart(6, "0")}
                  </span>
                  <span className="min-w-32 flex-1 truncate text-sm font-semibold text-navy-950">
                    🚚 {oc.proveedor.nombreFantasia ?? oc.proveedor.razonSocial}
                  </span>
                  <span className="text-sm text-slate-500">
                    {oc.localDestino.comuna} · recibido {recibido}/{pedido} ·{" "}
                    <b className="tabular-nums text-navy-950">{formatCLP(neto)}</b>{" "}
                    <span className="text-slate-400">neto</span>
                  </span>
                  <a
                    href={`/dashboard/compras/${oc.id}`}
                    className="ml-auto h-10 rounded-xl bg-electric-600 px-4 text-sm font-bold leading-10 text-white transition hover:opacity-90"
                  >
                    Registrar factura →
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <FacturasLista rows={rows} filtroInicial={filtroInicial} />
    </div>
  );
}
