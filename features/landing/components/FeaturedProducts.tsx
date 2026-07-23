import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { ProductExplorer } from "@/features/catalog/components/ProductExplorer";

export function FeaturedProducts() {
  return (
    <section className="bg-cloud py-14 sm:py-20">
      <Container>
        <SectionTitle id="ofertas" kicker="Ofertas" title="Nuestros productos" />
        <ProductExplorer />
      </Container>
    </section>
  );
}
