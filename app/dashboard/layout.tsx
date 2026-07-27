import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import { seccionesVisibles } from "@/lib/auth/permissions";
import { agruparMenu, type ModuloId, type Seccion } from "@/lib/auth/secciones";
import { logout } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SidebarToggle } from "@/components/ui/SidebarToggle";
import { DashNav, type DashNavItem } from "@/components/ui/DashNav";
import {
  IconBox,
  IconCart,
  IconChart,
  IconHome,
  IconReceipt,
  IconSettings,
  IconUsers,
} from "@/components/ui/icons";

const moduloIcono: Record<ModuloId, React.ReactNode> = {
  inventario: <IconBox size={18} />,
  compras: <IconCart size={18} />,
  ventas: <IconReceipt size={18} />,
  socios: <IconUsers size={18} />,
  reportes: <IconChart size={18} />,
  configuracion: <IconSettings size={18} />,
};

const rolLabel: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  GERENTE: "Gerente",
  JEFE_LOCAL: "Encargado de Local",
  VENDEDOR: "Vendedor",
  BODEGA: "Bodega",
};

/**
 * El menú se deriva del catálogo de secciones filtrado por los permisos del perfil.
 * Un módulo sin secciones visibles no renderiza ni su encabezado; uno con una sola
 * sección se muestra como enlace plano, sin submenú de un solo ítem.
 */
function armarMenu(visibles: Seccion[]): DashNavItem[] {
  const items: DashNavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: <IconHome size={18} /> },
  ];

  for (const g of agruparMenu(visibles)) {
    if (g.plano) {
      items.push({
        href: g.secciones[0].href,
        label: g.secciones[0].label,
        icon: moduloIcono[g.modulo],
      });
      continue;
    }
    items.push({ label: g.label, icon: moduloIcono[g.modulo] }); // encabezado, no navega
    for (const s of g.secciones) items.push({ href: s.href, label: s.label, sub: true });
  }

  return items;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const [visibles, cookieStore] = await Promise.all([
    seccionesVisibles(session.rol),
    cookies(),
  ]);
  const tema = cookieStore.get("fenix-theme")?.value;

  return (
    <div id="dash-root" className={`bg-cloud ${tema === "dark" ? "dark" : ""}`}>
      <div className="flex min-h-screen">
        {/* Sidebar: solo navegación */}
        <aside
          id="dash-sidebar"
          className="hidden w-64 flex-col border-r border-slate-200 bg-white sm:flex print:hidden"
        >
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
            <span className="ring-flame flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/logo-fenix.png?v=2"
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </span>
            <span className="font-black tracking-tight text-navy-950">
              FENIX <span className="text-electric-600">Sistema</span>
            </span>
          </div>

          <DashNav items={armarMenu(visibles)} />
        </aside>

        <div className="flex flex-1 flex-col">
          {/* Topbar: usuario y acciones a la derecha */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 print:hidden">
            <div className="flex items-center gap-3">
              <SidebarToggle />
              {/* Marca: siempre en móvil; en escritorio solo cuando el menú está oculto */}
              <span id="topbar-brand" className="flex items-center gap-2.5 sm:hidden">
                <span className="ring-flame flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-white">
                  <Image
                    src="/logo-fenix.png?v=2"
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                  />
                </span>
                <span className="font-black tracking-tight text-navy-950">
                  FENIX <span className="text-electric-600">Sistema</span>
                </span>
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-electric-600 text-sm font-bold text-white">
                  {session.nombre.charAt(0).toUpperCase()}
                </span>
                <div className="hidden min-w-0 sm:block">
                  <p className="max-w-40 truncate text-sm font-bold leading-tight text-navy-950">
                    {session.nombre}
                  </p>
                  <p className="max-w-40 truncate text-xs leading-tight text-slate-500">
                    {rolLabel[session.rol]}
                    {session.localNombre ? ` · ${session.localNombre}` : " · Todos los locales"}
                  </p>
                </div>
              </div>
              <form action={logout}>
                <button
                  type="submit"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600"
                >
                  Salir
                </button>
              </form>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
