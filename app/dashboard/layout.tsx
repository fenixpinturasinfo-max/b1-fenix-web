import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/auth/session";
import { modulosDe, type Modulo } from "@/lib/auth/permissions";
import { logout } from "@/features/auth/actions";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import {
  IconBox,
  IconChart,
  IconHome,
  IconReceipt,
  IconStore,
  IconTag,
  IconUsers,
} from "@/components/ui/icons";

const moduloNav: Record<Modulo, { href: string; label: string; icon: React.ReactNode }> = {
  pos: { href: "/dashboard/pos", label: "POS / Ventas", icon: <IconReceipt size={18} /> },
  inventario: { href: "/dashboard/inventario", label: "Inventario", icon: <IconBox size={18} /> },
  precios: { href: "/dashboard/precios", label: "Precios", icon: <IconTag size={18} /> },
  locales: { href: "/dashboard/locales", label: "Locales", icon: <IconStore size={18} /> },
  usuarios: { href: "/dashboard/usuarios", label: "Usuarios", icon: <IconUsers size={18} /> },
  reportes: { href: "/dashboard/reportes", label: "Reportes", icon: <IconChart size={18} /> },
};

const rolLabel: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  JEFE_LOCAL: "Jefe de Local",
  VENDEDOR: "Vendedor",
  BODEGA: "Bodega",
};

const navItem =
  "flex items-center gap-3 rounded-xl px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-electric-50 hover:text-electric-600";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const modulos = modulosDe(session.rol);

  return (
    <div id="dash-root" className="bg-cloud">
      {/* Aplica el tema guardado antes del primer render (evita parpadeo) */}
      <script
        dangerouslySetInnerHTML={{
          __html: `if(localStorage.getItem("fenix-theme")==="dark")document.getElementById("dash-root").classList.add("dark");`,
        }}
      />
      <div className="flex min-h-screen">
        {/* Sidebar: solo navegación */}
        <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white sm:flex print:hidden">
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

          <nav className="flex-1 space-y-1 p-3" aria-label="Módulos">
            <a href="/dashboard" className={navItem}>
              <IconHome size={18} /> Inicio
            </a>
            {modulos.map((m) => (
              <a key={m} href={moduloNav[m].href} className={navItem}>
                {moduloNav[m].icon} {moduloNav[m].label}
              </a>
            ))}
            {modulos.includes("pos") && (
              <a href="/dashboard/pos/boletas" className={`${navItem} pl-11 text-sm`}>
                Boletas
              </a>
            )}
          </nav>
        </aside>

        <div className="flex flex-1 flex-col">
          {/* Topbar: usuario y acciones a la derecha */}
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 print:hidden">
            <span className="font-black text-navy-950 sm:hidden">
              FENIX <span className="text-electric-600">Sistema</span>
            </span>
            <span className="hidden text-sm text-slate-400 sm:block" />

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

          <main className="flex-1 p-5 sm:p-8 print:p-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
