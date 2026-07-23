"use client";

import { useState } from "react";
import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { CartButton } from "@/features/cart/components/CartButton";
import { SearchBar } from "@/features/catalog/components/SearchBar";

const links = [
  { href: "#categorias", label: "Categorías" },
  { href: "#ofertas", label: "Ofertas" },
  { href: "#asistente", label: "Asistente" },
  { href: "#marcas", label: "Marcas" },
  { href: "#locales", label: "Locales" },
];

export function Header({ comunas = "San Bernardo y Buin" }: { comunas?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
      <div className="bg-flame py-1.5 text-center text-xs font-semibold text-white sm:text-sm">
        🏪 Retiro en tienda {comunas} · Pide por WhatsApp
      </div>
      <Container className="flex h-16 items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-2" aria-label="Pinturas Fenix, inicio">
          <span className="ring-flame flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white">
            <Image
              src="/logo-fenix.png?v=2"
              alt=""
              width={40}
              height={40}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-base font-black tracking-tight text-navy-950 sm:text-lg">
            PINTURAS <span className="text-fenix-600">FENIX</span>
          </span>
        </a>

        <nav className="hidden items-center gap-5 lg:flex" aria-label="Navegación principal">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-600 transition hover:text-navy-950"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:block">
          <SearchBar />
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/login"
            aria-label="Acceso equipo Fenix"
            title="Acceso equipo"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-electric-500 hover:text-navy-950"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </a>
          <CartButton />
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-navy-950 lg:hidden"
            aria-expanded={menuOpen}
            aria-label="Abrir menú"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? (
                <path d="M6 6l12 12M6 18L18 6" />
              ) : (
                <path d="M3 6h18M3 12h18M3 18h18" />
              )}
            </svg>
          </button>
        </div>
      </Container>

      {menuOpen && (
        <nav className="border-t border-slate-200 bg-white lg:hidden" aria-label="Navegación móvil">
          <Container className="flex flex-col py-2">
            <div className="px-2 py-2 md:hidden">
              <SearchBar />
            </div>
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-3 font-medium text-slate-600 transition hover:bg-cloud hover:text-navy-950"
              >
                {l.label}
              </a>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
