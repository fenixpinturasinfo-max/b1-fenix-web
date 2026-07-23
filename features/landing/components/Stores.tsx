import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { locations } from "@/features/stores/data/locations";

export function Stores() {
  return (
    <section className="bg-cloud py-14 sm:py-20">
      <Container>
        <SectionTitle id="locales" kicker="Locales" title="Visítanos" />
        <div className="grid gap-6 sm:grid-cols-2">
          {locations.map((l) => (
            <article
              key={l.id}
              className="flex flex-col gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-7"
            >
              <iframe
                src={l.mapsEmbed}
                title={`Mapa de ${l.nombre}`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="-mx-7 -mt-7 mb-2 h-52 w-[calc(100%+3.5rem)] border-0"
              />
              <h3 className="text-xl font-bold text-navy-950">{l.nombre}</h3>
              <p className="text-slate-600">📍 {l.direccion}, {l.comuna}</p>
              <p className="text-sm text-slate-500">🕒 {l.horario}</p>
              <a
                href={l.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex h-11 w-fit items-center rounded-xl border border-slate-300 px-5 font-semibold text-navy-950 transition hover:border-fenix-500 hover:text-fenix-600"
              >
                Cómo llegar →
              </a>
            </article>
          ))}
        </div>
      </Container>
    </section>
  );
}
