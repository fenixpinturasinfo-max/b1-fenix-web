import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getLocalesActivos } from "@/lib/cache";
import { NuevoUsuarioModal } from "@/features/users/components/NuevoUsuarioModal";
import { UsuariosList, type UsuarioItem } from "@/features/users/components/UsuariosList";

export default async function UsuariosPage() {
  const session = await requireSeccion("config.usuarios");

  const [usuarios, locales] = await Promise.all([
    prisma.usuario.findMany({
      include: { local: true },
      orderBy: { creadoEn: "asc" },
    }),
    getLocalesActivos(),
  ]);

  const items: UsuarioItem[] = usuarios.map((u) => ({
    id: u.id,
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    localNombre: u.local?.nombre ?? null,
    activo: u.activo,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Usuarios</h1>
          <p className="mt-1 text-slate-500">
            Cuentas del equipo con su rol y local asignado · {items.filter((u) => u.activo).length}{" "}
            activas de {items.length}
          </p>
        </div>
        <NuevoUsuarioModal locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))} />
      </div>

      <UsuariosList usuarios={items} sessionUserId={session.sub} />
    </div>
  );
}
