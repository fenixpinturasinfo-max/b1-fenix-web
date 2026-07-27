import { IconCheck, IconEye, IconMinus } from "@/components/ui/icons";
import type { Nivel } from "@/lib/auth/secciones";

/**
 * Lenguaje visual de los tres niveles.
 *
 * Verde = concedido, ámbar = parcial, gris = cerrado. Es la misma escala que el resto del
 * sistema usa para stock y caja, así que se lee sin aprender nada nuevo. El azul eléctrico
 * queda reservado para "seleccionado", que es lo que significa en el resto de la app.
 *
 * El color nunca es la única señal: siempre va con ícono y con texto.
 */
export const nivelChip: Record<Nivel, string> = {
  TOTAL: "bg-lime-400/15 text-[#4d7c0f]",
  LECTURA: "bg-[#f59e0b]/15 text-[#b45309]",
  SIN_ACCESO: "bg-slate-100 text-slate-400",
};

/** Colores sólidos, para la huella del perfil */
export const nivelBarra: Record<Nivel, string> = {
  TOTAL: "bg-lime-400",
  LECTURA: "bg-[#f59e0b]",
  SIN_ACCESO: "bg-slate-200",
};

export function IconoNivel({ nivel, size = 15 }: { nivel: Nivel; size?: number }) {
  if (nivel === "TOTAL") return <IconCheck size={size} />;
  if (nivel === "LECTURA") return <IconEye size={size} />;
  return <IconMinus size={size} />;
}

/**
 * Huella del perfil: un segmento por sección, en el orden del catálogo.
 * Dos perfiles con el mismo conteo de secciones se distinguen de un vistazo.
 */
export function HuellaPerfil({
  niveles,
  titulo,
}: {
  niveles: Nivel[];
  titulo: string;
}) {
  return (
    <div className="flex gap-[2px]" role="img" aria-label={titulo}>
      {niveles.map((n, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-1.5 w-3.5 rounded-sm ${nivelBarra[n]}`}
        />
      ))}
    </div>
  );
}

export function LeyendaNiveles() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      <span className="flex items-center gap-1.5 font-semibold text-[#4d7c0f]">
        <IconCheck size={14} /> Total
      </span>
      <span className="flex items-center gap-1.5 font-semibold text-[#b45309]">
        <IconEye size={14} /> Solo lectura
      </span>
      <span className="flex items-center gap-1.5 font-semibold text-slate-400">
        <IconMinus size={14} /> Sin acceso
      </span>
    </div>
  );
}
