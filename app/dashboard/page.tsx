import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { esRolGlobal, seccionesVisibles } from "@/lib/auth/permissions";
import { horaActual } from "@/lib/fechas";
import { BrushUnderline } from "@/components/ui/BrushUnderline";
import { AccesosRapidos } from "@/features/dashboard/components/AccesosRapidos";
import { DashBodega } from "@/features/dashboard/components/DashBodega";
import { DashGerencia } from "@/features/dashboard/components/DashGerencia";
import { DashJefeLocal } from "@/features/dashboard/components/DashJefeLocal";
import { DashVendedor } from "@/features/dashboard/components/DashVendedor";
import {
  datosBodega,
  datosGerencia,
  datosJefeLocal,
  datosVendedor,
  type Contexto,
} from "@/features/dashboard/queries";

/**
 * Home del dashboard: elige el tablero según el perfil.
 * Cada perfil tiene un objetivo distinto al abrir el sistema, así que cambia
 * tanto qué se muestra como el orden en que se muestra. Ver docs/UX-DASHBOARDS-POR-PERFIL.md
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const rol = session.rol;
  const ctx: Contexto = {
    usuarioId: session.sub,
    localId: session.localId,
    esGlobal: esRolGlobal(rol),
  };

  // Un rol de local sin local asignado no puede resolver ningún alcance
  if (!ctx.esGlobal && !ctx.localId) {
    return (
      <Cabecera session={session}>
        <p className="rounded-2xl border border-[#f59e0b]/40 bg-white px-4 py-3 text-sm font-semibold text-[#b45309]">
          Tu cuenta no tiene un local asignado, así que no hay datos que mostrar. Pídele a un
          administrador que te asigne una sucursal.
        </p>
      </Cabecera>
    );
  }

  const tablero = await (async () => {
    switch (rol) {
      case "VENDEDOR":
        return <DashVendedor datos={await datosVendedor(ctx)} />;
      case "BODEGA":
        return <DashBodega datos={await datosBodega(ctx)} />;
      case "JEFE_LOCAL":
        return <DashJefeLocal datos={await datosJefeLocal(ctx)} />;
      case "ADMINISTRADOR":
      case "GERENTE":
        return (
          <DashGerencia datos={await datosGerencia(ctx, { conSalud: rol === "ADMINISTRADOR" })} />
        );
      default:
        return null;
    }
  })();

  return (
    <Cabecera session={session} esGlobal={ctx.esGlobal}>
      {tablero}
      <AccesosRapidos visibles={await seccionesVisibles(rol)} />
    </Cabecera>
  );
}

function Cabecera({
  session,
  esGlobal = false,
  children,
}: {
  session: { nombre: string; localNombre: string | null };
  /** Un gerente puede tener local asignado y aun así ver todos: manda el alcance real */
  esGlobal?: boolean;
  children: React.ReactNode;
}) {
  const hora = horaActual();
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black text-navy-950 sm:text-2xl">
          {saludo}, {session.nombre.split(" ")[0]}
        </h1>
        <BrushUnderline className="mt-1" />
        <p className="mt-1.5 text-sm text-slate-500">
          {esGlobal
            ? "Vista consolidada · Todos los locales"
            : (session.localNombre ?? "Sin local asignado")}
        </p>
      </div>
      {children}
    </div>
  );
}
