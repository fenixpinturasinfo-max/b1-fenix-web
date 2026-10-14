"use client";

import { useState } from "react";
import { urlImagenProducto } from "@/lib/imagen-producto";

/**
 * Foto del producto en el catálogo público. Resuelve links de Google Drive a la
 * miniatura liviana y, si no hay foto o Drive no la entrega (archivo no compartido,
 * borrado), vuelve al ícono genérico de la lata.
 */
export function ProductImage({ imagen, nombre }: { imagen?: string | null; nombre: string }) {
  const [fallo, setFallo] = useState(false);
  const src = urlImagenProducto(imagen);

  if (!src || fallo) return <CanIcon />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={nombre}
      width={400}
      height={400}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFallo(true)}
      className="h-full w-full object-contain p-3 transition group-hover:scale-105"
    />
  );
}

function CanIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="opacity-90 transition group-hover:scale-110">
      <rect x="16" y="18" width="32" height="38" rx="3" fill="#ffffff" stroke="#2a3650" strokeWidth="2" />
      <rect x="16" y="24" width="32" height="8" fill="#ff4d26" />
      <path d="M20 18v-4a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4" stroke="#2a3650" strokeWidth="2" />
    </svg>
  );
}
