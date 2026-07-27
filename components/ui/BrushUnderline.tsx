/** Subrayado tipo pincelada con el gradiente fénix. */
export function BrushUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 14"
      preserveAspectRatio="none"
      className={`h-2.5 w-44 ${className}`}
    >
      <defs>
        <linearGradient id="fenixBrushGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8332a" />
          <stop offset="0.6" stopColor="#ff6b1a" />
          <stop offset="1" stopColor="#ffa53c" />
        </linearGradient>
      </defs>
      <path
        d="M4,8 C50,3 95,11 142,7 C176,4 202,8 216,6"
        fill="none"
        stroke="url(#fenixBrushGrad)"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M12,12 C74,9 138,13 204,10"
        fill="none"
        stroke="url(#fenixBrushGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.45"
      />
    </svg>
  );
}
