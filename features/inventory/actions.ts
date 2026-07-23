"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import { puedeAcceder } from "@/lib/auth/permissions";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireInventario() {
  const session = await getSession();
  if (!session || !puedeAcceder(session.rol, "inventario")) {
    throw new Error("No autorizado");
  }
  return session;
}

/** Valida que el usuario pueda operar sobre ese local. */
function validaLocal(session: { rol: string; localId: string | null }, localId: string) {
  if (session.rol === "ADMINISTRADOR") return true;
  return session.localId === localId;
}

export async function actualizarParametros(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();
    const productoId = String(formData.get("productoId") ?? "");
    const localId = String(formData.get("localId") ?? "");
    const stockMin = Number(formData.get("stockMin") ?? 0);
    const stockMaxRaw = String(formData.get("stockMax") ?? "");
    const ubicacion = String(formData.get("ubicacion") ?? "").trim() || null;

    if (!productoId || !localId) return { error: "Datos incompletos." };
    if (!validaLocal(session, localId)) return { error: "No puedes editar otro local." };
    if (stockMin < 0) return { error: "El stock mínimo no puede ser negativo." };
    const stockMax = stockMaxRaw === "" ? null : Number(stockMaxRaw);
    if (stockMax !== null && stockMax < stockMin) {
      return { error: "El stock máximo debe ser mayor o igual al mínimo." };
    }

    await prisma.stockLocal.upsert({
      where: { productoId_localId: { productoId, localId } },
      update: { stockMin, stockMax, ubicacion },
      create: { productoId, localId, cantidad: 0, stockMin, stockMax, ubicacion },
    });

    revalidatePath("/dashboard/inventario");
    return { ok: "Parámetros guardados." };
  } catch {
    return { error: "Error al guardar." };
  }
}

export async function registrarMovimiento(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireInventario();

    const tipo = String(formData.get("tipo") ?? "");
    const productoId = String(formData.get("productoId") ?? "");
    const localId = String(formData.get("localId") ?? "");
    const localDestinoId = String(formData.get("localDestinoId") ?? "");
    const cantidad = Math.abs(Math.trunc(Number(formData.get("cantidad") ?? 0)));
    const nota = String(formData.get("nota") ?? "").trim() || null;

    if (!productoId || !localId || cantidad <= 0) {
      return { error: "Selecciona producto, local y una cantidad válida." };
    }
    if (!validaLocal(session, localId)) return { error: "No puedes operar otro local." };

    if (tipo === "ENTRADA" || tipo === "AJUSTE_POSITIVO") {
      await prisma.$transaction([
        prisma.stockLocal.upsert({
          where: { productoId_localId: { productoId, localId } },
          update: { cantidad: { increment: cantidad } },
          create: { productoId, localId, cantidad },
        }),
        prisma.movimientoInventario.create({
          data: {
            tipo: tipo === "ENTRADA" ? "ENTRADA" : "AJUSTE",
            productoId,
            localId,
            cantidad,
            usuarioId: session.sub,
            nota,
          },
        }),
      ]);
    } else if (tipo === "AJUSTE_NEGATIVO" || tipo === "MERMA") {
      const stock = await prisma.stockLocal.findUnique({
        where: { productoId_localId: { productoId, localId } },
      });
      if (!stock || stock.cantidad < cantidad) {
        return { error: `Stock insuficiente (disponible: ${stock?.cantidad ?? 0}).` };
      }
      await prisma.$transaction([
        prisma.stockLocal.update({
          where: { productoId_localId: { productoId, localId } },
          data: { cantidad: { decrement: cantidad } },
        }),
        prisma.movimientoInventario.create({
          data: {
            tipo: tipo === "MERMA" ? "MERMA" : "AJUSTE",
            productoId,
            localId,
            cantidad: -cantidad,
            usuarioId: session.sub,
            nota,
          },
        }),
      ]);
    } else if (tipo === "TRANSFERENCIA") {
      if (!localDestinoId || localDestinoId === localId) {
        return { error: "Selecciona un local de destino distinto." };
      }
      const stock = await prisma.stockLocal.findUnique({
        where: { productoId_localId: { productoId, localId } },
      });
      if (!stock || stock.cantidad < cantidad) {
        return { error: `Stock insuficiente para transferir (disponible: ${stock?.cantidad ?? 0}).` };
      }
      await prisma.$transaction(async (tx) => {
        await tx.stockLocal.update({
          where: { productoId_localId: { productoId, localId } },
          data: { cantidad: { decrement: cantidad } },
        });
        await tx.stockLocal.upsert({
          where: { productoId_localId: { productoId, localId: localDestinoId } },
          update: { cantidad: { increment: cantidad } },
          create: { productoId, localId: localDestinoId, cantidad },
        });
        const salida = await tx.movimientoInventario.create({
          data: {
            tipo: "TRANSFERENCIA_SALIDA",
            productoId,
            localId,
            cantidad: -cantidad,
            usuarioId: session.sub,
            nota,
          },
        });
        await tx.movimientoInventario.create({
          data: {
            tipo: "TRANSFERENCIA_ENTRADA",
            productoId,
            localId: localDestinoId,
            cantidad,
            usuarioId: session.sub,
            transferenciaPar: salida.id,
            nota,
          },
        });
      });
    } else {
      return { error: "Tipo de movimiento inválido." };
    }

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/movimientos");
    return { ok: "Movimiento registrado." };
  } catch {
    return { error: "Error al registrar el movimiento." };
  }
}
