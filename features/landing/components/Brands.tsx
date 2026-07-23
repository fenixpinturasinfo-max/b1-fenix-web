import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { brands } from "@/features/catalog/data/products";

export function Brands() {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <SectionTitle id="marcas" kicker="Marcas" title="Trabajamos con los líderes" />
        <ul className="flex flex-wrap gap-3">
          {brands.map((b) => (
            <li
              key={b}
              className="rounded-full border border-slate-200 bg-white px-6 py-3 font-bold uppercase tracking-wider text-slate-600 transition hover:border-electric-500 hover:text-navy-950"
            >
              {b}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
