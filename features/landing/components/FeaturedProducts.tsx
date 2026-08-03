import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProductExplorer } from "@/features/catalog/components/ProductExplorer";
import type { Product } from "@/features/catalog/types";

export function FeaturedProducts({ products }: { products: Product[] }) {
  return (
    <section className="bg-cloud py-14 sm:py-20">
      <Container>
        <SectionTitle id="ofertas" kicker="Ofertas" title="Nuestros productos" />
        <ProductExplorer products={products} />
      </Container>
    </section>
  );
}
