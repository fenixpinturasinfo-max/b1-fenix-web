import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { LocalForm } from "@/features/stores/components/LocalForm";
import { LocalCard } from "@/features/stores/components/LocalCard";

export default async function LocalesPage() {
  await requireModulo("locales");

  const locales = await prisma.local.findMany({
    include: { _count: { select: { usuarios: { where: { activo: true } } } } },
    orderBy: { creadoEn: "asc" },
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Locales</h1>
        <p className="mt-1 text-slate-500">
          Las sucursales activas aparecen automáticamente en la tienda online, el carro y el POS.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navy-950">Nuevo local</h2>
        <LocalForm />
      </section>

      <div className="space-y-4">
        {locales.map((l) => (
          <LocalCard
            key={l.id}
            local={{
              id: l.id,
              codigo: l.codigo,
              nombre: l.nombre,
              direccion: l.direccion,
              comuna: l.comuna,
              horario: l.horario,
            }}
            usuarios={l._count.usuarios}
            activo={l.activo}
          />
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Un local no puede desactivarse mientras tenga usuarios activos asignados o cajas abiertas.
      </p>
    </div>
  );
}
