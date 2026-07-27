import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos, getProveedoresActivos } from "@/lib/cache";
import { OCForm } from "@/features/purchases/components/OCForm";

export default async function NuevaOCPage({
  searchParams,
}: {
  searchParams: Promise<{ proveedor?: string }>;
}) {
  const session = await requireSeccion("compras.ordenes");
  const { proveedor: proveedorParam } = await searchParams;

  const [proveedores, locales, productos, stockRows, precioRows] = await Promise.all([
    getProveedoresActivos(),
    getLocalesActivos(),
    prisma.producto.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
    prisma.stockLocal.findMany({
      where: { local: { activo: true } },
      select: { productoId: true, localId: true, cantidad: true },
    }),
    prisma.precioCompraProveedor.findMany({
      select: { proveedorId: true, productoId: true, precio: true },
    }),
  ]);

  // productoId → localId → stock · proveedorId → productoId → precio compra
  const stocks: Record<string, Record<string, number>> = {};
  for (const s of stockRows) (stocks[s.productoId] ??= {})[s.localId] = s.cantidad;
  const preciosCompra: Record<string, Record<string, number>> = {};
  for (const p of precioRows) (preciosCompra[p.proveedorId] ??= {})[p.productoId] = p.precio;

  // "Copiar a OC" (estilo SAP B1): arrastrar solicitudes de compra pendientes del proveedor
  const proveedorBase = proveedorParam
    ? proveedores.find((p) => p.id === proveedorParam) ?? null
    : null;
  const solicitudesBase = proveedorBase
    ? await prisma.solicitudReposicion.findMany({
        where: {
          destino: "PROVEEDOR",
          estado: { in: ["PENDIENTE", "COTIZADA"] },
          proveedorId: proveedorBase.id,
          ...(esRolGlobal(session.rol) ? {} : { localId: session.localId! }),
        },
        include: { producto: true },
        orderBy: { creadoEn: "asc" },
      })
    : [];

  // Consolidar por producto (suma cantidades; precio = referencial de la solicitud o CPP)
  const consolidado = new Map<string, { cantidad: number; costoUnitario: number }>();
  for (const s of solicitudesBase) {
    const prev = consolidado.get(s.productoId);
    const costo = s.costoUnitario ?? s.producto.precioCosto;
    if (prev) {
      prev.cantidad += s.cantidad;
      if (s.costoUnitario != null) prev.costoUnitario = s.costoUnitario;
    } else {
      consolidado.set(s.productoId, { cantidad: s.cantidad, costoUnitario: costo });
    }
  }
  const inicialLineas = [...consolidado.entries()].map(([productoId, v]) => ({
    productoId,
    cantidad: v.cantidad,
    costoUnitario: v.costoUnitario,
  }));

  return (
    <div className="space-y-6">
      <div>
        <a href="/dashboard/compras" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Volver a compras
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Nueva Orden de Compra</h1>
        <p className="mt-1 text-slate-500">
          El costo unitario viene sugerido con el costo promedio vigente — ajústalo al precio del proveedor.
        </p>
      </div>

      {proveedorBase && solicitudesBase.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-electric-500/30 bg-electric-50 px-5 py-3.5 text-sm">
          <span className="text-lg">📋</span>
          <p className="text-navy-950">
            <b>Copiando desde solicitud de compra:</b> {solicitudesBase.length} línea
            {solicitudesBase.length === 1 ? "" : "s"} de{" "}
            <b>{proveedorBase.nombreFantasia ?? proveedorBase.razonSocial}</b>. Al crear la OC,
            las solicitudes quedarán cerradas y vinculadas a este documento.
          </p>
        </div>
      )}

      {proveedores.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          ⚠️ No hay proveedores registrados. Crea uno en el módulo{" "}
          <a href="/dashboard/socios" className="font-bold text-electric-600 hover:underline">
            Socios
          </a>{" "}
          primero.
        </p>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <OCForm
            proveedores={proveedores.map((p) => ({
              id: p.id,
              nombre: p.nombreFantasia ?? p.razonSocial,
            }))}
            locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
            productos={productos.map((p) => ({
              id: p.id,
              sku: p.sku,
              nombre: p.nombre,
              marca: p.marca,
              codigoBarra: p.codigoBarra,
              costo: p.precioCosto,
            }))}
            localFijo={esRolGlobal(session.rol) ? null : session.localId}
            stocks={stocks}
            preciosCompra={preciosCompra}
            inicialProveedorId={proveedorBase?.id}
            inicialLineas={inicialLineas.length > 0 ? inicialLineas : undefined}
            solicitudIds={solicitudesBase.map((s) => s.id)}
          />
        </div>
      )}
    </div>
  );
}
