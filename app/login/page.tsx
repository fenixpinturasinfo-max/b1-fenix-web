import type { Metadata } from "next";
import Image from "next/image";
import { LoginForm } from "@/features/auth/components/LoginForm";

export const metadata: Metadata = {
  title: "Ingresar | Pinturas Fenix",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen">
      {/* Panel de marca (desktop) */}
      <aside className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#1d6fb0,#0e518d_45%,#093a66)] p-10 lg:flex">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Borde central tipo brochazo: la mitad clara "pintada" sobre el azul */}
        <svg
          aria-hidden="true"
          viewBox="0 0 90 900"
          preserveAspectRatio="none"
          className="absolute -right-px top-0 h-full w-14 xl:w-20"
        >
          <path
            fill="#f4f6fb"
            d="M90,0 C45,60 72,150 50,240 C28,330 66,420 44,510 C24,600 62,690 42,780 C30,840 55,880 90,900 L90,0 Z"
          />
          <path
            fill="#f4f6fb"
            opacity="0.3"
            d="M90,0 C30,80 60,190 34,300 C12,400 52,500 30,610 C14,700 48,800 26,900 L90,900 L90,0 Z"
          />
          <path
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.25"
            strokeWidth="2"
            d="M62,0 C20,90 50,200 26,320 C8,420 44,530 22,650 C10,740 40,830 18,900"
          />
        </svg>

        <a href="/" className="relative flex items-center gap-3" aria-label="Volver a la tienda">
          <span className="ring-flame flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-white">
            <Image
              src="/logo-fenix.png?v=2"
              alt=""
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="text-lg font-black text-white">
            PINTURAS <span className="text-flame">FENIX</span>
          </span>
        </a>

        <div className="relative">
          <h1 className="max-w-md text-4xl font-black leading-tight text-white">
            Sistema de inventario y punto de venta
          </h1>
          <ul className="mt-6 space-y-3 text-white/85">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">🧾</span>
              Ventas y arqueo de caja por local
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">📦</span>
              Stock en tiempo real, San Bernardo y Buin
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">📊</span>
              Reportes consolidados de venta
            </li>
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} Pinturas Fenix · Uso exclusivo del equipo
        </p>
      </aside>

      {/* Formulario */}
      <section className="flex flex-1 items-center justify-center bg-cloud px-4 py-10">
        <div className="w-full max-w-sm">
          {/* Logo en móvil */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <span className="ring-flame flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white">
              <Image
                src="/logo-fenix.png?v=2"
                alt="Logo Pinturas Fenix"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            </span>
            <p className="font-black text-navy-950">
              PINTURAS <span className="text-fenix-600">FENIX</span>
            </p>
          </div>

          <h2 className="text-2xl font-black text-navy-950">Hola de nuevo 👋</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            Ingresa con tu cuenta para abrir caja o gestionar inventario.
          </p>

          <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-card">
            <LoginForm />
          </div>

          <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
            <a href="/" className="font-semibold text-slate-500 transition hover:text-electric-600">
              ← Volver a la tienda
            </a>
            <span>¿Sin acceso? Habla con tu administrador</span>
          </div>
        </div>
      </section>
    </main>
  );
}
