import Link from "next/link";
import { requireSeccionConNivel } from "@/lib/auth/guards";
import { permisosDe } from "@/lib/auth/permissions";
import { resumenPerfil, SECCIONES, type Nivel } from "@/lib/auth/secciones";
import { prisma } from "@/lib/prisma";
import { ROLES_OPCIONES } from "@/features/users/roles";
import { HuellaPerfil, LeyendaNiveles } from "@/features/perfiles/components/nivelUi";

export default async function PerfilesPage() {
  const { session, escribe } = await requireSeccionConNivel("config.perfiles");

  const [usuarios, ...mapas] = await Promise.all([
    prisma.usuario.groupBy({ by: ["rol"], where: { activo: true }, _count: true }),
    ...ROLES_OPCIONES.map((r) => permisosDe(r.valor)),
  ]);

  const filas = ROLES_OPCIONES.map((r, i) => {
    const mapa = mapas[i];
    const niveles: Nivel[] = SECCIONES.map((s) => mapa[s.id] ?? "SIN_ACCESO");
    return {
      rol: r.valor as string,
      label: r.label,
      usuarios: usuarios.find((u) => u.rol === r.valor)?._count ?? 0,
      niveles,
      abiertas: niveles.filter((n) => n !== "SIN_ACCESO").length,
      lectura: niveles.filter((n) => n === "LECTURA").length,
      resumen: resumenPerfil(mapa),
      maestro: r.valor === "ADMINISTRADOR",
      propio: r.valor === session.rol,
    };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Perfiles</h1>
          <p className="mt-1 text-slate-500">
            Qué ve y qué puede hacer cada tipo de cuenta · {SECCIONES.length} secciones
          </p>
        </div>
        <LeyendaNiveles />
      </div>

      <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filas.map((f) => (
          <div key={f.rol} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-navy-950">{f.label}</span>
                <span className="text-xs text-slate-400">
                  {f.usuarios === 0
                    ? "Sin cuentas todavía"
                    : `${f.usuarios} ${f.usuarios === 1 ? "cuenta" : "cuentas"}`}
                </span>
                {f.propio && (
                  <span className="rounded-full bg-electric-50 px-2 py-0.5 text-xs font-bold text-electric-600">
                    el tuyo
                  </span>
                )}
                {f.maestro && (
                  <span
                    title="Es la llave maestra: si se pudiera restringir, un error dejaría el sistema sin nadie que lo arregle."
                    className="rounded-full bg-cloud px-2 py-0.5 text-xs font-bold text-slate-500"
                  >
                    🔒 No editable
                  </span>
                )}
              </div>

              <p className="mt-1 text-sm leading-snug text-slate-600">{f.resumen}</p>

              <div className="mt-2 flex flex-wrap items-center gap-3">
                <HuellaPerfil
                  niveles={f.niveles}
                  titulo={`${f.label}: ${f.abiertas} de ${SECCIONES.length} secciones abiertas`}
                />
                <span className="text-xs text-slate-400">
                  {f.abiertas} de {SECCIONES.length}
                  {f.lectura > 0 && ` · ${f.lectura} solo lectura`}
                </span>
              </div>
            </div>

            {!f.maestro && (
              <Link
                href={`/dashboard/configuracion/perfiles/${f.rol}`}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
              >
                {escribe && !f.propio ? "Editar" : "Ver"}
              </Link>
            )}
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-400">
        Una sección nueva del sistema nace cerrada para todos los perfiles salvo Administrador.
        Hay que abrirla acá a conciencia.
      </p>
    </div>
  );
}
