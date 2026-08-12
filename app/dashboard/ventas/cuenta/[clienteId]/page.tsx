import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { esRolGlobal, puedeEscribir } from "@/lib/auth/permissions";
import { SECCION_DESCUENTO } from "@/lib/descuento";
import { topeDe } from "@/features/descuentos/topes";
import { formatCLP } from "@/lib/format";
import { cuentaDeCliente } from "@/features/cuenta/queries";
import {
  CuentaCliente,
  type RetiroAbiertoUi,
} from "@/features/cuenta/components/CuentaCliente";

const fmtFecha = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  timeZone: "America/Santiago",
});

const folioRC = (n: number) => `RC-${String(n).padStart(6, "0")}`;

export default async function CuentaClientePage({
  params,
}: {
  params: Promise<{ clienteId: string }>;
}) {
  const { clienteId } = await params;
  const { session, escribe } = await requireSeccionConNivel("ventas.cuenta");
  const esGlobal = esRolGlobal(session.rol);
  const alcance = { esGlobal, localId: esGlobal ? null : session.localId };

  const datos = await cuentaDeCliente(clienteId, alcance);
  if (!datos) notFound();
  const { cliente, abiertos, recientes } = datos;

  const puedeDescontar = await puedeEscribir(session.rol, SECCION_DESCUENTO);
  const tope = puedeDescontar ? null : await topeDe(session.rol);

  const retiros: RetiroAbiertoUi[] = abiertos.map((r) => ({
    id: r.id,
    folio: folioRC(r.correlativo),
    localId: r.local.id,
    localNombre: r.local.nombre,
    total: r.total,
    nota: r.nota,
    creadoPor: r.creadoPor.nombre,
    fecha: fmtFecha.format(r.creadoEn),
    lineas: r.lineas.map((l) => ({
      id: l.id,
      nombre: l.producto.nombre,
      sku: l.producto.sku,
      cantidad: l.cantidad,
      precioUnitario: l.precioUnitario,
      subtotal: l.subtotal,
    })),
  }));

  const nombre = cliente.nombreFantasia ?? cliente.razonSocial;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/ventas/cuenta"
          className="text-sm font-semibold text-slate-500 hover:text-electric-600"
        >
          ← Volver a cuenta abierta
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-black text-navy-950">{nombre}</h1>
          <span className="font-mono text-sm text-slate-500">{cliente.rut}</span>
          {cliente.descuentoPorcentaje > 0 && (
            <span className="rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-xs font-bold text-[#b45309]">
              {cliente.descuentoPorcentaje}% pactado
            </span>
          )}
          {!cliente.cuentaAbierta && (
            <span className="rounded-full bg-fenix-600/10 px-2.5 py-0.5 text-xs font-bold text-fenix-600">
              Cuenta cerrada en la ficha: puede cobrar lo pendiente, pero no retirar más
            </span>
          )}
        </div>
      </div>

      <CuentaCliente
        cliente={{
          id: cliente.id,
          nombre,
          descuentoPorcentaje: cliente.descuentoPorcentaje,
          condicionPago: cliente.condicionPago,
        }}
        retiros={retiros}
        escribe={escribe}
        puedeDescontar={puedeDescontar}
        tope={tope}
      />

      {/* Historial: lo ya resuelto, para responder "¿y lo de la semana pasada?" */}
      {recientes.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-navy-950">Últimos retiros resueltos</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {recientes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="font-mono text-xs text-slate-500">
                  {folioRC(r.correlativo)}
                </span>
                <span className="text-xs text-slate-400">{fmtFecha.format(r.creadoEn)}</span>
                <span className="text-xs text-slate-400">{r.local.nombre}</span>
                <span className="min-w-0 flex-1" />
                {r.estado === "COBRADO" ? (
                  r.facturaVenta ? (
                    <Link
                      href={`/dashboard/ventas/facturas/${r.facturaVenta.id}`}
                      className="rounded-full bg-lime-400/15 px-2.5 py-0.5 text-xs font-bold text-[#4d7c0f] hover:underline"
                    >
                      FV-{String(r.facturaVenta.correlativo).padStart(6, "0")}
                    </Link>
                  ) : (
                    <span className="rounded-full bg-lime-400/15 px-2.5 py-0.5 text-xs font-bold text-[#4d7c0f]">
                      Boleta {r.venta ? `${r.venta.local.codigo}-${String(r.venta.correlativo).padStart(6, "0")}` : ""}
                    </span>
                  )
                ) : (
                  <span
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-400"
                    title={r.motivoAnulacion ?? undefined}
                  >
                    Anulado{r.anuladoPor ? ` · ${r.anuladoPor.nombre}` : ""}
                  </span>
                )}
                <span className="font-bold tabular-nums text-navy-950">
                  {formatCLP(r.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
