import Link from "next/link";
import { MODULOS, type ModuloId, type Seccion } from "@/lib/auth/secciones";
import {
  IconBox,
  IconCart,
  IconChart,
  IconReceipt,
  IconSettings,
  IconUsers,
} from "@/components/ui/icons";

const icono: Record<ModuloId, React.ReactNode> = {
  inventario: <IconBox size={18} />,
  compras: <IconCart size={18} />,
  ventas: <IconReceipt size={18} />,
  socios: <IconUsers size={18} />,
  reportes: <IconChart size={18} />,
  configuracion: <IconSettings size={18} />,
};

/**
 * Un acceso por módulo, apuntando a la primera sección que el perfil puede ver.
 * Se deriva de los permisos, así que nunca ofrece un atajo a una pantalla cerrada.
 */
export function AccesosRapidos({ visibles }: { visibles: Seccion[] }) {
  const atajos = MODULOS.map((m) => {
    const primera = visibles.find((s) => s.modulo === m.id);
    return primera ? { modulo: m, seccion: primera } : null;
  }).filter((x) => x !== null);

  if (atajos.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Acceso rápido</p>
      <div className="flex flex-wrap gap-2">
        {atajos.map(({ modulo, seccion }) => (
          <Link
            key={modulo.id}
            href={seccion.href}
            title={seccion.descripcion}
            className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-navy-950 transition hover:border-electric-500 hover:text-electric-600"
          >
            <span className="text-electric-600">{icono[modulo.id]}</span>
            {modulo.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
