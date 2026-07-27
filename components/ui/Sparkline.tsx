/**
 * Sparkline SVG sin librerías ni estado: renderiza en el servidor.
 * Es contexto de tendencia, no una herramienta de análisis — por eso no lleva
 * ejes ni tooltips. Para analizar está Reportes.
 */
export function Sparkline({
  puntos,
  etiquetas,
  alto = 56,
  ancho = 320,
  titulo,
}: {
  puntos: number[];
  /** Misma longitud que `puntos`; se usan para el resumen accesible */
  etiquetas?: string[];
  alto?: number;
  ancho?: number;
  /** Descripción para lectores de pantalla */
  titulo: string;
}) {
  if (puntos.length < 2) return null;

  const max = Math.max(...puntos);
  const min = Math.min(...puntos, 0);
  const rango = max - min || 1;
  const paso = ancho / (puntos.length - 1);
  const margen = 3;
  const util = alto - margen * 2;

  const xy = puntos.map((v, i) => [i * paso, margen + util - ((v - min) / rango) * util]);
  const linea = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${linea} L${ancho},${alto} L0,${alto} Z`;
  const [ux, uy] = xy[xy.length - 1];

  const ultimaEtiqueta = etiquetas?.[etiquetas.length - 1];

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      width="100%"
      height={alto}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${titulo}. ${puntos.length} días, máximo ${max.toLocaleString("es-CL")}${
        ultimaEtiqueta ? `, último día ${ultimaEtiqueta}` : ""
      }.`}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1d6fb0" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#1d6fb0" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={linea}
        fill="none"
        stroke="#1d6fb0"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={ux} cy={uy} r="3" fill="#0e518d" />
    </svg>
  );
}
