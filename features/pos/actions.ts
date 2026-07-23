"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { puedeAcceder } from "@/lib/auth/permissions";

export interface ActionState {
  error?: string;
  ok?: string;
  ventaCorrelativo?: string;
  ventaId?: string;
}

async function requirePos() {
  const session = await getSession();
  if (!session || !puedeAcceder(session.rol, "pos")) {
    throw new Error("No autorizado");
  }
  return session;
}

function resolverLocal(
  session: { rol: string; localId: string | null },
  localIdForm: string,
): string | null {
  if (session.rol === "ADMINISTRADOR") return localIdForm || null;
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
      include: { ventas: { where: { estado: "COMPLETADA", medioPago: "EFECTIVO" } } },
    });
    if (!caja || caja.estado !== "ABIERTA" || caja.usuarioId !== session.sub) {
      return { error: "Caja no encontrada o ya cerrada." };
    }

    const ventasEfectivo = caja.ventas.reduce((n, v) => n + v.total, 0);
    const montoEsperado = caja.montoApertura + ventasEfectivo;

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
    let subtotal = 0;
    for (const l of lineas) {
      const p = porId.get(l.productoId)!;
      const qty = Math.trunc(l.cantidad);
      if (qty <= 0) return { error: "Cantidades inválidas." };
      subtotal += p.precioVenta * qty;
    }

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
          detalle: {
            create: lineas.map((l) => {
              const p = porId.get(l.productoId)!;
              return {
                productoId: l.productoId,
                cantidad: l.cantidad,
                precioUnitario: p.precioVenta,
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
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("STOCK:")) {
      return { error: `Stock insuficiente: ${msg.slice(6)}` };
    }
    return { error: "Error al registrar la venta." };
  }
}
