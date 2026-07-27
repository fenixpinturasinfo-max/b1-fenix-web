import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { LocalCard } from "@/features/stores/components/LocalCard";
import { NuevoLocalModal } from "@/features/stores/components/NuevoLocalModal";

export default async function LocalesPage() {
  await requireSeccion("config.locales");

  const locales = await prisma.local.findMany({
    include: { _count: { select: { usuarios: { where: { activo: true } } } } },
    orderBy: { creadoEn: "asc" },
  });

  const activos = locales.filter((l) => l.activo).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Locales</h1>
          <p className="mt-1 text-slate-500">
            Sucursales / almacenes del inventario · {activos} activo{activos === 1 ? "" : "s"} ·
            aparecen en la tienda online, el carro y el POS.
          </p>
        </div>
        <NuevoLocalModal />
      </div>

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
              esMatriz: l.esMatriz,
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
