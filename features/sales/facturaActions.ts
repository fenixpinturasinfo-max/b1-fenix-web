"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import { instanteSantiago, partesSantiago } from "@/lib/fechas";
import { esCondicionValida, totalesFactura, vencimientoDesde } from "./factura";
import { resolverDescuento } from "@/features/descuentos/resolver";
import { montoDesdePorcentaje } from "@/lib/descuento";

export interface ActionState {
  error?: string;
  ok?: string;
  facturaId?: string;
}

/** Línea que llega del formulario. Los precios se recalculan en el servidor. */
interface LineaFactura {
  productoId: string;
  cantidad: number;
}

const MAX_LINEAS = 200;

function validaLocal(session: { rol: string; localId: string | null }, localId: string) {
  return esRolGlobal(session.rol) || session.localId === localId;
}

/** aaaa-mm-dd (hora de Chile) a instante. El servidor corre en UTC. */
function fechaDesdeISO(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const d = instanteSantiago(Number(m[1]), Number(m[2]), Number(m[3]), 12);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Emite una factura de venta.
 *
 * **Descuenta stock y genera los movimientos**: la factura es la venta, no un documento
 * posterior. Es el camino del cliente empresa que no pasa por caja.
 *
 * El precio de catálogo se toma como neto y el IVA se suma encima (ver `factura.ts`), así
 * que el total no coincide con el del pedido de origen, que sí es IVA incluido.
 */
export async function emitirFactura(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("ventas.facturas");

    const clienteId = String(formData.get("clienteId") ?? "");
    const localId = String(formData.get("localId") ?? "");
    const pedidoId = String(formData.get("pedidoId") ?? "") || null;
    const folioSii = String(formData.get("folioSii") ?? "").trim() || null;
    const condicionPago = String(formData.get("condicionPago") ?? "CONTADO");
    const nota = String(formData.get("nota") ?? "").trim() || null;
    const fechaEmisionRaw = String(formData.get("fechaEmision") ?? "");

    if (!clienteId) return { error: "Selecciona el cliente: una factura necesita RUT." };
    if (!localId) return { error: "Selecciona el local que emite." };
    if (!validaLocal(session, localId)) return { error: "No puedes facturar desde otro local." };
    if (!esCondicionValida(condicionPago)) return { error: "Condición de pago inválida." };

    const p = partesSantiago();
    const fechaEmision = fechaEmisionRaw
      ? fechaDesdeISO(fechaEmisionRaw)
      : instanteSantiago(p.year, p.month, p.day, 12);
    if (!fechaEmision) return { error: "Fecha de emisión inválida." };
    if (fechaEmision.getTime() > Date.now() + 86_400_000) {
      return { error: "La fecha de emisión no puede estar en el futuro." };
    }

    let lineas: LineaFactura[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Líneas inválidas." };
    }
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "Agrega al menos un producto a la factura." };
    }
    if (lineas.length > MAX_LINEAS) return { error: `Máximo ${MAX_LINEAS} líneas por factura.` };
    if (new Set(lineas.map((l) => l.productoId)).size !== lineas.length) {
      return { error: "Hay un producto repetido. Consolida su cantidad en una línea." };
    }
    for (const l of lineas) {
      l.cantidad = Math.trunc(Number(l.cantidad));
      if (!Number.isFinite(l.cantidad) || l.cantidad <= 0) {
        return { error: "Hay cantidades inválidas." };
      }
    }

    const cliente = await prisma.socioNegocio.findFirst({
      where: { id: clienteId, tipo: "CLIENTE", activo: true },
      select: {
        id: true,
        razonSocial: true,
        rut: true,
        condicionPago: true,
        descuentoPorcentaje: true,
      },
    });
    if (!cliente) return { error: "El cliente no existe o está inactivo." };

    // El pedido debe estar disponible: uno ya facturado descontaría stock dos veces
    if (pedidoId) {
      const pedido = await prisma.pedidoCliente.findUnique({
        where: { id: pedidoId },
        select: { id: true, estado: true, localId: true, factura: { select: { correlativo: true } } },
      });
      if (!pedido) return { error: "El pedido vinculado no existe." };
      if (pedido.factura) {
        return {
          error: `Ese pedido ya está facturado (FV-${String(pedido.factura.correlativo).padStart(6, "0")}).`,
        };
      }
      if (pedido.estado === "ANULADO") return { error: "Ese pedido está anulado." };
      if (pedido.localId !== localId) {
        return { error: "El pedido es de otro local: no se puede facturar desde este." };
      }
    }

    // Precios reales desde la BD, nunca del cliente
    const productos = await prisma.producto.findMany({
      where: { id: { in: lineas.map((l) => l.productoId) }, activo: true },
      select: { id: true, nombre: true, sku: true, precioVenta: true, precioCosto: true },
    });
    if (productos.length !== lineas.length) {
      return { error: "Hay productos inválidos o inactivos. Recarga la página." };
    }
    const porId = new Map(productos.map((x) => [x.id, x]));

    // Pre-validación de stock: mejor un error completo que una factura a medias
    const stocks = await prisma.stockLocal.findMany({
      where: { localId, productoId: { in: lineas.map((l) => l.productoId) } },
      select: { productoId: true, cantidad: true },
    });
    const disponible = new Map(stocks.map((s) => [s.productoId, s.cantidad]));
    const faltantes = lineas
      .filter((l) => (disponible.get(l.productoId) ?? 0) < l.cantidad)
      .map(
        (l) =>
          `${porId.get(l.productoId)!.sku} (pide ${l.cantidad}, hay ${disponible.get(l.productoId) ?? 0})`,
      );
    if (faltantes.length > 0) {
      return {
        error: `Stock insuficiente en ${faltantes.length} línea${faltantes.length === 1 ? "" : "s"}: ${faltantes.join(" · ")}.`,
      };
    }

    const conPrecio = lineas.map((l) => ({
      ...l,
      precioUnitario: porId.get(l.productoId)!.precioVenta,
      costoUnitario: porId.get(l.productoId)!.precioCosto,
    }));
    // ── Descuento sobre el neto ──
    // Mismo trato que en el POS. El neto sin rebaja se calcula primero porque es la base
    // contra la que se mide el tramo libre del vendedor; recién con el descuento ya
    // resuelto se arman los totales definitivos y su IVA. El pactado de la ficha del
    // cliente entra como piso ya autorizado: no se suma con el manual, manda el mayor.
    const netoBruto = totalesFactura(conPrecio, 0).neto;
    const descuentoCliente = montoDesdePorcentaje(netoBruto, cliente.descuentoPorcentaje);
    const descuentoPedido = Math.round(Number(formData.get("descuento") ?? 0));
    const resuelto = await resolverDescuento({
      base: netoBruto,
      pedido: descuentoPedido,
      vale: String(formData.get("valeDescuento") ?? ""),
      operador: { id: session.sub, rol: session.rol },
      descuentoCliente,
    });
    if (!resuelto.ok) return { error: resuelto.error };

    const descuentoAutorizadoPorId = resuelto.valor.autorizadorId;
    const descuentoMotivo =
      resuelto.valor.descuento > 0
        ? String(formData.get("descuentoMotivo") ?? "").trim().slice(0, 120) ||
          // Sin motivo escrito y sin autorizador, la rebaja viene pactada en la ficha.
          (descuentoAutorizadoPorId === null
            ? `Pactado cliente ${cliente.descuentoPorcentaje}%`
            : null)
        : null;

    const { neto, iva, total, descuento } = totalesFactura(conPrecio, resuelto.valor.descuento);
    const fechaVencimiento = vencimientoDesde(fechaEmision, condicionPago);

    const creada = await prisma.$transaction(async (tx) => {
      const max = await tx.facturaVenta.aggregate({ _max: { correlativo: true } });
      const correlativo = (max._max.correlativo ?? 0) + 1;

      const factura = await tx.facturaVenta.create({
        data: {
          correlativo,
          folioSii,
          clienteId,
          pedidoId,
          localId,
          neto,
          descuento,
          descuentoAutorizadoPorId,
          descuentoMotivo,
          iva,
          total,
          fechaEmision,
          condicionPago,
          fechaVencimiento,
          nota,
          creadoPorId: session.sub,
          lineas: {
            create: conPrecio.map((l) => ({
              productoId: l.productoId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              subtotal: l.precioUnitario * l.cantidad,
              costoUnitario: l.costoUnitario,
            })),
          },
        },
        select: { id: true, correlativo: true },
      });

      for (const l of conPrecio) {
        // Decremento relativo y condicionado: si otra venta se cuela entre la lectura y
        // esta escritura, el stock no queda negativo ni se pisa un total ya viejo.
        const bajado = await tx.stockLocal.updateMany({
          where: { productoId: l.productoId, localId, cantidad: { gte: l.cantidad } },
          data: { cantidad: { decrement: l.cantidad } },
        });
        if (bajado.count !== 1) {
          throw new Error(`STOCK:${porId.get(l.productoId)!.sku}`);
        }
        await tx.movimientoInventario.create({
          data: {
            tipo: "SALIDA_VENTA",
            productoId: l.productoId,
            localId,
            cantidad: -l.cantidad,
            usuarioId: session.sub,
            facturaVentaId: factura.id,
            nota: `FV-${String(factura.correlativo).padStart(6, "0")}`,
          },
        });
      }

      // El pedido queda facturado: el POS no debe volver a cobrarlo
      if (pedidoId) {
        await tx.pedidoCliente.update({
          where: { id: pedidoId },
          data: { estado: "FACTURADO" },
        });
      }

      return factura;
    });

    revalidatePath("/dashboard/ventas/facturas");
    revalidatePath("/dashboard/ventas/pedidos");
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    revalidatePath("/");
    return {
      ok: `Factura FV-${String(creada.correlativo).padStart(6, "0")} emitida por ${total.toLocaleString("es-CL")} pesos. El stock ya se descontó.`,
      facturaId: creada.id,
    };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("STOCK:")) {
      return {
        error: `Se acabó el stock de ${e.message.slice(6)} mientras emitías la factura. Nada se guardó: revisa y vuelve a intentar.`,
      };
    }
    console.error("[emitirFactura] fallo inesperado:", e);
    return { error: "No se pudo emitir la factura. Revisa el log del servidor." };
  }
}

/** Vincula un pedido a una factura ya emitida, cuando no se hizo al crearla. */
export async function vincularPedido(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("ventas.facturas");
    const facturaId = String(formData.get("facturaId") ?? "");
    const pedidoId = String(formData.get("pedidoId") ?? "");

    const factura = await prisma.facturaVenta.findUnique({
      where: { id: facturaId },
      select: { id: true, estado: true, localId: true, pedidoId: true, clienteId: true },
    });
    if (!factura) return { error: "Factura no encontrada." };
    if (!validaLocal(session, factura.localId)) {
      return { error: "No puedes editar una factura de otro local." };
    }
    if (factura.estado === "ANULADA") return { error: "Esta factura está anulada." };
    if (factura.pedidoId) return { error: "Esta factura ya tiene un pedido vinculado." };

    const pedido = await prisma.pedidoCliente.findUnique({
      where: { id: pedidoId },
      select: {
        id: true,
        estado: true,
        localId: true,
        clienteId: true,
        correlativo: true,
        factura: { select: { correlativo: true } },
      },
    });
    if (!pedido) return { error: "Pedido no encontrado." };
    if (pedido.factura) {
      return {
        error: `Ese pedido ya está facturado (FV-${String(pedido.factura.correlativo).padStart(6, "0")}).`,
      };
    }
    if (pedido.localId !== factura.localId) {
      return { error: "El pedido es de otro local." };
    }
    // No bloquea si el pedido era de cliente de paso, pero sí si es de otra empresa:
    // vincular la factura de un cliente al pedido de otro rompe la trazabilidad.
    if (pedido.clienteId && pedido.clienteId !== factura.clienteId) {
      return { error: "Ese pedido es de otro cliente." };
    }

    await prisma.$transaction([
      prisma.facturaVenta.update({ where: { id: facturaId }, data: { pedidoId } }),
      // El stock ya salió con la factura: el pedido no debe cobrarse por el POS
      prisma.pedidoCliente.update({ where: { id: pedidoId }, data: { estado: "FACTURADO" } }),
    ]);

    revalidatePath("/dashboard/ventas/facturas");
    revalidatePath(`/dashboard/ventas/facturas/${facturaId}`);
    revalidatePath("/dashboard/ventas/pedidos");
    return { ok: `Pedido PED-${String(pedido.correlativo).padStart(6, "0")} vinculado.` };
  } catch (e) {
    console.error("[vincularPedido] fallo inesperado:", e);
    return { error: "No se pudo vincular el pedido." };
  }
}

/** Marca la factura como pagada. Es lo que la saca de cuentas por cobrar. */
export async function marcarPagada(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const session = await exigirEscritura("ventas.facturas");
    const facturaId = String(formData.get("facturaId") ?? "");

    const factura = await prisma.facturaVenta.findUnique({
      where: { id: facturaId },
      select: { estado: true, localId: true, correlativo: true },
    });
    if (!factura) return { error: "Factura no encontrada." };
    if (!validaLocal(session, factura.localId)) {
      return { error: "No puedes editar una factura de otro local." };
    }
    if (factura.estado === "ANULADA") return { error: "Esta factura está anulada." };
    if (factura.estado === "PAGADA") return { error: "Esta factura ya está pagada." };

    await prisma.facturaVenta.updateMany({
      where: { id: facturaId, estado: "ABIERTA" },
      data: { estado: "PAGADA", pagadaEn: new Date() },
    });

    revalidatePath("/dashboard/ventas/facturas");
    revalidatePath(`/dashboard/ventas/facturas/${facturaId}`);
    return { ok: `FV-${String(factura.correlativo).padStart(6, "0")} marcada como pagada.` };
  } catch (e) {
    console.error("[marcarPagada] fallo inesperado:", e);
    return { error: "No se pudo marcar como pagada." };
  }
}

/**
 * Anula la factura y **devuelve el stock**.
 *
 * A diferencia de anular una toma —que no toca inventario— acá el stock ya salió, así que
 * anular sin devolverlo dejaría el inventario corto para siempre. Se generan movimientos
 * de entrada espejo para que el historial explique por qué volvió la mercadería.
 */
export async function anularFactura(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const facturaId = String(formData.get("facturaId") ?? "");
    const motivo = String(formData.get("motivo") ?? "").trim();

    const factura = await prisma.facturaVenta.findUnique({
      where: { id: facturaId },
      select: {
        id: true,
        estado: true,
        localId: true,
        correlativo: true,
        pedidoId: true,
        lineas: { select: { productoId: true, cantidad: true } },
        // Cobro de cuenta abierta: esta factura no movió stock al emitirse
        retirosCuenta: { select: { id: true } },
      },
    });
    if (!factura) return { error: "Factura no encontrada." };
    if (factura.estado === "ANULADA") return { error: "Esta factura ya está anulada." };

    let session;
    try {
      session = await exigirEscritura("ventas.facturas");
    } catch {
      return { error: "No tienes permiso para anular facturas de venta." };
    }
    if (!validaLocal(session, factura.localId)) {
      return { error: "No puedes anular una factura de otro local." };
    }
    if (motivo.length < 5) {
      return { error: "Escribe el motivo de la anulación (mínimo 5 caracteres)." };
    }

    const folio = `FV-${String(factura.correlativo).padStart(6, "0")}`;

    await prisma.$transaction(async (tx) => {
      const anulada = await tx.facturaVenta.updateMany({
        where: { id: facturaId, estado: { not: "ANULADA" } },
        data: {
          estado: "ANULADA",
          anuladaPorId: session.sub,
          anuladaEn: new Date(),
          motivoAnulacion: motivo,
        },
      });
      if (anulada.count !== 1) throw new Error("YA_ANULADA");

      if (factura.retirosCuenta.length > 0) {
        // Cobro de cuenta abierta: la factura nunca movió stock (salió con cada retiro),
        // así que devolverlo acá lo inflaría. Anular el cobro reabre los retiros: la
        // mercadería sigue donde el cliente y la deuda vuelve a la cuenta.
        await tx.retiroCuenta.updateMany({
          where: { facturaVentaId: factura.id },
          data: { estado: "ABIERTO", facturaVentaId: null, cobradoEn: null },
        });
      } else {
        // Devolver lo que salió, con su movimiento espejo
        for (const l of factura.lineas) {
          await tx.stockLocal.upsert({
            where: { productoId_localId: { productoId: l.productoId, localId: factura.localId } },
            update: { cantidad: { increment: l.cantidad } },
            create: { productoId: l.productoId, localId: factura.localId, cantidad: l.cantidad },
          });
          await tx.movimientoInventario.create({
            data: {
              tipo: "ENTRADA",
              productoId: l.productoId,
              localId: factura.localId,
              cantidad: l.cantidad,
              usuarioId: session.sub,
              facturaVentaId: factura.id,
              nota: `Anulación ${folio} · ${motivo}`,
            },
          });
        }
      }

      // El pedido vuelve a estar disponible para facturar o cobrar por el POS
      if (factura.pedidoId) {
        await tx.pedidoCliente.update({
          where: { id: factura.pedidoId },
          data: { estado: "PREPARADO" },
        });
      }
    });

    revalidatePath("/dashboard/ventas/facturas");
    revalidatePath(`/dashboard/ventas/facturas/${facturaId}`);
    revalidatePath("/dashboard/ventas/pedidos");
    revalidatePath("/dashboard/ventas/cuenta");
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    revalidatePath("/");
    return {
      ok:
        factura.retirosCuenta.length > 0
          ? `${folio} anulada. Los retiros que cobraba volvieron a la cuenta abierta del cliente (el stock no se toca: sigue donde el cliente).`
          : `${folio} anulada. El stock volvió al inventario.`,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "YA_ANULADA") {
      return { error: "Esta factura ya fue anulada." };
    }
    console.error("[anularFactura] fallo inesperado:", e);
    return { error: "No se pudo anular la factura. Revisa el log del servidor." };
  }
}
