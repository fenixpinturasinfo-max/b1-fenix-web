import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { categories } from "@/features/catalog/data/products";

const icons: Record<string, string> = {
  "pinturas-lacas": "🎨",
  primers: "🧴",
  "pulido-detailing": "✨",
  "lijas-abrasivos": "🌀",
  accesorios: "🔧",
  kits: "📦",
};

export function Categories() {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <SectionTitle id="categorias" kicker="Catálogo" title="Todo para tu pintura" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <a
              key={c.id}
              href="#ofertas"
              className="group flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center transition hover:-translate-y-1 hover:border-fenix-400 hover:shadow-card"
            >
              <span className="text-3xl transition group-hover:scale-110" aria-hidden="true">
                {icons[c.id]}
              </span>
              <span className="font-bold text-navy-950">{c.nombre}</span>
              <span className="text-xs text-slate-500">{c.descripcion}</span>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
