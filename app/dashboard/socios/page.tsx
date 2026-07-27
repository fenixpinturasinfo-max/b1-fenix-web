import Link from "next/link";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { NuevoSocioModal } from "@/features/partners/components/NuevoSocioModal";
import { SociosList, type SocioItem } from "@/features/partners/components/SociosList";

export default async function SociosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireSeccion("socios.socios");
  const { tipo: tipoParam } = await searchParams;
  const tipo = tipoParam === "CLIENTE" ? "CLIENTE" : "PROVEEDOR";

  const socios = await prisma.socioNegocio.findMany({
    orderBy: [{ activo: "desc" }, { razonSocial: "asc" }],
  });

  const proveedores = socios.filter((s) => s.tipo === "PROVEEDOR");
  const clientes = socios.filter((s) => s.tipo === "CLIENTE");
  const visibles = tipo === "CLIENTE" ? clientes : proveedores;

  const items: SocioItem[] = visibles.map((s) => ({
    id: s.id,
    tipo: s.tipo,
    rut: s.rut,
    razonSocial: s.razonSocial,
    nombreFantasia: s.nombreFantasia,
    giro: s.giro,
    email: s.email,
    telefono: s.telefono,
    direccion: s.direccion,
    comuna: s.comuna,
    condicionPago: s.condicionPago,
    activo: s.activo,
  }));

  // Mismo lenguaje visual que <ChipsFiltro>, pero navegable (deep link desde compras y solicitudes)
  const tab = (activo: boolean) =>
    `flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
      activo
        ? "bg-electric-600 text-white"
        : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
    }`;
  const pill = (activo: boolean) =>
    `rounded-full px-1.5 text-xs ${activo ? "bg-white/20" : "bg-cloud"}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Socios de Negocios</h1>
          <p className="mt-1 text-slate-500">
            Proveedores para compras y cotizaciones · Clientes para ventas.
          </p>
        </div>
        <NuevoSocioModal tipo={tipo} />
      </div>

      {/* Pestañas por tipo */}
      <nav className="flex gap-2" aria-label="Tipo de socio">
        <Link
          href="/dashboard/socios?tipo=PROVEEDOR"
          className={tab(tipo === "PROVEEDOR")}
          aria-current={tipo === "PROVEEDOR" ? "page" : undefined}
        >
          🚚 Proveedores
          <span className={pill(tipo === "PROVEEDOR")}>{proveedores.length}</span>
        </Link>
        <Link
          href="/dashboard/socios?tipo=CLIENTE"
          className={tab(tipo === "CLIENTE")}
          aria-current={tipo === "CLIENTE" ? "page" : undefined}
        >
          👤 Clientes
          <span className={pill(tipo === "CLIENTE")}>{clientes.length}</span>
        </Link>
      </nav>

      <SociosList socios={items} tipo={tipo} />
    </div>
  );
}
