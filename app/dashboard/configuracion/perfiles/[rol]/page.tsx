import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { permisosDe } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { rolLabel, ROLES_OPCIONES } from "@/features/users/roles";
import {
  EditorPermisos,
  type OtroPerfil,
} from "@/features/perfiles/components/EditorPermisos";
import { TramoLibre } from "@/features/perfiles/components/TramoLibre";
import { topeDe } from "@/features/descuentos/topes";
import { SECCION_DESCUENTO } from "@/lib/descuento";

/** Los editables: el Administrador es la llave maestra y no entra a esta pantalla */
const EDITABLES = ROLES_OPCIONES.filter((r) => r.valor !== "ADMINISTRADOR");

export default async function EditarPerfilPage({
  params,
}: {
  params: Promise<{ rol: string }>;
}) {
  const { session, escribe } = await requireSeccionConNivel("config.perfiles");
  const { rol } = await params;

  if (!EDITABLES.some((r) => r.valor === rol)) notFound();

  const otrosRoles = EDITABLES.filter((r) => r.valor !== rol);

  const [inicial, tope, usuarios, ...mapasOtros] = await Promise.all([
    permisosDe(rol),
    topeDe(rol),
    prisma.usuario.findMany({
      where: { rol: rol as never, activo: true },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
    ...otrosRoles.map((r) => permisosDe(r.valor)),
  ]);

  const otros: OtroPerfil[] = otrosRoles.map((r, i) => ({
    rol: r.valor,
    label: r.label,
    niveles: mapasOtros[i],
  }));

  return (
    <div className="space-y-4">
      <div>
        <Link
          href="/dashboard/configuracion/perfiles"
          className="text-sm font-bold text-electric-600 hover:underline"
        >
          ← Perfiles
        </Link>
        <h1 className="mt-1 text-2xl font-black text-navy-950">{rolLabel[rol] ?? rol}</h1>
        <p className="mt-1 text-slate-500">
          {usuarios.length === 0
            ? "Ningún usuario tiene este perfil todavía"
            : `${usuarios.length} ${usuarios.length === 1 ? "usuario" : "usuarios"} · ${usuarios.map((u) => u.nombre).join(" · ")}`}
        </p>
      </div>

      <EditorPermisos
        rol={rol}
        perfilLabel={rolLabel[rol] ?? rol}
        inicial={inicial}
        usuarios={usuarios}
        otros={otros}
        esPropio={rol === session.rol}
        soloLectura={!escribe}
      />

      <TramoLibre
        rol={rol}
        inicial={tope}
        autorizaDescuentos={inicial[SECCION_DESCUENTO] === "TOTAL"}
        esPropio={rol === session.rol}
        soloLectura={!escribe}
      />
    </div>
  );
}
