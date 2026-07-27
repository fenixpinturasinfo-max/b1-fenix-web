import { requireModulo } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/features/users/components/UserForm";
import { toggleUsuarioActivo } from "@/features/users/actions";

const rolLabel: Record<string, string> = {
  ADMINISTRADOR: "Administrador",
  JEFE_LOCAL: "Jefe de Local",
  VENDEDOR: "Vendedor",
  BODEGA: "Bodega",
};

export default async function UsuariosPage() {
  const session = await requireModulo("usuarios");

  const [usuarios, locales] = await Promise.all([
    prisma.usuario.findMany({
      include: { local: true },
      orderBy: { creadoEn: "asc" },
    }),
    prisma.local.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Usuarios</h1>
        <p className="mt-1 text-slate-500">Cuentas del equipo con su rol y local asignado.</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-navy-950">Nuevo usuario</h2>
        <UserForm locales={locales.map((l) => ({ id: l.id, nombre: l.nombre }))} />
      </section>

      <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3">Nombre</th>
              <th className="px-5 py-3">Correo</th>
              <th className="px-5 py-3">Rol</th>
              <th className="px-5 py-3">Local</th>
              <th className="px-5 py-3">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-slate-100 last:border-0">
                <td className="px-5 py-3 font-semibold text-navy-950">{u.nombre}</td>
                <td className="px-5 py-3 text-slate-600">{u.email}</td>
                <td className="px-5 py-3 text-slate-600">{rolLabel[u.rol]}</td>
                <td className="px-5 py-3 text-slate-600">{u.local?.nombre ?? "Todos"}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      u.activo ? "bg-lime-400/15 text-[#4d7c0f]" : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {u.activo ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  {u.id !== session.sub && (
                    <form action={toggleUsuarioActivo}>
                      <input type="hidden" name="id" value={u.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
