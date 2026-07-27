"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

// El permiso lo define el perfil sobre cada sección (Configuración › Perfiles).
// Ocultar el botón no basta: la acción se puede llamar igual desde la consola.

/** Valida que el usuario pueda operar sobre ese local. */
function validaLocal(session: { rol: string; localId: string | null }, localId: string) {
  if (esRolGlobal(session.rol)) return true;
  return session.localId === localId;
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/** Crea un producto nuevo. El catálogo es compartido por todos los locales y la tienda online. */
export async function crearProducto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.productos");

    const nombre = String(formData.get("nombre") ?? "").trim();
    const marca = String(formData.get("marca") ?? "").trim();
    const categoriaId = String(formData.get("categoriaId") ?? "");
    const skuRaw = String(formData.get("sku") ?? "").trim().toUpperCase();
    const codigoBarra = String(formData.get("codigoBarra") ?? "").trim() || null;
    const precioVenta = Math.trunc(Number(formData.get("precioVenta") ?? 0));
    const precioCosto = Math.trunc(Number(formData.get("precioCosto") ?? 0));
    const imagen = String(formData.get("imagen") ?? "").trim() || null;

    if (!nombre || !marca || !categoriaId || precioVenta <= 0) {
      return { error: "Completa nombre, marca, categoría y precio de venta." };
    }
    if (precioCosto < 0) return { error: "El precio costo no puede ser negativo." };
    if (imagen && !imagen.startsWith("http") && !imagen.startsWith("/")) {
      return { error: "La imagen debe ser una URL (https://…) o ruta local (/productos/…)." };
    }

    // SKU: usa el ingresado o genera uno a partir de marca + correlativo
    let sku = skuRaw;
    if (!sku) {
      const prefijo = marca.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "PRD";
      const count = await prisma.producto.count({ where: { sku: { startsWith: prefijo } } });
      sku = `${prefijo}-${String(count + 1).padStart(3, "0")}`;
    }
    const skuExiste = await prisma.producto.findUnique({ where: { sku } });
    if (skuExiste) return { error: `El SKU ${sku} ya existe (${skuExiste.nombre}).` };

    if (codigoBarra) {
      const cbExiste = await prisma.producto.findUnique({ where: { codigoBarra } });
      if (cbExiste) return { error: `El código de barra ya está asignado a ${cbExiste.nombre}.` };
    }

    // Slug único
    let slug = slugify(nombre);
    if (await prisma.producto.findUnique({ where: { slug } })) {
      slug = `${slug}-${sku.toLowerCase()}`;
    }

    const producto = await prisma.producto.create({
      data: { nombre, marca, categoriaId, sku, codigoBarra, slug, precioVenta, precioCosto, imagen },
    });

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    revalidatePath("/dashboard/pos"); // el POS cachea la grilla de precios
    return { ok: `Producto creado: ${producto.nombre} (SKU ${producto.sku}). Ingresa su stock con un movimiento de Entrada.` };
  } catch {
    return { error: "Error al crear el producto." };
  }
}

/** Edita la ficha maestra. Afecta a todos los locales y a la tienda online. */
export async function editarProducto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await exigirEscritura("inventario.productos");

    const productoId = String(formData.get("productoId") ?? "");
    const nombre = String(formData.get("nombre") ?? "").trim();
    const marca = String(formData.get("marca") ?? "").trim();
    const categoriaId = String(formData.get("categoriaId") ?? "");
    const codigoBarra = String(formData.get("codigoBarra") ?? "").trim() || null;
    const precioVenta = Math.trunc(Number(formData.get("precioVenta") ?? 0));
    const precioCosto = Math.trunc(Number(formData.get("precioCosto") ?? 0));
    const imagen = String(formData.get("imagen") ?? "").trim() || null;
    const activo = formData.get("activo") === "on";

    if (!productoId) return { error: "Producto no indicado." };
    if (!nombre || !marca || !categoriaId || precioVenta <= 0) {
      return { error: "Completa nombre, marca, categoría y precio de venta." };
    }
    if (precioCosto < 0) return { error: "El precio costo no puede ser negativo." };
    if (imagen && !imagen.startsWith("http") && !imagen.startsWith("/")) {
      return { error: "La imagen debe ser una URL (https://…) o ruta local (/productos/…)." };
    }

    if (codigoBarra) {
      const cbExiste = await prisma.producto.findUnique({ where: { codigoBarra } });
      if (cbExiste && cbExiste.id !== productoId) {
        return { error: `El código de barra ya está asignado a ${cbExiste.nombre}.` };
      }
    }

    await prisma.producto.update({
      where: { id: productoId },
      data: { nombre, marca, categoriaId, codigoBarra, precioVenta, precioCosto, imagen, activo },
    });

    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    revalidatePath("/dashboard/pos"); // el POS cachea la grilla de precios
    revalidatePath("/");
    return { ok: `Producto actualizado${activo ? "" : " y desactivado (oculto en POS y tienda)"}.` };
  } catch {
    return { error: "Error al editar el producto." };
  }
}

export async function actualizarParametros(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await exigirEscritura("inventario.productos");
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
    const session = await exigirEscritura("inventario.registrar");

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
