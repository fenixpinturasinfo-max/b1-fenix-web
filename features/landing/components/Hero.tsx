import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { buildAdvisoryUrl } from "@/lib/whatsapp";

export function Hero({ comunas = "San Bernardo · Buin" }: { comunas?: string }) {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Manchas de color del anillo fénix */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#ffb347]/30 blur-3xl" />
        <div className="absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[#2e5bff]/15 blur-3xl" />
        <div className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-[#ff7a45]/20 blur-3xl" />
      </div>

      <Container className="relative grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-2 lg:py-24">
        <div className="text-center lg:text-left">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-lime-400" aria-hidden="true" />
            {comunas}
          </p>
          <h1 className="text-4xl font-black leading-tight tracking-tight text-navy-950 sm:text-5xl lg:text-6xl">
            Especialistas en <span className="text-flame">pintura automotriz</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-slate-600 sm:text-lg lg:mx-0">
            Pinturas, insumos y accesorios de las marcas líderes: Sikkens, Sherwin-Williams, 3M,
            Menzerna y más. Arma tu pedido online y retíralo en tu local más cercano.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4 lg:justify-start">
            <a
              href="#ofertas"
              className="bg-flame flex h-13 items-center justify-center rounded-xl px-7 text-base font-bold text-white shadow-glow transition hover:opacity-90"
            >
              Ver catálogo
            </a>
            <a
              href={buildAdvisoryUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-13 items-center justify-center rounded-xl border-2 border-navy-950 px-7 text-base font-bold text-navy-950 transition hover:bg-navy-950 hover:text-white"
            >
              Pedir asesoría
            </a>
          </div>
        </div>

        {/* Visual: logo Fenix con destello (visible en todos los tamaños) */}
        <div className="relative order-first flex justify-center lg:order-none">
          <div className="relative">
            <div
              aria-hidden="true"
              className="bg-flame absolute -inset-6 rounded-full opacity-30 blur-3xl sm:-inset-8"
            />
            <div className="ring-flame relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full bg-white shadow-card sm:h-56 sm:w-56 lg:h-72 lg:w-72">
              <Image
                src="/logo-fenix.png?v=2"
                alt="Logo Pinturas Fenix"
                width={288}
                height={288}
                priority
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
