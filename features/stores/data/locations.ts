export interface StoreLocation {
  id: string;
  nombre: string;
  direccion: string;
  comuna: string;
  horario: string;
  mapsUrl: string;
  mapsEmbed: string;
}

export const locations: StoreLocation[] = [
  {
    id: "san-bernardo",
    nombre: "Fenix San Bernardo",
    direccion: "Eyzaguirre #268, esq. Francisco Aranda",
    comuna: "San Bernardo",
    horario: "Lun a Vie 9:00–18:30 · Sáb 9:30–14:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Eyzaguirre+268,+San+Bernardo,+Chile",
    mapsEmbed: "https://maps.google.com/maps?q=Eyzaguirre+268,+San+Bernardo,+Chile&z=16&output=embed",
  },
  {
    id: "buin",
    nombre: "Fenix Buin",
    direccion: "Tienda Fenix Buin",
    comuna: "Buin",
    horario: "Lun a Vie 9:00–18:30 · Sáb 9:30–14:00",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Pinturas+Fenix+Buin,+Chile",
    mapsEmbed: "https://maps.google.com/maps?q=Pinturas+Fenix+Buin,+Chile&z=15&output=embed",
  },
];

/** Número del local para pedidos por WhatsApp (formato internacional, sin +). */
export const WHATSAPP_NUMBER = "56933908415";
