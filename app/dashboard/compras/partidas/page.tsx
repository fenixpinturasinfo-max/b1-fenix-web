import { esRolGlobal } from "@/lib/auth/permissions";
import { requireSeccion } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  ListaPartidas,
  type Partida,
} from "@/features/purchases/components/ListaPartidas";

const fmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

const folioDe = (prefijo: string, n: number) => `${prefijo}-${String(n).padStart(6, "0")}`;

export default async function PartidasPage() {
  const session = await requireSeccion("compras.partidas");
  const esAdmin = esRolGlobal(session.rol);
  const localId = session.localId;

  const [solicitudes, ordenes, entradas, facturas, notas] = await Promise.all([
    prisma.solicitudReposicion.findMany({
      where: esAdmin ? {} : { localId: localId! },
      include: { proveedor: true, local: true },
      orderBy: { creadoEn: "desc" },
      take: 300,
    }),
    prisma.ordenCompra.findMany({
      where: esAdmin ? {} : { localDestinoId: localId! },
      include: { proveedor: true, localDestino: true, lineas: true },
      orderBy: { creadoEn: "desc" },
      take: 150,
    }),
    prisma.entradaCompra.findMany({
      where: esAdmin ? {} : { localId: localId! },
      include: { proveedor: true, local: true, lineas: true },
      orderBy: { creadoEn: "desc" },
      take: 150,
    }),
    prisma.facturaCompra.findMany({
      where: esAdmin ? {} : { ordenCompra: { localDestinoId: localId! } },
      include: { proveedor: true, ordenCompra: { include: { localDestino: true } }, lineas: true },
      orderBy: { creadoEn: "desc" },
      take: 150,
    }),
    prisma.notaCredito.findMany({
      where: esAdmin ? {} : { factura: { ordenCompra: { localDestinoId: localId! } } },
      include: {
        lineas: true,
        factura: {
          include: { proveedor: true, ordenCompra: { include: { localDestino: true } } },
        },
      },
      orderBy: { creadoEn: "desc" },
      take: 150,
    }),
  ]);

  const partidas: (Partida & { ts: number })[] = [];

  // ── Solicitudes agrupadas por folio ──
  const porDoc = new Map<string, typeof solicitudes>();
  for (const s of solicitudes) {
    const key = s.correlativo != null ? `SOL-${s.correlativo}` : s.id;
    const grupo = porDoc.get(key);
    if (grupo) grupo.push(s);
    else porDoc.set(key, [s]);
  }
  for (const [key, grupo] of porDoc) {
    const primera = grupo[0];
    const estados = new Set(grupo.map((s) => s.estado));
    const estado =
      estados.size === 1 ? primera.estado : estados.has("PENDIENTE") ? "PARCIAL" : "DESPACHADA";
    const unidades = grupo.reduce((n, s) => n + s.cantidad, 0);
    const conPrecio = grupo.filter((s) => s.costoUnitario != null);
    const esProveedor = primera.destino === "PROVEEDOR";
    const tono =
      estado === "PENDIENTE"
        ? "warn"
        : estado === "PARCIAL"
          ? "info"
          : estado === "RECHAZADA"
            ? "error"
            : "ok";
    partidas.push({
      key: `sol-${key}`,
      ts: primera.creadoEn.getTime(),
      tipo: "SOL",
      folio: primera.correlativo != null ? folioDe("SOL", primera.correlativo) : "—",
      fecha: fmt.format(primera.creadoEn),
      proveedor: esProveedor
        ? primera.proveedor?.nombreFantasia ?? primera.proveedor?.razonSocial ?? null
        : "🏠 Casa matriz",
      local: primera.local.comuna,
      detalle: `${grupo.length} línea${grupo.length === 1 ? "" : "s"} · ${unidades} un.`,
      total:
        conPrecio.length > 0
          ? conPrecio.reduce((t, s) => t + s.costoUnitario! * s.cantidad, 0)
          : null,
      totalNota: conPrecio.length > 0 ? "neto" : null,
      estado:
        estado === "PENDIENTE"
          ? "Pendiente"
          : estado === "PARCIAL"
            ? "Parcial"
            : estado === "RECHAZADA"
              ? "Rechazada"
              : "Despachada",
      tono,
      abierto: estado === "PENDIENTE" || estado === "PARCIAL",
      href: `/dashboard/solicitudes?tab=${esProveedor ? "compra" : "interna"}`,
    });
  }

  // ── Órdenes de compra ──
  const estadoOC: Record<string, { label: string; tono: Partida["tono"]; abierto: boolean }> = {
    BORRADOR: { label: "Borrador", tono: "muted", abierto: true },
    ENVIADA: { label: "Enviada", tono: "info", abierto: true },
    RECIBIDA_PARCIAL: { label: "Recibida parcial", tono: "warn", abierto: true },
    RECIBIDA: { label: "Recibida", tono: "ok", abierto: true },
    CERRADA: { label: "Cerrada", tono: "muted", abierto: false },
    ANULADA: { label: "Anulada", tono: "error", abierto: false },
  };
  for (const oc of ordenes) {
    const e = estadoOC[oc.estado] ?? estadoOC.ENVIADA;
    const unidades = oc.lineas.reduce((n, l) => n + l.cantidad, 0);
    partidas.push({
      key: `oc-${oc.id}`,
      ts: oc.creadoEn.getTime(),
      tipo: "OC",
      folio: folioDe("OC", oc.correlativo),
      fecha: fmt.format(oc.creadoEn),
      proveedor: oc.proveedor.nombreFantasia ?? oc.proveedor.razonSocial,
      local: oc.localDestino.comuna,
      detalle: `${oc.lineas.length} línea${oc.lineas.length === 1 ? "" : "s"} · ${unidades} un.`,
      total: oc.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0),
      totalNota: "neto",
      estado: e.label,
      tono: e.tono,
      abierto: e.abierto,
      href: `/dashboard/compras/${oc.id}`,
    });
  }

  // ── Entradas de mercadería ──
  for (const ec of entradas) {
    const unidades = ec.lineas.reduce((n, l) => n + l.cantidad, 0);
    partidas.push({
      key: `ec-${ec.id}`,
      ts: ec.creadoEn.getTime(),
      tipo: "EC",
      folio: folioDe("EC", ec.correlativo),
      fecha: fmt.format(ec.creadoEn),
      proveedor: ec.proveedor.nombreFantasia ?? ec.proveedor.razonSocial,
      local: ec.local.comuna,
      detalle: `${unidades} un.${ec.numeroGuia ? ` · Guía ${ec.numeroGuia}` : ""}`,
      total: ec.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0),
      totalNota: "neto",
      estado: "Registrada",
      tono: "ok",
      abierto: false,
      href: "/dashboard/compras/entradas",
    });
  }

  // ── Facturas de compra ──
  const ahora = Date.now();
  for (const fc of facturas) {
    const vencida =
      fc.estado === "ABIERTA" &&
      fc.fechaVencimiento !== null &&
      fc.fechaVencimiento.getTime() < ahora;
    partidas.push({
      key: `fc-${fc.id}`,
      ts: fc.creadoEn.getTime(),
      tipo: "FC",
      folio: folioDe("FC", fc.correlativo),
      fecha: fmt.format(fc.creadoEn),
      proveedor: fc.proveedor.nombreFantasia ?? fc.proveedor.razonSocial,
      local: fc.ordenCompra.localDestino.comuna,
      detalle: `N° ${fc.numero}`,
      total: fc.total,
      totalNota: "c/IVA",
      estado: vencida
        ? "Vencida"
        : fc.estado === "ABIERTA"
          ? "Por pagar"
          : fc.estado === "PAGADA"
            ? "Pagada"
            : "Anulada",
      tono: vencida ? "error" : fc.estado === "ABIERTA" ? "warn" : fc.estado === "PAGADA" ? "ok" : "error",
      abierto: fc.estado === "ABIERTA",
      href: `/dashboard/compras/facturas/${fc.id}`,
    });
  }

  // ── Notas de crédito ──
  for (const nc of notas) {
    const unidades = nc.lineas.reduce((n, l) => n + l.cantidad, 0);
    partidas.push({
      key: `nc-${nc.id}`,
      ts: nc.creadoEn.getTime(),
      tipo: "NC",
      folio: folioDe("NC", nc.correlativo),
      fecha: fmt.format(nc.creadoEn),
      proveedor:
        nc.factura.proveedor.nombreFantasia ?? nc.factura.proveedor.razonSocial,
      local: nc.factura.ordenCompra.localDestino.comuna,
      detalle: `${unidades} un. · sobre ${folioDe("FC", nc.factura.correlativo)}`,
      total: nc.total,
      totalNota: "c/IVA",
      estado: "Registrada",
      tono: "ok",
      abierto: false,
      href: `/dashboard/compras/facturas/${nc.facturaId}`,
    });
  }

  partidas.sort((a, b) => b.ts - a.ts);
  const lista: Partida[] = partidas.map(({ ts: _ts, ...p }) => p);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-navy-950">Lista de partidas</h1>
        <p className="mt-1 text-slate-500">
          Todos los documentos de compras en un solo lugar: solicitudes, órdenes, entradas,
          facturas y notas de crédito.
        </p>
      </div>

      <ListaPartidas partidas={lista} />
    </div>
  );
}
