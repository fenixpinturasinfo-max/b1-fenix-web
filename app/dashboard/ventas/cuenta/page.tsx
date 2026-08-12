import Link from "next/link";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { esRolGlobal } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos } from "@/lib/cache";
import { formatCLP } from "@/lib/format";
import { resumenCuentas } from "@/features/cuenta/queries";
import { RetiroNuevo } from "@/features/cuenta/components/RetiroNuevo";

const fmtFecha = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeZone: "America/Santiago",
});

/**
 * Cuenta abierta: la plata que está en la calle.
 *
 * Clientes especiales que retiran durante el período y pagan al cierre. Cada tarjeta es
 * un cliente con retiros sin cobrar; adentro se consolidan en boleta o factura.
 */
export default async function CuentaAbiertaPage() {
  const { session, escribe } = await requireSeccionConNivel("ventas.cuenta");
  const esGlobal = esRolGlobal(session.rol);
  const alcance = { esGlobal, localId: esGlobal ? null : session.localId };

  const cuentas = await resumenCuentas(alcance);

  // Datos del modal de nuevo retiro (solo si puede operar)
  const [clientes, locales, productos, stockRows] = escribe
    ? await Promise.all([
        prisma.socioNegocio.findMany({
          where: { tipo: "CLIENTE", activo: true, cuentaAbierta: true },
          orderBy: { razonSocial: "asc" },
          select: {
            id: true,
            rut: true,
            razonSocial: true,
            nombreFantasia: true,
            descuentoPorcentaje: true,
          },
        }),
        getLocalesActivos(),
        prisma.producto.findMany({
          where: { activo: true },
          orderBy: { nombre: "asc" },
          select: {
            id: true,
            sku: true,
            nombre: true,
            marca: true,
            codigoBarra: true,
            precioVenta: true,
          },
        }),
        prisma.stockLocal.findMany({
          where: { local: { activo: true } },
          select: { productoId: true, localId: true, cantidad: true },
        }),
      ])
    : [[], [], [], []];

  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stockRows) (stocks[s.productoId] ??= {})[s.localId] = s.cantidad;

  const totalCalle = cuentas.reduce((n, c) => n + c.total, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Cuenta abierta</h1>
          <p className="mt-1 text-slate-500">
            Retiros a cuenta de clientes especiales. El stock sale al retirar; se cobra
            consolidado cuando cierre el período (semana, quincena o mes).
          </p>
        </div>
        {escribe && (
          <RetiroNuevo
            clientes={clientes.map((c) => ({
              id: c.id,
              nombre: c.nombreFantasia ?? c.razonSocial,
              rut: c.rut,
              descuentoPorcentaje: c.descuentoPorcentaje,
            }))}
            productos={productos}
            locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
            localFijo={esGlobal ? null : session.localId}
            stocks={stocks}
          />
        )}
      </div>

      {escribe && clientes.length === 0 && (
        <p className="rounded-2xl border border-[#f59e0b]/40 bg-[#f59e0b]/5 px-5 py-3.5 text-sm text-[#b45309]">
          Ningún cliente tiene la cuenta abierta activada. Se activa en{" "}
          <Link href="/dashboard/socios?tipo=CLIENTE" className="font-bold underline">
            Socios › Clientes
          </Link>
          , en la ficha de cada cliente: es crédito, alguien tiene que otorgarlo a propósito.
        </p>
      )}

      {cuentas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-3xl">🧾</p>
          <p className="mt-2 font-bold text-navy-950">No hay retiros sin cobrar</p>
          <p className="mt-1 text-sm text-slate-400">
            Cuando un cliente con cuenta abierta retire mercadería, aparecerá acá con su
            acumulado listo para consolidar.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {cuentas.length} cliente{cuentas.length === 1 ? "" : "s"} con consumo pendiente ·
            total en la calle{" "}
            <b className="tabular-nums text-navy-950">{formatCLP(totalCalle)}</b>
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cuentas.map((c) => (
              <Link
                key={c.clienteId}
                href={`/dashboard/ventas/cuenta/${c.clienteId}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-electric-500 hover:shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-navy-950">{c.nombre}</p>
                    <p className="font-mono text-xs text-slate-500">{c.rut}</p>
                  </div>
                  {c.descuentoPorcentaje > 0 && (
                    <span className="shrink-0 rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-xs font-bold text-[#b45309]">
                      {c.descuentoPorcentaje}%
                    </span>
                  )}
                </div>
                <p className="mt-3 text-2xl font-black tabular-nums text-navy-950">
                  {formatCLP(c.total)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {c.nRetiros} retiro{c.nRetiros === 1 ? "" : "s"} desde el{" "}
                  {fmtFecha.format(c.desde)}
                  {c.locales.length > 1 ? ` · ${c.locales.join(" y ")}` : ""}
                </p>
                <p className="mt-2 text-xs font-bold text-electric-600 opacity-0 transition group-hover:opacity-100">
                  Ver cuenta y cobrar →
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
