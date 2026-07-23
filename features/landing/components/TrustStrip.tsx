import { Container } from "@/components/ui/Container";

export function TrustStrip({
  nLocales = 2,
  comunas = "San Bernardo y Buin",
}: {
  nLocales?: number;
  comunas?: string;
}) {
  const items = [
    { title: "+9 marcas líderes", sub: "Sikkens, 3M, Sherwin-Williams y más" },
    {
      title: `${nLocales} ${nLocales === 1 ? "local" : "locales"}`,
      sub: `${comunas}, retiro el mismo día`,
    },
    { title: "Asesoría experta", sub: "Te ayudamos a elegir el producto correcto" },
  ];

  return (
    <section className="border-b border-slate-200 bg-cloud">
      <Container className="grid gap-6 py-8 sm:grid-cols-3">
        {items.map((i) => (
          <div key={i.title} className="flex items-center gap-4">
            <span aria-hidden="true" className="bg-flame h-10 w-1.5 shrink-0 rounded-full" />
            <div>
              <p className="font-bold text-navy-950">{i.title}</p>
              <p className="text-sm text-slate-600">{i.sub}</p>
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}
