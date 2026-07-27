/**
 * Separador de sección con forma de brochazo/onda.
 * `from`: color de la sección superior (fondo del svg)
 * `to`: color de la sección inferior (relleno de la onda)
 * `flip`: invierte la curva para alternar el ritmo visual
 */
export function SectionDivider({
  from,
  to,
  flip = false,
}: {
  from: string;
  to: string;
  flip?: boolean;
}) {
  return (
    <div aria-hidden="true" style={{ backgroundColor: from }} className="relative">
      <svg
        viewBox="0 0 1440 72"
        preserveAspectRatio="none"
        className={`block h-10 w-full sm:h-14 lg:h-[72px] ${flip ? "-scale-x-100" : ""}`}
      >
        {/* Trazo principal */}
        <path
          fill={to}
          d="M0,40 C180,72 340,8 560,26 C780,44 900,70 1120,48 C1260,34 1360,44 1440,30 L1440,72 L0,72 Z"
        />
        {/* Pincelada suelta sobre el trazo (detalle de brocha) */}
        <path
          fill={to}
          opacity="0.35"
          d="M0,52 C220,20 420,56 660,38 C900,20 1080,54 1290,36 C1350,31 1400,38 1440,34 L1440,54 C1200,66 800,60 400,62 C240,63 100,60 0,58 Z"
        />
      </svg>
    </div>
  );
}
