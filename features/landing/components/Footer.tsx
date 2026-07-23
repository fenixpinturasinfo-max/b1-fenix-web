import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { buildAdvisoryUrl } from "@/lib/whatsapp";

export function Footer() {
  return (
    <footer id="contacto" className="border-t border-navy-800 bg-navy-950 py-14">
      <Container className="grid gap-10 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="ring-flame flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/logo-fenix.png?v=2"
                alt="Logo Pinturas Fenix"
                width={44}
                height={44}
                className="h-full w-full object-cover"
              />
            </span>
            <p className="text-lg font-black text-white">
              PINTURAS <span className="text-flame">FENIX</span>
            </p>
          </div>
          <p className="mt-3 text-sm text-mist/80">
            Pinturas, insumos y accesorios automotrices. San Bernardo · Buin, Chile.
          </p>
        </div>
        <nav aria-label="Enlaces del sitio">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-mist/60">Sitio</p>
          <ul className="space-y-2 text-sm">
            {[
              ["#categorias", "Categorías"],
              ["#ofertas", "Ofertas"],
              ["#marcas", "Marcas"],
              ["#locales", "Locales"],
            ].map(([href, label]) => (
              <li key={href}>
                <a href={href} className="text-mist transition hover:text-white">{label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-mist/60">Contacto</p>
          <ul className="space-y-2 text-sm">
            <li>
              <a
                href={buildAdvisoryUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="text-mist transition hover:text-white"
              >
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/pinturas.fenix"
                target="_blank"
                rel="noopener noreferrer"
                className="text-mist transition hover:text-white"
              >
                Instagram @pinturas.fenix
              </a>
            </li>
          </ul>
        </div>
      </Container>
      <Container className="mt-10 border-t border-navy-800 pt-6">
        <p className="text-xs text-mist/50">
          © {new Date().getFullYear()} Pinturas Fenix. Todos los derechos reservados.
        </p>
      </Container>
    </footer>
  );
}
