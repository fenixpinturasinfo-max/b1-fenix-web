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

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <FeaturedProducts />
        <Categories />
        <Advisory />
        <Gallery />
        <Testimonials />
        <Brands />
        <Stores />
      </main>
      <Footer />
      <CartDrawer />
      <FloatingWhatsApp />
    </>
  );
}
