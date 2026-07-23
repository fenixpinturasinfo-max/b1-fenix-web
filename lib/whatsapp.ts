import { formatCLP } from "./format";
import { WHATSAPP_NUMBER } from "@/features/stores/data/locations";

interface OrderLine {
  nombre: string;
  qty: number;
  subtotal: number;
}

export function buildOrderUrl(lines: OrderLine[], localNombre: string, total: number): string {
  const items = lines
    .map((l) => `• ${l.qty}x ${l.nombre} — ${formatCLP(l.subtotal)}`)
    .join("\n");
  const msg = `¡Hola Pinturas Fenix! Quiero hacer un pedido para retiro en *${localNombre}*:\n\n${items}\n\n*Total: ${formatCLP(total)}*`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export function buildAdvisoryUrl(): string {
  const msg = "¡Hola Pinturas Fenix! Necesito asesoría para elegir un producto.";
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}
