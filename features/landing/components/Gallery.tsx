import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";

const INSTAGRAM_URL = "https://www.instagram.com/pinturas.fenix";

/**
 * Galería de trabajos y tienda.
 * Para usar fotos reales: guarda las imágenes como public/gallery/trabajo-1.jpg,
 * trabajo-2.jpg, etc. y este componente las mostrará automáticamente.
 */
const items = [
  { src: "/gallery/trabajo-1.jpg", alt: "Trabajo de pintura automotriz terminado", label: "Pintura completa" },
  { src: "/gallery/trabajo-2.jpg", alt: "Pulido y detailing de vehículo", label: "Pulido y detailing" },
  { src: "/gallery/trabajo-3.jpg", alt: "Interior de la tienda Fenix San Bernardo", label: "Tienda San Bernardo" },
  { src: "/gallery/trabajo-4.jpg", alt: "Tienda Fenix Buin", label: "Tienda Buin" },
];

export function Gallery() {
  return (
    <section className="bg-cloud py-14 sm:py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle kicker="Galería" title="Nuestro trabajo habla" />
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ring-flame mb-10 inline-flex h-11 items-center rounded-xl bg-white px-5 font-semibold text-navy-950 transition hover:shadow-card"
          >
            Ver más en Instagram →
          </a>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {items.map((item) => (
            <a
              key={item.src}
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <Image
                src={item.src}
                alt={item.alt}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                className="object-cover transition group-hover:scale-105"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-950/80 to-transparent px-4 pb-3 pt-8 text-sm font-bold text-white">
                {item.label}
              </span>
            </a>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Sube tus fotos a <code>public/gallery/</code> (trabajo-1.jpg a trabajo-4.jpg) para verlas aquí.
        </p>
      </Container>
    </section>
  );
}
