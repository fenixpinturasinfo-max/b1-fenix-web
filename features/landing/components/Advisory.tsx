import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { KitWizard } from "@/features/advisor/components/KitWizard";
import type { Product } from "@/features/catalog/types";

export function Advisory({ products }: { products: Product[] }) {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <SectionTitle
          id="asistente"
          kicker="Asistente de compra"
          title="¿No sabes qué necesitas? Te armamos el kit"
        />
        <KitWizard products={products} />
      </Container>
    </section>
  );
}
