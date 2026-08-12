"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import { formatCLP } from "@/lib/format";
import { enviarCorreo } from "@/lib/email";
import {
  calcularEnvio,
  tipoDespachoPara,
  COURIERS,
  type TipoEntregaWeb,
} from "@/lib/envio";
import {
  crearPagoWebpay,
  confirmarPagoWebpay,
  pagoAutorizado,
  urlSitio,
} from "@/lib/webpay";

/**
 * Checkout de la tienda web con Webpay Plus.
 *
 * El flujo tiene dos mitades y una invariante:
 *  1. `iniciarPagoWebpay` congela el pedido (productos, precios, envío) con los valores
 *     REALES de la base —nunca los del navegador—, verifica stock y crea la transacción
 *     en Transbank. El comprador se va a Webpay.
 *  2. Webpay devuelve al comprador a /checkout/retorno, que llama a
 *     `confirmarRetornoWebpay`: recién con el pago AUTORIZADO el stock sale del local
 *     (movimientos SALIDA_VENTA) y el pedido queda PAGADO.
 *
 * La invariante: **la plata y el stock se mueven juntos, en el commit.** Antes de eso el
 * pedido es solo una intención (PENDIENTE_PAGO) que se anula sola si el pago no llega.
 */

const folioWeb = (n: number) => `WEB-${String(n).padStart(6, "0")}`;

/** El slug histórico del catálogo público ("san-bernardo") a partir del código del Local. */
const CODIGO_A_SLUG: Record<string, string> = { SB: "san-bernardo", BU: "buin" };
const slugDeLocal = (codigo: string) => CODIGO_A_SLUG[codigo] ?? codigo.toLowerCase();

const MAX_ITEMS = 50;
const MAX_QTY = 99;

export interface PagoState {
  error?: string;
  /** URL de Webpay y token: el navegador arma un POST con token_ws y se va a pagar. */
  url?: string;
  token?: string;
}

interface ItemForm {
  sku: string;
  qty: number;
}

export async function iniciarPagoWebpay(
  _prev: PagoState,
  formData: FormData,
): Promise<PagoState> {
  let pedidoId: string | null = null;
  try {
    // Sin sesión: compra el público. Toda la validación es contra la base.
    const nombre = String(formData.get("nombre") ?? "").trim().slice(0, 80);
    const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 120);
    const telefono = String(formData.get("telefono") ?? "").trim().slice(0, 30);
    const tipoForm = String(formData.get("tipoEntrega") ?? "");
    const localSlug = String(formData.get("localSlug") ?? "");
    const direccion = String(formData.get("direccion") ?? "").trim().slice(0, 160) || null;
    const comuna = String(formData.get("comuna") ?? "").trim().slice(0, 60) || null;
    const courierForm = String(formData.get("courier") ?? "");

    let items: ItemForm[];
    try {
      items = JSON.parse(String(formData.get("items") ?? "[]"));
    } catch {
      return { error: "Carro inválido. Recarga la página." };
    }

    if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !telefono) {
      return { error: "Completa tu nombre, correo y teléfono." };
    }
    if (!Array.isArray(items) || items.length === 0) return { error: "El carro está vacío." };
    if (items.length > MAX_ITEMS) return { error: `Máximo ${MAX_ITEMS} productos por compra.` };
    for (const i of items) {
      i.qty = Math.trunc(Number(i.qty));
      if (!i.sku || !Number.isFinite(i.qty) || i.qty <= 0 || i.qty > MAX_QTY) {
        return { error: "Hay cantidades inválidas en el carro." };
      }
    }

    // ── Entrega ──
    // El tipo NO se confía del formulario: retiro es retiro, y en despacho la comuna
    // decide si es anillo (tarifa fija) o courier (por pagar).
    if (tipoForm !== "RETIRO" && tipoForm !== "DESPACHO") {
      return { error: "Elige retiro en tienda o despacho a domicilio." };
    }
    let tipoEntrega: TipoEntregaWeb;
    let courier: string | null = null;
    if (tipoForm === "RETIRO") {
      tipoEntrega = "RETIRO";
    } else {
      if (!direccion || !comuna) return { error: "Completa la dirección y comuna de despacho." };
      tipoEntrega = tipoDespachoPara(comuna);
      if (tipoEntrega === "DESPACHO_COURIER") {
        if (!(COURIERS as readonly string[]).includes(courierForm)) {
          return { error: "Elige el courier para tu envío por pagar." };
        }
        courier = courierForm;
      }
    }
    const envio = calcularEnvio(tipoEntrega, comuna);

    // ── Local que entrega ──
    // Retiro: el que eligió el cliente. Despacho: la casa matriz (o el primer local
    // activo), que es donde se preparan los envíos.
    const locales = await prisma.local.findMany({ where: { activo: true } });
    const local =
      tipoEntrega === "RETIRO"
        ? locales.find((l) => slugDeLocal(l.codigo) === localSlug)
        : (locales.find((l) => l.esMatriz) ?? locales[0]);
    if (!local) return { error: "Selecciona el local de retiro." };

    // ── Productos y precios reales ──
    const skus = items.map((i) => i.sku);
    const productos = await prisma.producto.findMany({
      where: { sku: { in: skus }, activo: true },
      select: { id: true, sku: true, nombre: true, precioVenta: true, precioCosto: true },
    });
    if (productos.length !== new Set(skus).size) {
      return { error: "Hay productos que ya no están disponibles. Revisa tu carro." };
    }
    const porSku = new Map(productos.map((p) => [p.sku, p]));

    // ── Stock disponible en el local que entrega ──
    const stocks = await prisma.stockLocal.findMany({
      where: { localId: local.id, productoId: { in: productos.map((p) => p.id) } },
      select: { productoId: true, cantidad: true },
    });
    const stockDe = new Map(stocks.map((s) => [s.productoId, s.cantidad]));
    const faltantes = items
      .filter((i) => (stockDe.get(porSku.get(i.sku)!.id) ?? 0) < i.qty)
      .map((i) => {
        const p = porSku.get(i.sku)!;
        return `${p.nombre} (quedan ${stockDe.get(p.id) ?? 0})`;
      });
    if (faltantes.length > 0) {
      return {
        error: `Sin stock suficiente en ${local.nombre}: ${faltantes.join(" · ")}. Ajusta las cantidades${tipoEntrega === "RETIRO" ? " o elige otro local" : ""}.`,
      };
    }

    const montoProductos = items.reduce(
      (n, i) => n + porSku.get(i.sku)!.precioVenta * i.qty,
      0,
    );
    const total = montoProductos + envio.monto;

    // ── Pedido congelado + transacción Webpay ──
    const pedido = await prisma.$transaction(async (tx) => {
      const max = await tx.pedidoOnline.aggregate({ _max: { correlativo: true } });
      return tx.pedidoOnline.create({
        data: {
          correlativo: (max._max.correlativo ?? 0) + 1,
          tipoEntrega,
          nombre,
          email,
          telefono,
          localId: local.id,
          direccion,
          comuna,
          courier,
          montoProductos,
          montoEnvio: envio.monto,
          total,
          lineas: {
            create: items.map((i) => {
              const p = porSku.get(i.sku)!;
              return {
                productoId: p.id,
                cantidad: i.qty,
                precioUnitario: p.precioVenta,
                costoUnitario: p.precioCosto,
                subtotal: p.precioVenta * i.qty,
              };
            }),
          },
        },
        select: { id: true, correlativo: true },
      });
    });
    pedidoId = pedido.id;

    const webpay = await crearPagoWebpay({
      buyOrder: folioWeb(pedido.correlativo),
      sessionId: pedido.id,
      monto: total,
      returnUrl: `${urlSitio()}/checkout/retorno`,
    });

    await prisma.pedidoOnline.update({
      where: { id: pedido.id },
      data: { tbkToken: webpay.token },
    });

    return { url: webpay.url, token: webpay.token };
  } catch (e) {
    console.error("[iniciarPagoWebpay] fallo inesperado:", e);
    // El pedido sin token nunca va a pagarse: se anula para que no ensucie la bandeja.
    if (pedidoId) {
      await prisma.pedidoOnline
        .updateMany({
          where: { id: pedidoId, estado: "PENDIENTE_PAGO" },
          data: { estado: "ANULADO", nota: "No se pudo iniciar el pago en Webpay" },
        })
        .catch(() => {});
    }
    return { error: "No pudimos conectar con Webpay. Intenta de nuevo en un momento." };
  }
}

export interface ResultadoRetorno {
  ok: boolean;
  pedidoId?: string;
  motivo?: "rechazado" | "abandono" | "desconocido";
}

/**
 * Confirma el pago cuando Webpay devuelve al comprador.
 *
 * Con el pago AUTORIZADO: el pedido pasa a PAGADO y **recién ahí** el stock sale del
 * local, con movimientos SALIDA_VENTA. El UPDATE condicionado a PENDIENTE_PAGO hace la
 * confirmación idempotente: un refresh del retorno no descuenta dos veces.
 *
 * El stock se descuenta sin tope: se verificó al iniciar el pago, y si en la ventana en
 * que el comprador estaba en Webpay el mesón vendió la última unidad, la plata ya está
 * cobrada — el inventario debe reflejar la deuda (queda negativo y la tienda lo
 * resuelve al preparar), no esconderla rechazando un pago exitoso.
 */
export async function confirmarRetornoWebpay(token: string): Promise<ResultadoRetorno> {
  try {
    const pedido = await prisma.pedidoOnline.findUnique({
      where: { tbkToken: token },
      include: {
        lineas: { include: { producto: { select: { nombre: true } } } },
        local: { select: { id: true, nombre: true, direccion: true, comuna: true } },
      },
    });
    if (!pedido) return { ok: false, motivo: "desconocido" };
    // Idempotencia: el comprador refrescó la página de retorno.
    if (pedido.estado === "PAGADO" || pedido.estado === "DESPACHADO" || pedido.estado === "ENTREGADO") {
      return { ok: true, pedidoId: pedido.id };
    }
    if (pedido.estado !== "PENDIENTE_PAGO") return { ok: false, motivo: "rechazado" };

    const commit = await confirmarPagoWebpay(token);

    if (!pagoAutorizado(commit)) {
      await prisma.pedidoOnline.updateMany({
        where: { id: pedido.id, estado: "PENDIENTE_PAGO" },
        data: {
          estado: "ANULADO",
          nota: `Pago no autorizado por Webpay (código ${commit.response_code ?? "?"})`,
        },
      });
      return { ok: false, pedidoId: pedido.id, motivo: "rechazado" };
    }

    const folio = folioWeb(pedido.correlativo);
    const sistemaId = await usuarioSistema();

    await prisma.$transaction(
      async (tx) => {
        const confirmado = await tx.pedidoOnline.updateMany({
          where: { id: pedido.id, estado: "PENDIENTE_PAGO" },
          data: {
            estado: "PAGADO",
            pagadoEn: new Date(),
            tbkAutorizacion: commit.authorization_code ?? null,
            tbkTarjeta: commit.card_detail?.card_number?.slice(-4) ?? null,
          },
        });
        // Otro retorno simultáneo ya lo confirmó: no descontar de nuevo.
        if (confirmado.count !== 1) return;

        for (const l of pedido.lineas) {
          await tx.stockLocal.upsert({
            where: {
              productoId_localId: { productoId: l.productoId, localId: pedido.localId },
            },
            update: { cantidad: { decrement: l.cantidad } },
            create: { productoId: l.productoId, localId: pedido.localId, cantidad: -l.cantidad },
          });
        }
        await tx.movimientoInventario.createMany({
          data: pedido.lineas.map((l) => ({
            tipo: "SALIDA_VENTA" as const,
            productoId: l.productoId,
            localId: pedido.localId,
            cantidad: -l.cantidad,
            // El movimiento exige un usuario y la web no tiene cajero: se atribuye al
            // administrador del sistema; la trazabilidad real es `pedidoOnlineId` + nota.
            usuarioId: sistemaId,
            pedidoOnlineId: pedido.id,
            nota: `${folio} · venta web`,
          })),
        });
      },
      { timeout: 30_000, maxWait: 10_000 },
    );

    revalidatePath("/dashboard/ventas/online");
    revalidatePath("/dashboard/inventario");

    // Comprobante al comprador: si el correo falla, el pago no se ve afectado.
    try {
      await enviarCorreo({
        para: pedido.email,
        asunto: `Compra ${folio} confirmada · Pinturas Fenix`,
        html: correoComprobante(pedido, folio),
      });
    } catch {
      /* mejor esfuerzo */
    }

    return { ok: true, pedidoId: pedido.id };
  } catch (e) {
    console.error("[confirmarRetornoWebpay] fallo inesperado:", e);
    return { ok: false, motivo: "desconocido" };
  }
}

/**
 * Usuario al que se atribuyen los movimientos de la venta web (no hay cajero).
 * Se usa el administrador activo más antiguo: existe siempre (alguien configuró el
 * sistema) y deja claro en el historial que fue una operación del sistema.
 */
async function usuarioSistema(): Promise<string> {
  const admin = await prisma.usuario.findFirst({
    where: { rol: "ADMINISTRADOR", activo: true },
    orderBy: { creadoEn: "asc" },
    select: { id: true },
  });
  if (!admin) throw new Error("Sin usuario administrador para atribuir la venta web.");
  return admin.id;
}

/** El comprador cerró o abandonó Webpay: el pedido se anula, nada se movió. */
export async function anularPorAbandono(tbkToken: string): Promise<void> {
  try {
    await prisma.pedidoOnline.updateMany({
      where: { tbkToken, estado: "PENDIENTE_PAGO" },
      data: { estado: "ANULADO", nota: "Pago abandonado en Webpay" },
    });
  } catch (e) {
    console.error("[anularPorAbandono] fallo inesperado:", e);
  }
}

// ─────────────── Gestión interna (dashboard) ───────────────

export interface ActionState {
  error?: string;
  ok?: string;
}

/** PAGADO → DESPACHADO → ENTREGADO. Retiro en tienda salta directo a ENTREGADO. */
export async function avanzarPedidoOnline(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("ventas.online");
    const pedidoId = String(formData.get("pedidoId") ?? "");
    const accion = String(formData.get("accion") ?? "");

    const pedido = await prisma.pedidoOnline.findUnique({
      where: { id: pedidoId },
      select: { id: true, estado: true, localId: true, correlativo: true },
    });
    if (!pedido) return { error: "Pedido no encontrado." };
    if (!esRolGlobal(session.rol) && session.localId !== pedido.localId) {
      return { error: "Este pedido lo entrega otro local." };
    }

    if (accion === "DESPACHAR") {
      const r = await prisma.pedidoOnline.updateMany({
        where: { id: pedido.id, estado: "PAGADO" },
        data: { estado: "DESPACHADO", despachadoEn: new Date() },
      });
      if (r.count !== 1) return { error: "El pedido cambió de estado. Recarga la página." };
    } else if (accion === "ENTREGAR") {
      const r = await prisma.pedidoOnline.updateMany({
        where: { id: pedido.id, estado: { in: ["PAGADO", "DESPACHADO"] } },
        data: { estado: "ENTREGADO", entregadoEn: new Date() },
      });
      if (r.count !== 1) return { error: "El pedido cambió de estado. Recarga la página." };
    } else {
      return { error: "Acción inválida." };
    }

    revalidatePath("/dashboard/ventas/online");
    return { ok: `${folioWeb(pedido.correlativo)} actualizado.` };
  } catch (e) {
    console.error("[avanzarPedidoOnline] fallo inesperado:", e);
    return { error: "No se pudo actualizar el pedido." };
  }
}

// ─────────────── Comprobante por correo ───────────────

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function correoComprobante(
  pedido: {
    nombre: string;
    tipoEntrega: string;
    direccion: string | null;
    comuna: string | null;
    courier: string | null;
    montoProductos: number;
    montoEnvio: number;
    total: number;
    lineas: { cantidad: number; precioUnitario: number; subtotal: number; producto: { nombre: string } }[];
    local: { nombre: string; direccion: string; comuna: string };
  },
  folio: string,
): string {
  const filas = pedido.lineas
    .map(
      (l) => `<tr>
        <td style="padding:6px 0;border-top:1px solid #eee;">${l.cantidad} × ${escaparHtml(l.producto.nombre)}</td>
        <td style="padding:6px 0;border-top:1px solid #eee;text-align:right;"><b>${formatCLP(l.subtotal)}</b></td>
      </tr>`,
    )
    .join("");

  const entrega =
    pedido.tipoEntrega === "RETIRO"
      ? `Retiro en tienda: <b>${escaparHtml(pedido.local.nombre)}</b>, ${escaparHtml(pedido.local.direccion)}, ${escaparHtml(pedido.local.comuna)}. Te avisaremos cuando esté listo.`
      : pedido.tipoEntrega === "DESPACHO_ANILLO"
        ? `Despacho a domicilio: ${escaparHtml(pedido.direccion ?? "")}, ${escaparHtml(pedido.comuna ?? "")}.`
        : `Envío por ${escaparHtml(pedido.courier ?? "courier")} <b>por pagar al recibir</b> a: ${escaparHtml(pedido.direccion ?? "")}, ${escaparHtml(pedido.comuna ?? "")}.`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:440px;margin:0 auto;color:#101828;">
      <div style="text-align:center;padding:16px 0;">
        <h2 style="margin:0;">PINTURAS FENIX</h2>
        <p style="margin:4px 0;color:#555;">Compra confirmada</p>
        <p style="margin:4px 0;font-size:24px;font-weight:bold;font-family:monospace;">${folio}</p>
      </div>
      <p style="font-size:14px;">Hola ${escaparHtml(pedido.nombre)}, ¡gracias por tu compra! Tu pago fue aprobado por Webpay.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${filas}</table>
      <div style="border-top:1px dashed #ccc;margin-top:12px;padding-top:10px;font-size:14px;">
        <p style="margin:4px 0;color:#555;">Productos <span style="float:right;">${formatCLP(pedido.montoProductos)}</span></p>
        <p style="margin:4px 0;color:#555;">Envío <span style="float:right;">${pedido.montoEnvio > 0 ? formatCLP(pedido.montoEnvio) : pedido.tipoEntrega === "DESPACHO_COURIER" ? "por pagar al courier" : "gratis"}</span></p>
        <p style="margin:6px 0;font-size:18px;font-weight:bold;">TOTAL PAGADO <span style="float:right;">${formatCLP(pedido.total)}</span></p>
      </div>
      <p style="font-size:13px;color:#555;margin-top:14px;">${entrega}</p>
      <p style="text-align:center;color:#aaa;font-size:12px;margin-top:24px;">
        ¿Dudas? Responde este correo o escríbenos por WhatsApp · Instagram @pinturas.fenix
      </p>
    </div>`;
}
