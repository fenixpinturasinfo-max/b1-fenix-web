/** Utilidades para locales: URLs de mapa derivadas de la dirección. */

export interface LocalPublico {
  id: string;
  nombre: string;
  direccion: string;
  comuna: string;
  horario: string | null;
  mapsUrl: string;
  mapsEmbed: string;
}

export function toLocalPublico(l: {
  id: string;
  nombre: string;
  direccion: string;
  comuna: string;
  horario: string | null;
}): LocalPublico {
  const q = encodeURIComponent(`${l.direccion}, ${l.comuna}, Chile`);
  return {
    ...l,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${q}`,
    mapsEmbed: `https://maps.google.com/maps?q=${q}&z=16&output=embed`,
  };
}
