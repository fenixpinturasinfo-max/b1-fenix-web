import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { StockTable, type StockRow } from "@/features/inventory/components/StockTable";
import { MovementForm } from "@/features/inventory/components/MovementForm";

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ local?: string }>;
}) {
  const session = await requireModulo("inventario");
  const { local: localParam } = await searchParams;

  const locales = await prisma.local.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
  });

  // Admin puede cambiar de local; el resto queda fijo en el suyo
  const localId =
    session.rol === "ADMINISTRADOR"
      ? (locales.find((l) => l.id === localParam)?.id ?? locales[0]?.id)
      : session.localId!;
  const localActual = locales.find((l) => l.id === localId);

  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { stocks: { where: { localId } } },
    orderBy: { nombre: "asc" },
  });

  const rows: StockRow[] = productos.map((p) => ({
    productoId: p.id,
    sku: p.sku,
    nombre: p.nombre,
    marca: p.marca,
    cantidad: p.stocks[0]?.cantidad ?? 0,
    stockMin: p.stocks[0]?.stockMin ?? 0,
    stockMax: p.stocks[0]?.stockMax ?? null,
    ubicacion: p.stocks[0]?.ubicacion ?? null,
    codigoBarra: p.codigoBarra,
  }));

  const bajos = rows.filter((r) => r.cantidad <= r.stockMin).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Inventario</h1>
          <p className="mt-1 text-slate-500">
            {localActual?.nombre} · {bajos > 0 ? `${bajos} productos requieren reposición` : "Todo en orden"}
          </p>
        </div>
        {session.rol === "ADMINISTRADOR" && (
          <nav className="flex gap-2" aria-label="Cambiar local">
            {locales.map((l) => (
              <a
                key={l.id}
                href={`/dashboard/inventario?local=${l.id}`}
                className={`h-10 rounded-full px-5 text-sm font-bold leading-10 transition ${
                  l.id === localId
                    ? "bg-electric-600 text-white"
                    : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
                }`}
              >
                {l.comuna}
              </a>
            ))}
          </nav>
        )}
        <a
          href="/dashboard/inventario/movimientos"
          className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold leading-10 text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
        >
          Ver historial de movimientos →
        </a>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navy-950">Registrar movimiento</h2>
        <MovementForm
          productos={productos.map((p) => ({ id: p.id, nombre: `${p.nombre} (${p.sku})` }))}
          locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))}
          localFijo={session.rol === "ADMINISTRADOR" ? null : session.localId}
        />
      </section>

      <StockTable rows={rows} localId={localId} />
    </div>
  );
}
