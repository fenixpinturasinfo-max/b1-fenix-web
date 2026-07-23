import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { AbrirCajaForm, CerrarCajaForm } from "@/features/pos/components/CajaForms";
import { PosVenta, type PosProducto } from "@/features/pos/components/PosVenta";
import { formatCLP } from "@/lib/format";

export default async function PosPage() {
  const session = await requireModulo("pos");

  const locales = await prisma.local.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });

  // Caja abierta del usuario
  const caja = await prisma.cajaSesion.findFirst({
    where: { usuarioId: session.sub, estado: "ABIERTA" },
    include: {
      local: true,
      ventas: { where: { estado: "COMPLETADA" }, orderBy: { creadoEn: "desc" } },
    },
  });

  if (!caja) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black text-navy-950">POS / Ventas</h1>
        <AbrirCajaForm
          locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
          localFijo={session.rol === "ADMINISTRADOR" ? null : session.localId}
        />
      </div>
    );
  }

  // Productos con stock del local de la caja
  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { stocks: { where: { localId: caja.localId } }, categoria: true },
    orderBy: { nombre: "asc" },
  });

  const posProductos: PosProducto[] = productos.map((p) => ({
    id: p.id,
    sku: p.sku,
    codigoBarra: p.codigoBarra,
    nombre: p.nombre,
    marca: p.marca,
    categoria: p.categoria.nombre,
    imagen: p.imagen,
    precioVenta: p.precioVenta,
    stock: p.stocks[0]?.cantidad ?? 0,
  }));

  const totalVentas = caja.ventas.reduce((n, v) => n + v.total, 0);
  const ventasEfectivo = caja.ventas
    .filter((v) => v.medioPago === "EFECTIVO")
    .reduce((n, v) => n + v.total, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">POS / Ventas</h1>
          <p className="mt-1 text-slate-500">
            {caja.local.nombre} · Caja abierta · {caja.ventas.length} ventas del turno (
            {formatCLP(totalVentas)})
          </p>
        </div>
        <a
          href="/dashboard/pos/boletas"
          className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold leading-10 text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
        >
          Ver boletas →
        </a>
      </div>

      <PosVenta cajaId={caja.id} productos={posProductos} />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Últimas ventas del turno */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-lg font-bold text-navy-950">Ventas del turno</h2>
          {caja.ventas.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Aún no hay ventas en este turno.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {caja.ventas.slice(0, 10).map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-xs text-slate-500">
                    {caja.local.codigo}-{String(v.correlativo).padStart(6, "0")}
                  </span>
                  <span className="text-slate-500">{v.medioPago.toLowerCase()}</span>
                  <span className="font-bold text-navy-950">{formatCLP(v.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CerrarCajaForm
          cajaId={caja.id}
          montoApertura={caja.montoApertura}
          ventasEfectivo={ventasEfectivo}
          totalVentas={totalVentas}
          nVentas={caja.ventas.length}
        />
      </div>
    </div>
  );
}
