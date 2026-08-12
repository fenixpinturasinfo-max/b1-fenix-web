import { prisma } from "@/lib/prisma";
import { CheckoutForm, type LocalCheckout } from "@/features/checkout/components/CheckoutForm";

export const metadata = {
  title: "Finalizar compra · Pinturas Fenix",
  robots: { index: false },
};

/** Mismo puente slug↔código que usa el catálogo público (ver getProductosPublicos). */
const CODIGO_A_SLUG: Record<string, string> = { SB: "san-bernardo", BU: "buin" };

export default async function CheckoutPage() {
  const locales = await prisma.local.findMany({
    where: { activo: true },
    orderBy: { nombre: "asc" },
    select: { codigo: true, nombre: true, comuna: true },
  });

  const paraForm: LocalCheckout[] = locales.map((l) => ({
    slug: CODIGO_A_SLUG[l.codigo] ?? l.codigo.toLowerCase(),
    nombre: l.nombre,
    comuna: l.comuna,
  }));

  return (
    <main className="min-h-screen bg-cloud">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <a href="/" className="text-sm font-semibold text-slate-500 hover:text-electric-600">
          ← Seguir comprando
        </a>
        <h1 className="mt-2 text-2xl font-black text-navy-950">Finalizar compra</h1>
        <p className="mb-6 mt-1 text-slate-500">
          Retiro gratis en tienda, o despacho a domicilio. Pagas con Webpay.
        </p>
        <CheckoutForm locales={paraForm} />
      </div>
    </main>
  );
}
