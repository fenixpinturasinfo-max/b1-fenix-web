"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import { resolverDescuento } from "@/features/descuentos/resolver";
import { montoDesdePorcentaje } from "@/lib/descuento";
import { formatCLP } from "@/lib/format";
import { instanteSantiago, partesSantiago } from "@/lib/fechas";
import { esCondicionValida, totalesFactura, vencimientoDesde } from "@/features/sales/factura";

/**
 * Cuenta abierta: retiros a cuenta y su cobro consolidado.
 *
 * El patrón es Entrega → Factura (SAP B1): **el retiro mueve el inventario, el cobro solo
 * cobra**. Cada retiro rebaja stock al momento y congela precio y costo del día; la
 * boleta o factura que consolida el período no vuelve a tocar el stock. Si alguna de las
 * dos cosas se hiciera dos veces —o ninguna— el inventario mentiría, así que las dos
 * mitades viven en este archivo, una al lado de la otra.
 */

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireCuenta() {
  return exigirEscritura("ventas.cuenta");
}

function resolverLocal(
  session: { rol: string; localId: string | null },
  localIdForm: string,
): string | null {
  if (esRolGlobal(session.rol)) return localIdForm || null;
  return session.localId;
}

function validaLocal(session: { rol: string; localId: string | null }, localId: string) {
  return esRolGlobal(session.rol) || session.localId === localId;
}

const folioRC = (n: number) => `RC-${String(n).padStart(6, "0")}`;

interface LineaForm {
  productoId: string;
  cantidad: number;
}

// ─────────────── Registrar retiro ───────────────

/**
 * Registra un retiro a cuenta: el cliente se lleva la mercadería ahora y paga al cierre.
 *
 * **Rebaja stock de inmediato.** La pintura ya no está en la estantería, está en la obra
 * del cliente; si el sistema la siguiera contando, las alertas de mínimo, las tomas de
 * inventario y el catálogo del POS mentirían todo el período. Los precios y costos se
 * congelan acá: lo retirado el lunes se cobra al precio del lunes.
 */
export async function registrarRetiro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireCuenta();

    const clienteId = String(formData.get("clienteId") ?? "");
    const localId = resolverLocal(session, String(formData.get("localId") ?? ""));
    const nota = String(formData.get("nota") ?? "").trim().slice(0, 200) || null;

    let lineas: LineaForm[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Líneas inválidas." };
    }

    if (!clienteId) return { error: "Selecciona el cliente." };
    if (!localId) return { error: "Local inválido." };
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "Agrega al menos un producto." };
    }
    if (new Set(lineas.map((l) => l.productoId)).size !== lineas.length) {
      return { error: "Hay un producto repetido. Consolida su cantidad en una línea." };
    }
    for (const l of lineas) {
      l.cantidad = Math.trunc(Number(l.cantidad));
      if (!Number.isFinite(l.cantidad) || l.cantidad <= 0) {
        return { error: "Hay cantidades inválidas." };
      }
    }

    // La cuenta abierta es crédito informal: solo fichas donde alguien la activó a propósito.
    const cliente = await prisma.socioNegocio.findFirst({
      where: { id: clienteId, tipo: "CLIENTE", activo: true },
      select: { id: true, razonSocial: true, nombreFantasia: true, cuentaAbierta: true },
    });
    if (!cliente) return { error: "El cliente no existe o está inactivo." };
    if (!cliente.cuentaAbierta) {
      return {
        error: `${cliente.nombreFantasia ?? cliente.razonSocial} no tiene cuenta abierta. Actívala en su ficha de Socios.`,
      };
    }

    // Precios reales desde la BD, nunca del cliente
    const productos = await prisma.producto.findMany({
      where: { id: { in: lineas.map((l) => l.productoId) }, activo: true },
      select: { id: true, nombre: true, sku: true, precioVenta: true, precioCosto: true },
    });
    if (productos.length !== lineas.length) {
      return { error: "Hay productos inválidos o inactivos. Recarga la página." };
    }
    const porId = new Map(productos.map((p) => [p.id, p]));
    const total = lineas.reduce(
      (n, l) => n + porId.get(l.productoId)!.precioVenta * l.cantidad,
      0,
    );

    const creado = await prisma.$transaction(async (tx) => {
      const max = await tx.retiroCuenta.aggregate({ _max: { correlativo: true } });
      const correlativo = (max._max.correlativo ?? 0) + 1;

      const retiro = await tx.retiroCuenta.create({
        data: {
          correlativo,
          clienteId,
          localId,
          total,
          nota,
          creadoPorId: session.sub,
          lineas: {
            create: lineas.map((l) => {
              const p = porId.get(l.productoId)!;
              return {
                productoId: l.productoId,
                cantidad: l.cantidad,
                // Congelados al retirar: el cobro del viernes usa el precio de hoy
                precioUnitario: p.precioVenta,
                costoUnitario: p.precioCosto,
                subtotal: p.precioVenta * l.cantidad,
              };
            }),
          },
        },
        select: { id: true, correlativo: true },
      });

      for (const l of lineas) {
        // Decremento condicionado: si otra venta se cuela entre la lectura y esta
        // escritura, el stock no queda negativo.
        const bajado = await tx.stockLocal.updateMany({
          where: { productoId: l.productoId, localId, cantidad: { gte: l.cantidad } },
          data: { cantidad: { decrement: l.cantidad } },
        });
        if (bajado.count !== 1) {
          throw new Error(`STOCK:${porId.get(l.productoId)!.sku}`);
        }
        // SALIDA_VENTA a propósito: para el inventario esto ES una venta; el vínculo
        // `retiroCuentaId` la distingue sin enseñarle un tipo nuevo a cada pantalla.
        await tx.movimientoInventario.create({
          data: {
            tipo: "SALIDA_VENTA",
            productoId: l.productoId,
            localId,
            cantidad: -l.cantidad,
            usuarioId: session.sub,
            retiroCuentaId: retiro.id,
            nota: `${folioRC(retiro.correlativo)} · retiro a cuenta`,
          },
        });
      }

      return retiro;
    });

    revalidatePath("/dashboard/ventas/cuenta");
    revalidatePath(`/dashboard/ventas/cuenta/${clienteId}`);
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    return {
      ok: `Retiro ${folioRC(creado.correlativo)} registrado por ${formatCLP(total)}. El stock ya salió del local.`,
    };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("STOCK:")) {
      return {
        error: `Stock insuficiente para ${e.message.slice(6)}. Nada se guardó: revisa y vuelve a intentar.`,
      };
    }
    console.error("[registrarRetiro] fallo inesperado:", e);
    return { error: "No se pudo registrar el retiro." };
  }
}

// ─────────────── Anular retiro ───────────────

/**
 * Anula un retiro ABIERTO y **devuelve el stock** con movimientos espejo.
 * Un retiro ya cobrado no se anula por acá: se corrige anulando la boleta o factura
 * que lo cobró, que es donde vive la plata.
 */
export async function anularRetiro(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireCuenta();
    const retiroId = String(formData.get("retiroId") ?? "");
    const motivo = String(formData.get("motivo") ?? "").trim();

    if (motivo.length < 5) {
      return { error: "Escribe el motivo de la anulación (mínimo 5 caracteres)." };
    }

    const retiro = await prisma.retiroCuenta.findUnique({
      where: { id: retiroId },
      select: {
        id: true,
        correlativo: true,
        estado: true,
        localId: true,
        clienteId: true,
        lineas: { select: { productoId: true, cantidad: true } },
      },
    });
    if (!retiro) return { error: "Retiro no encontrado." };
    if (retiro.estado === "ANULADO") return { error: "Este retiro ya está anulado." };
    if (retiro.estado === "COBRADO") {
      return { error: "Este retiro ya se cobró: anula la boleta o factura que lo cobró." };
    }
    if (!validaLocal(session, retiro.localId)) {
      return { error: "No puedes anular un retiro de otro local." };
    }

    const folio = folioRC(retiro.correlativo);

    await prisma.$transaction(async (tx) => {
      const anulado = await tx.retiroCuenta.updateMany({
        where: { id: retiro.id, estado: "ABIERTO" },
        data: {
          estado: "ANULADO",
          anuladoPorId: session.sub,
          anuladoEn: new Date(),
          motivoAnulacion: motivo,
        },
      });
      if (anulado.count !== 1) throw new Error("CARRERA");

      for (const l of retiro.lineas) {
        await tx.stockLocal.upsert({
          where: { productoId_localId: { productoId: l.productoId, localId: retiro.localId } },
          update: { cantidad: { increment: l.cantidad } },
          create: { productoId: l.productoId, localId: retiro.localId, cantidad: l.cantidad },
        });
        await tx.movimientoInventario.create({
          data: {
            tipo: "ENTRADA",
            productoId: l.productoId,
            localId: retiro.localId,
            cantidad: l.cantidad,
            usuarioId: session.sub,
            retiroCuentaId: retiro.id,
            nota: `Anulación ${folio} · ${motivo}`,
          },
        });
      }
    });

    revalidatePath("/dashboard/ventas/cuenta");
    revalidatePath(`/dashboard/ventas/cuenta/${retiro.clienteId}`);
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    return { ok: `${folio} anulado. El stock volvió al inventario.` };
  } catch (e) {
    if (e instanceof Error && e.message === "CARRERA") {
      return { error: "Alguien más modificó este retiro. Recarga la página." };
    }
    console.error("[anularRetiro] fallo inesperado:", e);
    return { error: "No se pudo anular el retiro." };
  }
}

// ─────────────── Cobro consolidado ───────────────

const MEDIOS = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"] as const;
type Medio = (typeof MEDIOS)[number];

/**
 * Consolida retiros ABIERTOS del cliente en una boleta o una factura.
 *
 * **No mueve stock**: eso ya lo hizo cada retiro. El descuento pactado del cliente entra
 * como piso pre-autorizado y encima corre el flujo de siempre (tramo, vale presencial o
 * aprobación por correo). El período lo decide quien cobra: se consolida lo que esté
 * seleccionado, sea la semana, la quincena o el mes.
 *
 * La boleta en efectivo exige caja abierta en el local de los retiros: el billete tiene
 * que caer en un cajón que después se arquee. Débito, crédito y transferencia pueden ir
 * sin caja (si hay una abierta en el local correcto, la boleta igual se cuelga del turno).
 */
export async function cobrarRetiros(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireCuenta();

    const tipo = String(formData.get("tipo") ?? "");
    const clienteId = String(formData.get("clienteId") ?? "");
    let retiroIds: string[];
    try {
      retiroIds = JSON.parse(String(formData.get("retiroIds") ?? "[]"));
    } catch {
      return { error: "Selección inválida." };
    }
    if (tipo !== "BOLETA" && tipo !== "FACTURA") return { error: "Elige boleta o factura." };
    if (!Array.isArray(retiroIds) || retiroIds.length === 0) {
      return { error: "Selecciona al menos un retiro." };
    }

    const retiros = await prisma.retiroCuenta.findMany({
      where: { id: { in: retiroIds }, estado: "ABIERTO" },
      include: { lineas: true },
      orderBy: { correlativo: "asc" },
    });
    if (retiros.length !== retiroIds.length) {
      return { error: "Algún retiro ya fue cobrado o anulado. Recarga la página." };
    }
    if (retiros.some((r) => r.clienteId !== clienteId)) {
      return { error: "Hay retiros de otro cliente en la selección." };
    }
    const localId = retiros[0].localId;
    if (retiros.some((r) => r.localId !== localId)) {
      return { error: "Los retiros seleccionados son de locales distintos: cobra por local." };
    }
    if (!validaLocal(session, localId)) {
      return { error: "No puedes cobrar retiros de otro local." };
    }

    const cliente = await prisma.socioNegocio.findFirst({
      where: { id: clienteId, tipo: "CLIENTE", activo: true },
      select: {
        id: true,
        razonSocial: true,
        nombreFantasia: true,
        descuentoPorcentaje: true,
        condicionPago: true,
      },
    });
    if (!cliente) return { error: "El cliente no existe o está inactivo." };

    // Base a precios congelados: la boleta la lee IVA incluido, la factura como neto
    // (la misma convención del resto del sistema).
    const lineasCobro = retiros.flatMap((r) => r.lineas);
    const base = lineasCobro.reduce((n, l) => n + l.subtotal, 0);
    const descuentoCliente = montoDesdePorcentaje(base, cliente.descuentoPorcentaje);

    const resuelto = await resolverDescuento({
      base,
      pedido: Math.round(Number(formData.get("descuento") ?? 0)),
      vale: String(formData.get("valeDescuento") ?? ""),
      operador: { id: session.sub, rol: session.rol },
      descuentoCliente,
    });
    if (!resuelto.ok) return { error: resuelto.error };

    const { descuento, autorizadorId: descuentoAutorizadoPorId } = resuelto.valor;
    const descuentoMotivo =
      descuento > 0
        ? String(formData.get("descuentoMotivo") ?? "").trim().slice(0, 120) ||
          (descuentoAutorizadoPorId === null
            ? `Pactado cliente ${cliente.descuentoPorcentaje}%`
            : null)
        : null;

    const folios = retiros.map((r) => folioRC(r.correlativo)).join(", ");

    if (tipo === "BOLETA") {
      const medioPago = String(formData.get("medioPago") ?? "") as Medio;
      if (!MEDIOS.includes(medioPago)) return { error: "Selecciona el medio de pago." };

      const caja = await prisma.cajaSesion.findFirst({
        where: { usuarioId: session.sub, estado: "ABIERTA" },
        select: { id: true, localId: true },
      });
      const cajaDelLocal = caja && caja.localId === localId ? caja : null;
      if (medioPago === "EFECTIVO" && !cajaDelLocal) {
        return {
          error:
            "El efectivo debe entrar a una caja abierta del mismo local de los retiros. Abre caja ahí, o cobra con otro medio de pago.",
        };
      }

      const total = base - descuento;

      const creada = await prisma.$transaction(async (tx) => {
        const max = await tx.venta.aggregate({
          where: { localId },
          _max: { correlativo: true },
        });
        const correlativo = (max._max.correlativo ?? 0) + 1;

        const venta = await tx.venta.create({
          data: {
            correlativo,
            localId,
            usuarioId: session.sub,
            // Sin caja (medios electrónicos) la boleta no afecta ningún arqueo.
            cajaSesionId: cajaDelLocal?.id ?? null,
            clienteId,
            medioPago,
            subtotal: base,
            descuento,
            descuentoAutorizadoPorId,
            descuentoMotivo,
            total,
            detalle: {
              // Una línea por línea de retiro, sin consolidar por producto: si el precio
              // cambió a mitad de período, cada retiro conserva el suyo.
              create: lineasCobro.map((l) => ({
                productoId: l.productoId,
                cantidad: l.cantidad,
                precioUnitario: l.precioUnitario,
                costoUnitario: l.costoUnitario,
                subtotal: l.subtotal,
              })),
            },
          },
          select: { id: true, correlativo: true },
        });

        // SIN movimientos de inventario: el stock salió con cada retiro.

        const cobrados = await tx.retiroCuenta.updateMany({
          where: { id: { in: retiroIds }, estado: "ABIERTO" },
          data: { estado: "COBRADO", ventaId: venta.id, cobradoEn: new Date() },
        });
        if (cobrados.count !== retiros.length) throw new Error("CARRERA");

        const local = await tx.local.findUnique({ where: { id: localId } });
        return { folio: `${local?.codigo ?? ""}-${String(correlativo).padStart(6, "0")}` };
      });

      revalidatePath("/dashboard/ventas/cuenta");
      revalidatePath(`/dashboard/ventas/cuenta/${clienteId}`);
      revalidatePath("/dashboard/pos");
      revalidatePath("/dashboard/pos/boletas");
      return {
        ok: `Boleta ${creada.folio} emitida por ${formatCLP(base - descuento)}. Cobra ${folios}; el stock no se movió (ya había salido con cada retiro).`,
      };
    }

    // ── FACTURA ──
    const condicionPago = String(formData.get("condicionPago") ?? "") || cliente.condicionPago || "CONTADO";
    if (!esCondicionValida(condicionPago)) return { error: "Condición de pago inválida." };

    const p = partesSantiago();
    const fechaEmision = instanteSantiago(p.year, p.month, p.day, 12);
    const { neto, iva, total, descuento: rebaja } = totalesFactura(
      lineasCobro.map((l) => ({ cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      descuento,
    );
    const fechaVencimiento = vencimientoDesde(fechaEmision, condicionPago);

    const creada = await prisma.$transaction(async (tx) => {
      const max = await tx.facturaVenta.aggregate({ _max: { correlativo: true } });
      const correlativo = (max._max.correlativo ?? 0) + 1;

      const factura = await tx.facturaVenta.create({
        data: {
          correlativo,
          clienteId,
          localId,
          neto,
          descuento: rebaja,
          descuentoAutorizadoPorId,
          descuentoMotivo,
          iva,
          total,
          fechaEmision,
          condicionPago,
          fechaVencimiento,
          nota: `Cobro cuenta abierta: ${folios}`,
          creadoPorId: session.sub,
          lineas: {
            create: lineasCobro.map((l) => ({
              productoId: l.productoId,
              cantidad: l.cantidad,
              precioUnitario: l.precioUnitario,
              subtotal: l.subtotal,
              costoUnitario: l.costoUnitario,
            })),
          },
        },
        select: { id: true, correlativo: true },
      });

      // SIN movimientos de inventario: el stock salió con cada retiro.

      const cobrados = await tx.retiroCuenta.updateMany({
        where: { id: { in: retiroIds }, estado: "ABIERTO" },
        data: { estado: "COBRADO", facturaVentaId: factura.id, cobradoEn: new Date() },
      });
      if (cobrados.count !== retiros.length) throw new Error("CARRERA");

      return factura;
    });

    revalidatePath("/dashboard/ventas/cuenta");
    revalidatePath(`/dashboard/ventas/cuenta/${clienteId}`);
    revalidatePath("/dashboard/ventas/facturas");
    return {
      ok: `Factura FV-${String(creada.correlativo).padStart(6, "0")} emitida por ${formatCLP(total)} (neto ${formatCLP(neto)} + IVA). Cobra ${folios}; el stock no se movió.`,
    };
  } catch (e) {
    if (e instanceof Error && e.message === "CARRERA") {
      return { error: "Alguien más cobró estos retiros al mismo tiempo. Recarga la página." };
    }
    console.error("[cobrarRetiros] fallo inesperado:", e);
    return { error: "No se pudo generar el cobro. Nada se guardó." };
  }
}
