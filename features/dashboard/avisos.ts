import { prisma } from "@/lib/prisma";
import { permisosDe } from "@/lib/auth/permissions";
import type { SessionPayload } from "@/lib/auth/session";
import { inicioDia } from "@/lib/fechas";
import type { Aviso } from "./aviso";

/**
 * Avisos de la barra superior.
 *
 * Es la misma idea que la `BandejaPendientes` del dashboard, con dos diferencias que
 * vienen de que esto corre en el layout, o sea en **cada** navegación:
 *
 * 1. Solo consultas `count()`. `bloqueStock` del dashboard carga todas las filas de
 *    `StockLocal` para calcular tres métricas; eso está bien una vez al entrar, no en
 *    cada clic del menú.
 * 2. Solo lo que significa "alguien te está esperando" o "algo está roto ahora". El
 *    "bajo el mínimo" del dashboard no entra: es planificación de la semana, y un aviso
 *    que no se puede resolver hoy enseña a ignorar la campana.
 *
 * Cada aviso respeta los permisos del perfil: si la sección no está visible, no aparece.
 * Y un aviso en cero no se devuelve — la ausencia es la señal, igual que en la bandeja.
 */

export async function avisosDe(session: SessionPayload): Promise<Aviso[]> {
  const esGlobal = session.localId === null;
  const permisos = await permisosDe(session.rol);
  const ve = (seccion: string) => (permisos[seccion] ?? "SIN_ACCESO") !== "SIN_ACCESO";
  const alcance = esGlobal ? {} : { localId: session.localId! };

  // Todo en un solo Promise.all: en serie, seis consultas encadenarían seis viajes a la
  // base en el camino crítico de cada página.
  const [
    tomasPorContar,
    tomasPorRevisar,
    quiebres,
    ocPorRecibir,
    pedidosPorPreparar,
    cajasSinCerrar,
    solicitudesPendientes,
    facturasVencidas,
  ] = await Promise.all([
    ve("inventario.toma")
      ? prisma.tomaInventario.count({ where: { ...alcance, estado: "ABIERTA" } })
      : 0,
    ve("inventario.toma-aprobar")
      ? prisma.tomaInventario.count({ where: { ...alcance, estado: "CONTADA" } })
      : 0,
    ve("inventario.productos")
      ? prisma.stockLocal.count({
          where: { ...alcance, cantidad: { lte: 0 }, producto: { activo: true } },
        })
      : 0,
    ve("compras.ordenes")
      ? prisma.ordenCompra.count({
          where: {
            estado: { in: ["ENVIADA", "RECIBIDA_PARCIAL"] },
            ...(esGlobal ? {} : { localDestinoId: session.localId! }),
          },
        })
      : 0,
    ve("ventas.pedidos")
      ? prisma.pedidoCliente.count({ where: { ...alcance, estado: "PENDIENTE" } })
      : 0,
    // Solo las de días anteriores: la caja abierta de hoy es lo normal a media tarde
    ve("ventas.pos")
      ? prisma.cajaSesion.count({
          where: { ...alcance, estado: "ABIERTA", abiertaEn: { lt: inicioDia() } },
        })
      : 0,
    ve("compras.solicitudes")
      ? prisma.solicitudReposicion.count({
          where: { ...alcance, destino: "PROVEEDOR", estado: "PENDIENTE" },
        })
      : 0,
    // Solo las vencidas, no todas las abiertas: una factura a 30 días recién emitida no
    // es un pendiente, es el curso normal del negocio.
    ve("ventas.facturas")
      ? prisma.facturaVenta.count({
          where: { ...alcance, estado: "ABIERTA", fechaVencimiento: { lt: inicioDia() } },
        })
      : 0,
  ]);

  const todos: Aviso[] = [
    {
      id: "cajas-sin-cerrar",
      n: cajasSinCerrar,
      titulo: "Cajas sin cerrar",
      descripcion: "Quedaron abiertas de un día anterior",
      href: "/dashboard/pos",
      tono: "critico",
    },
    {
      id: "facturas-vencidas",
      n: facturasVencidas,
      titulo: "Facturas vencidas",
      descripcion: "Pasaron su fecha de pago y siguen sin cobrarse",
      href: "/dashboard/ventas/facturas",
      tono: "critico",
    },
    {
      id: "stock-quiebres",
      n: quiebres,
      titulo: "Productos sin stock",
      descripcion: "Se están perdiendo ventas ahora mismo",
      href: "/dashboard/inventario?estado=SIN",
      tono: "critico",
    },
    {
      // El aviso del encargado: el bodeguero terminó y alguien tiene que decidir
      id: "tomas-por-revisar",
      n: tomasPorRevisar,
      titulo: tomasPorRevisar === 1 ? "Toma por revisar" : "Tomas por revisar",
      descripcion: "El conteo está cerrado y espera tu ajuste al stock",
      href: "/dashboard/inventario/tomas",
      tono: "atencion",
    },
    {
      // El aviso del bodeguero: hay un conteo abierto esperando que lo haga
      id: "tomas-por-contar",
      n: tomasPorContar,
      titulo: tomasPorContar === 1 ? "Toma en conteo" : "Tomas en conteo",
      descripcion: "Descarga la planilla, cuenta e impórtala cuando termines",
      href: "/dashboard/inventario/tomas",
      tono: "info",
    },
    {
      id: "pedidos-por-preparar",
      n: pedidosPorPreparar,
      titulo: "Pedidos por preparar",
      descripcion: "Clientes esperando que se arme su pedido",
      href: "/dashboard/ventas/pedidos?estado=PENDIENTE",
      tono: "atencion",
    },
    {
      id: "oc-por-recibir",
      n: ocPorRecibir,
      titulo: "Órdenes por recibir",
      descripcion: "Mercadería en camino desde el proveedor",
      href: "/dashboard/compras?estado=ABIERTAS",
      tono: "info",
    },
    {
      id: "solicitudes-pendientes",
      n: solicitudesPendientes,
      titulo: "Solicitudes por responder",
      descripcion: "Reposiciones pedidas y aún sin resolver",
      href: "/dashboard/solicitudes?estado=PENDIENTE",
      tono: "info",
    },
  ];

  return todos.filter((a) => a.n > 0);
}
