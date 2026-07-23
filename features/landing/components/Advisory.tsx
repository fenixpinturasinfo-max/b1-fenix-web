import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { KitWizard } from "@/features/advisor/components/KitWizard";

export function Advisory() {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <SectionTitle
          id="asistente"
          kicker="Asistente de compra"
          title="¿No sabes qué necesitas? Te armamos el kit"
        />
        <KitWizard />
      </Container>
    </section>
  );
}
