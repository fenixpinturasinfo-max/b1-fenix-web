import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

/** TODO: reemplazar por testimonios reales de clientes (talleres). */
const testimonials = [
  {
    quote:
      "Siempre tienen el color exacto que necesito. Pido por WhatsApp en la mañana y retiro al mediodía, sin perder tiempo de taller.",
    name: "Carlos M.",
    role: "Taller de desabolladura y pintura, San Bernardo",
  },
  {
    quote:
      "La asesoría hace la diferencia. Me armaron el kit completo de pulido Menzerna y el resultado quedó impecable.",
    name: "Javiera R.",
    role: "Detailing independiente",
  },
  {
    quote:
      "Precios convenientes y marcas de verdad: Sikkens, 3M, Norton. Es mi proveedor fijo hace más de un año.",
    name: "Pedro S.",
    role: "Maestro pintor, Buin",
  },
];

export function Testimonials() {
  return (
    <section className="py-14 sm:py-20">
      <Container>
        <SectionTitle kicker="Clientes" title="Lo que dicen los talleres" />
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-7"
            >
              <div aria-hidden="true" className="text-flame text-4xl font-black leading-none">
                &ldquo;
              </div>
              <blockquote className="flex-1 text-slate-700">{t.quote}</blockquote>
              <figcaption>
                <p className="font-bold text-navy-950">{t.name}</p>
                <p className="text-sm text-slate-500">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </Container>
    </section>
  );
}
