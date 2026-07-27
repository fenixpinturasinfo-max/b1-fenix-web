"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

async function requireVentas() {
  return exigirEscritura("ventas.pedidos");
}

interface LineaPedido {
  productoId: string;
  cantidad: number;
}

/** Crea un pedido de cliente (los precios se congelan desde la lista de venta). */
export async function crearPedido(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireVentas();

    const clienteId = String(formData.get("clienteId") ?? "") || null;
    let nombreCliente = String(formData.get("nombreCliente") ?? "").trim();
    const telefono = String(formData.get("telefono") ?? "").trim() || null;
    const nota = String(formData.get("nota") ?? "").trim() || null;
    const localId =
      esRolGlobal(session.rol)
        ? String(formData.get("localId") ?? "")
        : (session.localId ?? "");

    let lineas: LineaPedido[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Líneas inválidas." };
    }
    if (!localId) return { error: "Selecciona el local de retiro." };
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "Agrega al menos un producto." };
    }

    // Cliente de ficha o de paso
    if (clienteId) {
      const cliente = await prisma.socioNegocio.findUnique({ where: { id: clienteId } });
      if (!cliente || cliente.tipo !== "CLIENTE" || !cliente.activo) {
        return { error: "Cliente inválido." };
      }
      nombreCliente = cliente.nombreFantasia ?? cliente.razonSocial;
    }
    if (!nombreCliente) return { error: "Indica el nombre del cliente." };

    // Precios congelados desde la BD (nunca desde el navegador)
    const ids = [...new Set(lineas.map((l) => l.productoId))];
    const productos = await prisma.producto.findMany({
      where: { id: { in: ids }, activo: true },
    });
    const porId = new Map(productos.map((p) => [p.id, p]));

    const detalle: { productoId: string; cantidad: number; precioUnitario: number; subtotal: number }[] = [];
    for (const l of lineas) {
      const p = porId.get(l.productoId);
      const cantidad = Math.trunc(Number(l.cantidad));
      if (!p || cantidad <= 0) return { error: "Revisa los productos y cantidades." };
      detalle.push({
        productoId: p.id,
        cantidad,
        precioUnitario: p.precioVenta,
        subtotal: cantidad * p.precioVenta,
      });
    }
    const total = detalle.reduce((n, d) => n + d.subtotal, 0);

    const max = await prisma.pedidoCliente.aggregate({ _max: { correlativo: true } });
    const correlativo = (max._max?.correlativo ?? 0) + 1;

    await prisma.pedidoCliente.create({
      data: {
        correlativo,
        clienteId,
        nombreCliente,
        telefono,
        localId,
        nota,
        total,
        creadoPorId: session.sub,
        lineas: { create: detalle },
      },
    });

    revalidatePath("/dashboard/ventas/pedidos");
    return { ok: `Pedido PED-${String(correlativo).padStart(6, "0")} creado para ${nombreCliente}.` };
  } catch {
    return { error: "Error al crear el pedido." };
  }
}

/** Avanza el estado del pedido: preparar → entregar, o anular. */
export async function cambiarEstadoPedido(formData: FormData) {
  const session = await requireVentas();
  const id = String(formData.get("id") ?? "");
  const accion = String(formData.get("accion") ?? ""); // preparar | entregar | anular

  const pedido = await prisma.pedidoCliente.findUnique({ where: { id } });
  if (!pedido) return;
  if (!esRolGlobal(session.rol) && pedido.localId !== session.localId) return;

  const transiciones: Record<string, { desde: string[]; a: "PREPARADO" | "ENTREGADO" | "ANULADO" }> = {
    preparar: { desde: ["PENDIENTE"], a: "PREPARADO" },
    entregar: { desde: ["PENDIENTE", "PREPARADO"], a: "ENTREGADO" },
    anular: { desde: ["PENDIENTE", "PREPARADO"], a: "ANULADO" },
  };
  const t = transiciones[accion];
  if (!t || !t.desde.includes(pedido.estado)) return;

  await prisma.pedidoCliente.update({
    where: { id },
    data: {
      estado: t.a,
      entregadoEn: t.a === "ENTREGADO" ? new Date() : undefined,
    },
  });
  revalidatePath("/dashboard/ventas/pedidos");
  revalidatePath("/dashboard/ventas/partidas");
}
