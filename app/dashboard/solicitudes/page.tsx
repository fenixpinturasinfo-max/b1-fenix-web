import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  HistorialSolicitudes,
  type DocSolicitud,
} from "@/features/supply/components/HistorialSolicitudes";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});
// Fecha requerida se guarda a mediodía UTC: formatear en UTC evita corrimiento de día
const fmtFecha = new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeZone: "UTC" });

const ESTADOS = ["TODAS", "PENDIENTE", "COTIZADA", "DESPACHADA", "RECHAZADA"];

export default async function SolicitudesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const session = await requireSeccion("compras.solicitudes");
  const { estado } = await searchParams;
  const filtroInicial = estado && ESTADOS.includes(estado) ? estado : "TODAS";

  const matriz = await prisma.local.findFirst({ where: { esMatriz: true, activo: true } });
  const esEncargado =
    esRolGlobal(session.rol) || (matriz !== null && session.localId === matriz.id);

  const solicitudes = await prisma.solicitudReposicion.findMany({
    where: {
      destino: "PROVEEDOR",
      ...(esEncargado ? {} : { localId: session.localId! }),
    },
    include: {
      producto: true,
      local: true,
      solicitante: true,
      resueltoPor: true,
      proveedor: true,
      ordenCompra: { select: { id: true, correlativo: true, estado: true } },
    },
    orderBy: { creadoEn: "desc" },
    take: 300,
  });

  // ── Historial agrupado por documento (folio SOL-) ──
  const porDoc = new Map<string, typeof solicitudes>();
  for (const s of solicitudes) {
    const key = s.correlativo != null ? `SOL-${s.correlativo}` : s.id;
    const grupo = porDoc.get(key);
    if (grupo) grupo.push(s);
    else porDoc.set(key, [s]);
  }
  const docs: DocSolicitud[] = [...porDoc.entries()].map(([key, grupo]) => {
    const primera = grupo[0];
    const estados = new Set(grupo.map((s) => s.estado));
    const estado = estados.size === 1 ? primera.estado : "PARCIAL";
    const conPrecio = grupo.filter((s) => s.costoUnitario != null);
    const oc = grupo.find((s) => s.ordenCompra)?.ordenCompra ?? null;
    return {
      key,
      folio:
        primera.correlativo != null
          ? `SOL-${String(primera.correlativo).padStart(6, "0")}`
          : "—",
      fecha: fmt.format(primera.creadoEn),
      proveedor:
        primera.proveedor?.nombreFantasia ?? primera.proveedor?.razonSocial ?? null,
      proveedorId: primera.proveedorId,
      proveedorEmail: primera.proveedor?.email ?? null,
      local: primera.local.nombre,
      solicitante: primera.solicitante.nombre,
      estado,
      totalNeto:
        conPrecio.length > 0
          ? conPrecio.reduce((t, s) => t + s.costoUnitario! * s.cantidad, 0)
          : null,
      fechaRequerida: primera.fechaRequerida ? fmtFecha.format(primera.fechaRequerida) : null,
      fechaRequeridaISO: primera.fechaRequerida
        ? primera.fechaRequerida.toISOString().slice(0, 10)
        : null,
      oc: oc
        ? {
            id: oc.id,
            folio: `OC-${String(oc.correlativo).padStart(6, "0")}`,
            recibida: oc.estado === "RECIBIDA" || oc.estado === "CERRADA",
          }
        : null,
      lineas: grupo.map((s) => ({
        id: s.id,
        producto: s.producto.nombre,
        sku: s.producto.sku,
        local: s.local.comuna,
        cantidad: s.cantidad,
        precio: s.costoUnitario,
        estado: s.estado,
        resueltoPor: s.resueltoPor?.nombre ?? null,
        canResolve: esEncargado || s.localId === session.localId,
        canDelete:
          esEncargado || s.solicitanteId === session.sub || s.localId === session.localId,
        esProveedor: true,
      })),
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-navy-950">Solicitudes de Compra</h1>
          <p className="mt-1 text-slate-500">
            Pide a proveedores con precios referenciales · cotiza por correo · copia a Orden de
            Compra.
          </p>
        </div>
        <a
          href="/dashboard/solicitudes/nueva"
          className="bg-flame h-11 rounded-xl px-5 font-bold leading-[44px] text-white transition hover:opacity-90"
        >
          ＋ Nueva solicitud
        </a>
      </div>

      <HistorialSolicitudes docs={docs} esCompra filtroInicial={filtroInicial} />
    </div>
  );
}
