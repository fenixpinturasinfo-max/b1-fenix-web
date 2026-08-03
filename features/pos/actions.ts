"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";
import { esperadoEnCaja, TIPOS_MOV, type TipoMovCaja } from "./caja";
import { formatCLP } from "@/lib/format";

export interface ActionState {
  error?: string;
  ok?: string;
  ventaCorrelativo?: string;
  ventaId?: string;
  /** Total realmente cobrado, recalculado desde la BD. El cliente no debe suponerlo. */
  ventaTotal?: number;
}

/** Operar la caja exige nivel Total en Ventas › POS. */
async function requirePos() {
  return exigirEscritura("ventas.pos");
}

function resolverLocal(
  session: { rol: string; localId: string | null },
  localIdForm: string,
): string | null {
  if (esRolGlobal(session.rol)) return localIdForm || null;
  return session.localId;
}

// ─────────────── Caja ───────────────

export async function abrirCaja(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requirePos();
    const localId = resolverLocal(session, String(formData.get("localId") ?? ""));
    const montoApertura = Math.trunc(Number(formData.get("montoApertura") ?? -1));

    if (!localId) return { error: "Local inválido." };
    if (montoApertura < 0 || Number.isNaN(montoApertura)) {
      return { error: "Ingresa el efectivo inicial (puede ser 0)." };
    }

    const abierta = await prisma.cajaSesion.findFirst({
      where: { localId, usuarioId: session.sub, estado: "ABIERTA" },
    });
    if (abierta) return { error: "Ya tienes una caja abierta en este local." };

    await prisma.cajaSesion.create({
      data: { localId, usuarioId: session.sub, montoApertura },
    });

    revalidatePath("/dashboard/pos");
    return { ok: "Caja abierta." };
  } catch {
    return { error: "Error al abrir la caja." };
  }
}

/**
 * Registra un movimiento de efectivo del turno (sangría, gasto o ingreso).
 * Solo el dueño de la caja: es su arqueo el que queda afectado.
 */
export async function registrarMovimientoCaja(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requirePos();
    const cajaId = String(formData.get("cajaId") ?? "");
    const tipo = String(formData.get("tipo") ?? "") as TipoMovCaja;
    const monto = Math.trunc(Number(formData.get("monto") ?? 0));
    const motivo = String(formData.get("motivo") ?? "").trim();

    if (!TIPOS_MOV.some((t) => t.valor === tipo)) return { error: "Tipo inválido." };
    if (!Number.isFinite(monto) || monto <= 0) return { error: "Ingresa un monto mayor a 0." };
    if (motivo.length < 3) return { error: "Escribe el motivo: sin él nadie puede auditarlo." };

    const caja = await prisma.cajaSesion.findUnique({
      where: { id: cajaId },
      include: {
        ventas: { where: { estado: "COMPLETADA", medioPago: "EFECTIVO" } },
        movimientos: true,
      },
    });
    if (!caja || caja.estado !== "ABIERTA" || caja.usuarioId !== session.sub) {
      return { error: "Caja no encontrada o ya cerrada." };
    }

    // Validar y crear en la misma transacción: dos envíos simultáneos pasarían los dos
    // el chequeo y dejarían la caja en negativo. Es la única invariante de dinero acá.
    const resultado = await prisma.$transaction(async (tx) => {
      if (tipo !== "INGRESO") {
        const [ventas, movs] = await Promise.all([
          tx.venta.findMany({
            where: { cajaSesionId: caja.id, estado: "COMPLETADA", medioPago: "EFECTIVO" },
            select: { total: true },
          }),
          tx.movimientoCaja.findMany({ where: { cajaSesionId: caja.id } }),
        ]);
        const disponible = esperadoEnCaja(
          caja.montoApertura,
          ventas.reduce((n, v) => n + v.total, 0),
          movs,
        );
        if (monto > disponible) return { error: disponible };
      }
      await tx.movimientoCaja.create({
        data: { cajaSesionId: caja.id, tipo, monto, motivo, usuarioId: session.sub },
      });
      return null;
    });

    if (resultado) {
      return { error: `Solo hay ${formatCLP(resultado.error)} en efectivo en la caja.` };
    }

    revalidatePath("/dashboard/pos");
    return { ok: "Movimiento registrado." };
  } catch {
    return { error: "Error al registrar el movimiento." };
  }
}

export async function cerrarCaja(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requirePos();
    const cajaId = String(formData.get("cajaId") ?? "");
    const montoCierre = Math.trunc(Number(formData.get("montoCierre") ?? -1));
    const notaCierre = String(formData.get("notaCierre") ?? "").trim() || null;

    if (montoCierre < 0 || Number.isNaN(montoCierre)) {
      return { error: "Ingresa el efectivo contado." };
    }

    const caja = await prisma.cajaSesion.findUnique({
      where: { id: cajaId },
      include: {
        ventas: { where: { estado: "COMPLETADA", medioPago: "EFECTIVO" } },
        movimientos: true,
      },
    });
    if (!caja || caja.estado !== "ABIERTA" || caja.usuarioId !== session.sub) {
      return { error: "Caja no encontrada o ya cerrada." };
    }

    const ventasEfectivo = caja.ventas.reduce((n, v) => n + v.total, 0);
    const montoEsperado = esperadoEnCaja(caja.montoApertura, ventasEfectivo, caja.movimientos);

    await prisma.cajaSesion.update({
      where: { id: caja.id },
      data: {
        estado: "CERRADA",
        montoCierre,
        montoEsperado,
        diferencia: montoCierre - montoEsperado,
        notaCierre,
        cerradaEn: new Date(),
      },
    });

    revalidatePath("/dashboard/pos");
    return { ok: "Caja cerrada." };
  } catch {
    return { error: "Error al cerrar la caja." };
  }
}

// ─────────────── Boleta por correo ───────────────

export async function enviarBoletaEmail(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requirePos();
    const ventaId = String(formData.get("ventaId") ?? "");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();

    if (!ventaId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return { error: "Ingresa un correo válido." };
    }

    const venta = await prisma.venta.findUnique({
      where: { id: ventaId },
      include: {
        local: true,
        usuario: true,
        detalle: { include: { producto: true } },
      },
    });
    if (!venta) return { error: "Boleta no encontrada." };
    if (!esRolGlobal(session.rol) && venta.localId !== session.localId) {
      return { error: "No autorizado." };
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { error: "Envío por correo no configurado (falta RESEND_API_KEY)." };
    }

    const clp = new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    });
    const folio = `${venta.local.codigo}-${String(venta.correlativo).padStart(6, "0")}`;
    const filas = venta.detalle
      .map(
        (d) => `<tr>
          <td style="padding:6px 0;border-top:1px solid #eee;">${d.producto.nombre}<br>
            <span style="color:#888;font-size:12px;">${clp.format(d.precioUnitario)} c/u</span></td>
          <td style="padding:6px 0;border-top:1px solid #eee;text-align:center;">${d.cantidad}</td>
          <td style="padding:6px 0;border-top:1px solid #eee;text-align:right;"><b>${clp.format(d.subtotal)}</b></td>
        </tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;color:#101828;">
        <div style="text-align:center;padding:16px 0;">
          <h2 style="margin:0;">PINTURAS FENIX</h2>
          <p style="margin:4px 0;color:#555;">${venta.local.nombre}<br>
          <span style="font-size:12px;">${venta.local.direccion}, ${venta.local.comuna}</span></p>
        </div>
        <div style="text-align:center;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc;padding:12px 0;margin-bottom:12px;">
          <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;">Boleta de venta</p>
          <p style="margin:4px 0;font-size:26px;font-weight:bold;font-family:monospace;">${folio}</p>
          <p style="margin:0;font-size:12px;color:#888;">${new Intl.DateTimeFormat("es-CL", { dateStyle: "long", timeStyle: "short", timeZone: "America/Santiago" }).format(venta.creadoEn)}<br>Atendido por ${venta.usuario.nombre}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="color:#888;font-size:12px;text-transform:uppercase;">
            <th align="left">Producto</th><th>Cant</th><th align="right">Subtotal</th>
          </tr>
          ${filas}
        </table>
        <div style="border-top:1px dashed #ccc;margin-top:12px;padding-top:10px;font-size:14px;">
          <p style="display:flex;justify-content:space-between;margin:4px 0;">
            <span style="font-size:18px;font-weight:bold;">TOTAL &nbsp;</span>
            <span style="font-size:18px;font-weight:bold;float:right;">${clp.format(venta.total)}</span>
          </p>
          <p style="margin:4px 0;color:#555;">Medio de pago: ${venta.medioPago.toLowerCase()}</p>
        </div>
        <p style="text-align:center;color:#aaa;font-size:12px;margin-top:24px;">
          ¡Gracias por tu compra! · Instagram @pinturas.fenix
        </p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Pinturas Fenix <onboarding@resend.dev>",
        to: [email],
        subject: `Boleta ${folio} · Pinturas Fenix`,
        html,
      }),
    });

    if (!res.ok) {
      return { error: "No se pudo enviar el correo. Revisa la configuración de Resend." };
    }

    // Registro para estadísticas de envío
    await prisma.emailBoleta.create({ data: { ventaId: venta.id, email } });

    return { ok: `Boleta enviada a ${email}.` };
  } catch {
    return { error: "Error al enviar la boleta." };
  }
}

// ─────────────── Venta ───────────────

interface LineaVenta {
  productoId: string;
  cantidad: number;
}

const MEDIOS = ["EFECTIVO", "DEBITO", "CREDITO", "TRANSFERENCIA"] as const;
type Medio = (typeof MEDIOS)[number];

export async function registrarVenta(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requirePos();

    const cajaId = String(formData.get("cajaId") ?? "");
    const medioPago = String(formData.get("medioPago") ?? "") as Medio;
    // Marca comercial: no entra en ningún cálculo, así que no hay nada que validar
    // más allá de su presencia. El total lo sigue definiendo la lista de precios.
    const premium = formData.get("premium") === "on";
    let lineas: LineaVenta[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Carro inválido." };
    }

    if (!MEDIOS.includes(medioPago)) return { error: "Selecciona el medio de pago." };
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "El carro está vacío." };
    }

    const caja = await prisma.cajaSesion.findUnique({ where: { id: cajaId } });
    if (!caja || caja.estado !== "ABIERTA" || caja.usuarioId !== session.sub) {
      return { error: "Necesitas una caja abierta para vender." };
    }
    const localId = caja.localId;

    // Precios reales desde la BD (nunca del cliente)
    const ids = lineas.map((l) => l.productoId);
    const productos = await prisma.producto.findMany({
      where: { id: { in: ids }, activo: true },
    });
    if (productos.length !== ids.length) return { error: "Hay productos inválidos en el carro." };

    const porId = new Map(productos.map((p) => [p.id, p]));
    // Se normaliza acá y se reemplaza la lista: si no, el descuento de stock y el detalle
    // usarían la cantidad cruda del cliente y el total no cuadraría con sus líneas.
    for (const l of lineas) {
      l.cantidad = Math.trunc(l.cantidad);
      if (l.cantidad <= 0) return { error: "Cantidades inválidas." };
    }
    const subtotal = lineas.reduce(
      (n, l) => n + porId.get(l.productoId)!.precioVenta * l.cantidad,
      0,
    );

    const resultado = await prisma.$transaction(async (tx) => {
      // Verificar y descontar stock
      for (const l of lineas) {
        const stock = await tx.stockLocal.findUnique({
          where: { productoId_localId: { productoId: l.productoId, localId } },
        });
        if (!stock || stock.cantidad < l.cantidad) {
          throw new Error(
            `STOCK:${porId.get(l.productoId)!.nombre} (disponible: ${stock?.cantidad ?? 0})`,
          );
        }
        await tx.stockLocal.update({
          where: { productoId_localId: { productoId: l.productoId, localId } },
          data: { cantidad: { decrement: l.cantidad } },
        });
      }

      // Correlativo por local
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
          cajaSesionId: caja.id,
          medioPago,
          subtotal,
          total: subtotal,
          premium,
          detalle: {
            create: lineas.map((l) => {
              const p = porId.get(l.productoId)!;
              return {
                productoId: l.productoId,
                cantidad: l.cantidad,
                precioUnitario: p.precioVenta,
                // Costo congelado: el margen histórico no debe cambiar si mañana sube el costo
                costoUnitario: p.precioCosto,
                subtotal: p.precioVenta * l.cantidad,
              };
            }),
          },
        },
      });

      // Movimientos de inventario por la venta
      for (const l of lineas) {
        await tx.movimientoInventario.create({
          data: {
            tipo: "SALIDA_VENTA",
            productoId: l.productoId,
            localId,
            cantidad: -l.cantidad,
            usuarioId: session.sub,
            ventaId: venta.id,
          },
        });
      }

      const local = await tx.local.findUnique({ where: { id: localId } });
      return {
        folio: `${local?.codigo ?? ""}-${String(correlativo).padStart(6, "0")}`,
        ventaId: venta.id,
      };
    });

    revalidatePath("/dashboard/pos");
    revalidatePath("/dashboard/inventario");
    return {
      ok: "Venta registrada.",
      ventaCorrelativo: resultado.folio,
      ventaId: resultado.ventaId,
      ventaTotal: subtotal,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("STOCK:")) {
      return { error: `Stock insuficiente: ${msg.slice(6)}` };
    }
    return { error: "Error al registrar la venta." };
  }
}
