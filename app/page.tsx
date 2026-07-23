import { Header } from "@/features/landing/components/Header";
import { Hero } from "@/features/landing/components/Hero";
import { TrustStrip } from "@/features/landing/components/TrustStrip";
import { Categories } from "@/features/landing/components/Categories";
import { FeaturedProducts } from "@/features/landing/components/FeaturedProducts";
import { Brands } from "@/features/landing/components/Brands";
import { Advisory } from "@/features/landing/components/Advisory";
import { Gallery } from "@/features/landing/components/Gallery";
import { Testimonials } from "@/features/landing/components/Testimonials";
import { Stores } from "@/features/landing/components/Stores";
import { Footer } from "@/features/landing/components/Footer";
import { CartDrawer } from "@/features/cart/components/CartDrawer";
import { FloatingWhatsApp } from "@/features/landing/components/FloatingWhatsApp";
import { prisma } from "@/lib/prisma";
import { toLocalPublico, type LocalPublico } from "@/features/stores/lib";
import { locations } from "@/features/stores/data/locations";

// Refresca los datos de locales cada 5 minutos
export const revalidate = 300;

async function getLocales(): Promise<LocalPublico[]> {
  try {
    const locales = await prisma.local.findMany({
      where: { activo: true },
      orderBy: { creadoEn: "asc" },
    });
    if (locales.length > 0) return locales.map(toLocalPublico);
  } catch {
    // BD no disponible: usar datos estáticos de respaldo
  }
  return locations.map((l) => ({
    id: l.id,
    nombre: l.nombre,
    direccion: l.direccion,
    comuna: l.comuna,
    horario: l.horario,
    mapsUrl: l.mapsUrl,
    mapsEmbed: l.mapsEmbed,
  }));
}

export default async function Home() {
  const locales = await getLocales();
  const comunasDot = locales.map((l) => l.comuna).join(" · ");
  const comunasY =
    locales.length > 1
      ? `${locales
          .slice(0, -1)
          .map((l) => l.comuna)
          .join(", ")} y ${locales[locales.length - 1].comuna}`
      : (locales[0]?.comuna ?? "");

  return (
    <>
      <Header comunas={comunasY} />
      <main className="flex-1">
        <Hero comunas={comunasDot} />
        <TrustStrip nLocales={locales.length} comunas={comunasY} />
        <FeaturedProducts />
        <Categories />
        <Advisory />
        <Gallery />
        <Testimonials />
        <Brands />
        <Stores locales={locales} />
      </main>
      <Footer />
      <CartDrawer
        locales={locales.map((l) => ({ id: l.id, nombre: l.nombre, comuna: l.comuna }))}
      />
      <FloatingWhatsApp />
    </>
  );
}
