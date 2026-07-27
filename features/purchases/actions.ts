"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { esRolGlobal } from "@/lib/auth/permissions";
import { exigirEscritura } from "@/lib/auth/guards";

export interface ActionState {
  error?: string;
  ok?: string;
}

/** Compras abarca varias secciones: cada acción declara sobre cuál opera. */
async function requireCompras(seccion: string) {
  return exigirEscritura(seccion);
}

interface LineaOC {
  productoId: string;
  cantidad: number;
  costoUnitario: number;
}

/** Crea una Orden de Compra (estado ENVIADA) y redirige a su detalle. */
export async function crearOC(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireCompras("compras.ordenes");

  const proveedorId = String(formData.get("proveedorId") ?? "");
  const localDestinoId =
    esRolGlobal(session.rol)
      ? String(formData.get("localDestinoId") ?? "")
      : (session.localId ?? "");
  const nota = String(formData.get("nota") ?? "").trim() || null;
  let lineas: LineaOC[];
  try {
    lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
  } catch {
    return { error: "Líneas inválidas." };
  }

  if (!proveedorId || !localDestinoId) return { error: "Selecciona proveedor y local de destino." };
  if (!Array.isArray(lineas) || lineas.length === 0) return { error: "Agrega al menos una línea." };
  for (const l of lineas) {
    if (!l.productoId || Math.trunc(l.cantidad) <= 0 || Math.trunc(l.costoUnitario) < 0) {
      return { error: "Revisa cantidades y costos de las líneas." };
    }
  }

  const proveedor = await prisma.socioNegocio.findUnique({ where: { id: proveedorId } });
  if (!proveedor || !proveedor.activo || proveedor.tipo !== "PROVEEDOR") {
    return { error: "Proveedor inválido." };
  }

  // Documentos base (estilo SAP B1): solicitudes de compra copiadas a esta OC
  let solicitudIds: string[] = [];
  try {
    const raw = JSON.parse(String(formData.get("solicitudIds") ?? "[]"));
    if (Array.isArray(raw)) solicitudIds = raw.filter((s) => typeof s === "string");
  } catch {
    /* sin documentos base */
  }

  // Fechas (YYYY-MM-DD) — mediodía UTC para evitar corrimiento de día
  const parseFecha = (raw: string): Date | null => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const d = new Date(`${raw}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  const fechaRequerida = parseFecha(String(formData.get("fechaRequerida") ?? "").trim());
  // Fecha de entrega comprometida por el proveedor (opcional)
  const fechaEntrega = parseFecha(String(formData.get("fechaEntrega") ?? "").trim());

  const max = await prisma.ordenCompra.aggregate({ _max: { correlativo: true } });
  const correlativo = (max._max.correlativo ?? 0) + 1;

  const oc = await prisma.$transaction(async (tx) => {
    const nueva = await tx.ordenCompra.create({
      data: {
        correlativo,
        proveedorId,
        localDestinoId,
        fechaRequerida,
        fechaEntrega,
        nota,
        creadoPorId: session.sub,
        lineas: {
          create: lineas.map((l) => ({
            productoId: l.productoId,
            cantidad: Math.trunc(l.cantidad),
            costoUnitario: Math.trunc(l.costoUnitario),
          })),
        },
      },
    });

    // Cerrar y vincular las solicitudes base → arrastre de información
    if (solicitudIds.length > 0) {
      await tx.solicitudReposicion.updateMany({
        where: {
          id: { in: solicitudIds },
          destino: "PROVEEDOR",
          estado: { in: ["PENDIENTE", "COTIZADA"] },
          proveedorId,
        },
        data: {
          estado: "DESPACHADA",
          ordenCompraId: nueva.id,
          resueltoPorId: session.sub,
          resueltoEn: new Date(),
          notaResolucion: `Copiada a OC-${String(correlativo).padStart(6, "0")}`,
        },
      });
    }

    return nueva;
  });

  revalidatePath("/dashboard/compras");
  revalidatePath("/dashboard/solicitudes");
  redirect(`/dashboard/compras/${oc.id}`);
}

/** Anula una OC sin recepciones. */
export async function anularOC(formData: FormData) {
  const session = await requireCompras("compras.ordenes");
  const id = String(formData.get("id") ?? "");
  const oc = await prisma.ordenCompra.findUnique({ where: { id }, include: { lineas: true } });
  if (!oc || oc.estado === "ANULADA") return;
  if (!esRolGlobal(session.rol) && session.localId !== oc.localDestinoId) return;
  const recibido = oc.lineas.some((l) => l.cantidadRecibida > 0);
  if (recibido) return;
  await prisma.ordenCompra.update({ where: { id }, data: { estado: "ANULADA" } });
  revalidatePath("/dashboard/compras");
  revalidatePath(`/dashboard/compras/${id}`);
}

const IVA = 0.19;

function vencimientoDesde(fechaEmision: Date, condicionPago: string | null): Date | null {
  if (!condicionPago || condicionPago === "CONTADO") return fechaEmision;
  const dias = { "30D": 30, "60D": 60, "90D": 90 }[condicionPago];
  if (!dias) return null;
  const v = new Date(fechaEmision);
  v.setDate(v.getDate() + dias);
  return v;
}

/**
 * Factura una OC completa. Dos caminos:
 * - OC totalmente recibida → solo registra la factura (cuentas por pagar).
 * - Con pendientes + "recepción directa" → recepciona lo pendiente (stock + CPP) y factura.
 */
export async function facturarOC(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireCompras("compras.facturas");
    const ocId = String(formData.get("ocId") ?? "");
    const numero = String(formData.get("numero") ?? "").trim();
    const fechaEmisionRaw = String(formData.get("fechaEmision") ?? "");
    const recepcionDirecta = formData.get("recepcionDirecta") === "on";

    if (!numero) return { error: "Ingresa el número de factura del proveedor." };
    const fechaEmision = fechaEmisionRaw ? new Date(fechaEmisionRaw + "T12:00:00") : new Date();

    const oc = await prisma.ordenCompra.findUnique({
      where: { id: ocId },
      include: { lineas: { include: { producto: true } }, proveedor: true, factura: true },
    });
    if (!oc || oc.estado === "ANULADA") return { error: "OC no disponible." };
    if (oc.factura) return { error: "Esta OC ya tiene factura registrada." };
    if (!esRolGlobal(session.rol) && session.localId !== oc.localDestinoId) {
      return { error: "Solo el local de destino puede facturar." };
    }

    const pendientes = oc.lineas.filter((l) => l.cantidad > l.cantidadRecibida);
    if (pendientes.length > 0 && !recepcionDirecta) {
      return {
        error: "Hay mercadería sin recepcionar: recepciónala primero o marca 'recepción directa'.",
      };
    }

    const neto = oc.lineas.reduce((n, l) => n + l.cantidad * l.costoUnitario, 0);
    const iva = Math.round(neto * IVA);
    const total = neto + iva;

    const correlativoFC = await prisma.$transaction(async (tx) => {
      // Camino 2: recepcionar lo pendiente como parte de la factura
      if (pendientes.length > 0 && recepcionDirecta) {
        const maxE = await tx.entradaCompra.aggregate({ _max: { correlativo: true } });
        const entrada = await tx.entradaCompra.create({
          data: {
            correlativo: (maxE._max.correlativo ?? 0) + 1,
            ordenCompraId: oc.id,
            proveedorId: oc.proveedorId,
            localId: oc.localDestinoId,
            numeroGuia: `Factura ${numero}`,
            recibidoPorId: session.sub,
          },
        });
        for (const linea of pendientes) {
          const cant = linea.cantidad - linea.cantidadRecibida;
          const agg = await tx.stockLocal.aggregate({
            where: { productoId: linea.productoId },
            _sum: { cantidad: true },
          });
          const stockTotal = Math.max(agg._sum.cantidad ?? 0, 0);
          const costoActual = linea.producto.precioCosto;
          const nuevoCosto =
            stockTotal <= 0 || costoActual <= 0
              ? linea.costoUnitario
              : Math.round(
                  (stockTotal * costoActual + cant * linea.costoUnitario) / (stockTotal + cant),
                );

          await tx.entradaCompraLinea.create({
            data: {
              entradaId: entrada.id,
              productoId: linea.productoId,
              cantidad: cant,
              costoUnitario: linea.costoUnitario,
            },
          });
          await tx.ordenCompraLinea.update({
            where: { id: linea.id },
            data: { cantidadRecibida: linea.cantidad },
          });
          await tx.stockLocal.upsert({
            where: {
              productoId_localId: { productoId: linea.productoId, localId: oc.localDestinoId },
            },
            update: { cantidad: { increment: cant } },
            create: { productoId: linea.productoId, localId: oc.localDestinoId, cantidad: cant },
          });
          await tx.movimientoInventario.create({
            data: {
              tipo: "ENTRADA",
              productoId: linea.productoId,
              localId: oc.localDestinoId,
              cantidad: cant,
              usuarioId: session.sub,
              nota: `OC-${String(oc.correlativo).padStart(6, "0")} · Factura ${numero} (recepción directa)`,
            },
          });
          await tx.producto.update({
            where: { id: linea.productoId },
            data: { precioCosto: nuevoCosto },
          });
          // Lista de precios de compra: último precio pactado con este proveedor
          await tx.precioCompraProveedor.upsert({
            where: {
              proveedorId_productoId: {
                proveedorId: oc.proveedorId,
                productoId: linea.productoId,
              },
            },
            update: { precio: linea.costoUnitario, origen: `Factura ${numero}` },
            create: {
              proveedorId: oc.proveedorId,
              productoId: linea.productoId,
              precio: linea.costoUnitario,
              origen: `Factura ${numero}`,
            },
          });
        }
      }

      const maxF = await tx.facturaCompra.aggregate({ _max: { correlativo: true } });
      const factura = await tx.facturaCompra.create({
        data: {
          correlativo: (maxF._max.correlativo ?? 0) + 1,
          numero,
          ordenCompraId: oc.id,
          proveedorId: oc.proveedorId,
          esRecepcionDirecta: pendientes.length > 0 && recepcionDirecta,
          neto,
          iva,
          total,
          fechaEmision,
          fechaVencimiento: vencimientoDesde(fechaEmision, oc.proveedor.condicionPago),
          creadoPorId: session.sub,
          lineas: {
            create: oc.lineas.map((l) => ({
              productoId: l.productoId,
              cantidad: l.cantidad,
              costoUnitario: l.costoUnitario,
            })),
          },
        },
      });

      await tx.ordenCompra.update({ where: { id: oc.id }, data: { estado: "CERRADA" } });
      return factura.correlativo;
    });

    revalidatePath("/dashboard/compras");
    revalidatePath(`/dashboard/compras/${ocId}`);
    revalidatePath("/dashboard/compras/facturas");
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    return { ok: `Factura FC-${String(correlativoFC).padStart(6, "0")} registrada. OC cerrada.` };
  } catch {
    return { error: "Error al registrar la factura." };
  }
}

/**
 * Guarda (o borra, si se deja vacío) el precio de compra manual
 * de un producto para un proveedor.
 */
export async function guardarPrecioCompra(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireCompras("inventario.precios-compra");
    const proveedorId = String(formData.get("proveedorId") ?? "");
    const productoId = String(formData.get("productoId") ?? "");
    const precioRaw = String(formData.get("precio") ?? "").trim();

    if (!proveedorId || !productoId) return { error: "Datos incompletos." };

    // Vacío = quitar el precio de la lista
    if (precioRaw === "") {
      await prisma.precioCompraProveedor.deleteMany({ where: { proveedorId, productoId } });
      revalidatePath("/dashboard/compras/precios");
      return { ok: "Precio eliminado." };
    }

    const precio = Math.trunc(Number(precioRaw));
    if (!Number.isFinite(precio) || precio < 0) return { error: "Precio inválido." };

    await prisma.precioCompraProveedor.upsert({
      where: { proveedorId_productoId: { proveedorId, productoId } },
      update: { precio, origen: "Manual" },
      create: { proveedorId, productoId, precio, origen: "Manual" },
    });

    revalidatePath("/dashboard/compras/precios");
    return { ok: "Precio guardado." };
  } catch {
    return { error: "Error al guardar el precio." };
  }
}

/**
 * Importación masiva de precios de compra de UN proveedor desde CSV.
 * Recibe líneas ya parseadas [{sku, precio}] y hace upsert por proveedor+SKU.
 */
export async function importarPreciosCompra(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requireCompras("inventario.precios-compra");
    const proveedorId = String(formData.get("proveedorId") ?? "");
    let lineas: { sku: string; precio: number }[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Archivo inválido." };
    }
    if (!proveedorId) return { error: "Proveedor no indicado." };
    if (!Array.isArray(lineas) || lineas.length === 0) {
      return { error: "El archivo no tiene filas con precios." };
    }
    if (lineas.length > 1000) return { error: "Máximo 1.000 filas por importación." };

    const proveedor = await prisma.socioNegocio.findUnique({ where: { id: proveedorId } });
    if (!proveedor || !proveedor.activo || proveedor.tipo !== "PROVEEDOR") {
      return { error: "Proveedor inválido." };
    }

    const [productos, existentes] = await Promise.all([
      prisma.producto.findMany({ select: { id: true, sku: true } }),
      prisma.precioCompraProveedor.findMany({ where: { proveedorId } }),
    ]);
    const porSku = new Map(productos.map((p) => [p.sku.toUpperCase(), p.id]));
    const precioActual = new Map(existentes.map((e) => [e.productoId, e.precio]));

    // Consolidar filas válidas con cambio real (1 por producto, gana la última)
    const cambios = new Map<string, number>();
    let sinCambio = 0;
    let omitidas = 0;
    for (const l of lineas) {
      const sku = String(l.sku ?? "").trim().toUpperCase();
      const precio = Math.trunc(Number(l.precio));
      const productoId = sku ? porSku.get(sku) : undefined;
      if (!productoId || !Number.isFinite(precio) || precio <= 0) {
        omitidas++;
        continue;
      }
      if (precioActual.get(productoId) === precio) {
        sinCambio++;
        continue;
      }
      cambios.set(productoId, precio);
    }

    // 2 consultas en vez de N upserts (Neon: cada round-trip cuesta ~200 ms)
    if (cambios.size > 0) {
      const ids = [...cambios.keys()];
      await prisma.$transaction([
        prisma.precioCompraProveedor.deleteMany({
          where: { proveedorId, productoId: { in: ids } },
        }),
        prisma.precioCompraProveedor.createMany({
          data: ids.map((productoId) => ({
            proveedorId,
            productoId,
            precio: cambios.get(productoId)!,
            origen: "Import CSV",
          })),
        }),
      ]);
    }
    const actualizados = cambios.size;

    revalidatePath("/dashboard/compras/precios");
    return {
      ok: `${actualizados} precio${actualizados === 1 ? "" : "s"} actualizado${
        actualizados === 1 ? "" : "s"
      } para ${proveedor.nombreFantasia ?? proveedor.razonSocial} · ${sinCambio} sin cambio${
        omitidas > 0 ? ` · ${omitidas} filas omitidas` : ""
      }.`,
    };
  } catch {
    return { error: "Error al importar los precios de compra." };
  }
}

/** Marca una factura como pagada. */
export async function marcarFacturaPagada(formData: FormData) {
  const session = await requireCompras("compras.facturas");
  if (!esRolGlobal(session.rol) && session.rol !== "JEFE_LOCAL") return;
  const id = String(formData.get("id") ?? "");
  const factura = await prisma.facturaCompra.findUnique({ where: { id } });
  if (!factura || factura.estado !== "ABIERTA") return;
  await prisma.facturaCompra.update({ where: { id }, data: { estado: "PAGADA" } });
  revalidatePath("/dashboard/compras/facturas");
}

/** Nota de crédito por devolución: baja stock y rebaja la deuda registrada. */
export async function crearNotaCredito(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireCompras("compras.notas-credito");
    const facturaId = String(formData.get("facturaId") ?? "");
    const motivo = String(formData.get("motivo") ?? "").trim();
    let lineas: { productoId: string; cantidad: number }[];
    try {
      lineas = JSON.parse(String(formData.get("lineas") ?? "[]"));
    } catch {
      return { error: "Líneas inválidas." };
    }

    if (!motivo) return { error: "Indica el motivo de la devolución." };
    const efectivas = lineas
      .map((l) => ({ ...l, cantidad: Math.trunc(l.cantidad) }))
      .filter((l) => l.cantidad > 0);
    if (efectivas.length === 0) return { error: "Indica al menos una cantidad a devolver." };

    const factura = await prisma.facturaCompra.findUnique({
      where: { id: facturaId },
      include: {
        lineas: { include: { producto: true } },
        ordenCompra: true,
        notasCredito: { include: { lineas: true } },
      },
    });
    if (!factura || factura.estado === "ANULADA") return { error: "Factura no disponible." };
    if (!esRolGlobal(session.rol) && session.localId !== factura.ordenCompra.localDestinoId) {
      return { error: "Solo el local de destino puede registrar la devolución." };
    }

    const localId = factura.ordenCompra.localDestinoId;

    // Máximo devolvible = facturado − ya devuelto en NCs anteriores
    for (const l of efectivas) {
      const fLinea = factura.lineas.find((x) => x.productoId === l.productoId);
      if (!fLinea) return { error: "Producto no pertenece a la factura." };
      const yaDevuelto = factura.notasCredito
        .flatMap((nc) => nc.lineas)
        .filter((x) => x.productoId === l.productoId)
        .reduce((n, x) => n + x.cantidad, 0);
      if (l.cantidad > fLinea.cantidad - yaDevuelto) {
        return {
          error: `${fLinea.producto.nombre}: máximo devolvible ${fLinea.cantidad - yaDevuelto}.`,
        };
      }
      const stock = await prisma.stockLocal.findUnique({
        where: { productoId_localId: { productoId: l.productoId, localId } },
      });
      if (!stock || stock.cantidad < l.cantidad) {
        return { error: `${fLinea.producto.nombre}: stock insuficiente para devolver (${stock?.cantidad ?? 0}).` };
      }
    }

    const correlativoNC = await prisma.$transaction(async (tx) => {
      const netoNC = efectivas.reduce((n, l) => {
        const fl = factura.lineas.find((x) => x.productoId === l.productoId)!;
        return n + l.cantidad * fl.costoUnitario;
      }, 0);
      const totalNC = netoNC + Math.round(netoNC * IVA);

      const maxNC = await tx.notaCredito.aggregate({ _max: { correlativo: true } });
      const nc = await tx.notaCredito.create({
        data: {
          correlativo: (maxNC._max.correlativo ?? 0) + 1,
          facturaId,
          motivo,
          total: totalNC,
          creadoPorId: session.sub,
          lineas: {
            create: efectivas.map((l) => ({
              productoId: l.productoId,
              cantidad: l.cantidad,
              costoUnitario: factura.lineas.find((x) => x.productoId === l.productoId)!.costoUnitario,
            })),
          },
        },
      });

      for (const l of efectivas) {
        await tx.stockLocal.update({
          where: { productoId_localId: { productoId: l.productoId, localId } },
          data: { cantidad: { decrement: l.cantidad } },
        });
        await tx.movimientoInventario.create({
          data: {
            tipo: "AJUSTE",
            productoId: l.productoId,
            localId,
            cantidad: -l.cantidad,
            usuarioId: session.sub,
            nota: `NC-${String(nc.correlativo).padStart(6, "0")} · Devolución a proveedor (Factura ${factura.numero})`,
          },
        });
      }
      return nc.correlativo;
    });

    revalidatePath("/dashboard/compras/facturas");
    revalidatePath(`/dashboard/compras/facturas/${facturaId}`);
    revalidatePath("/dashboard/inventario");
    return { ok: `Nota de crédito NC-${String(correlativoNC).padStart(6, "0")} registrada. Stock rebajado.` };
  } catch {
    return { error: "Error al registrar la nota de crédito." };
  }
}

/**
 * Recepciona (total o parcialmente) una OC: crea la Entrada/Guía, sube stock,
 * registra movimientos y recalcula el Costo Promedio Ponderado del producto.
 */
export async function recepcionarOC(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const session = await requireCompras("compras.entradas");
    const ocId = String(formData.get("ocId") ?? "");
    const numeroGuia = String(formData.get("numeroGuia") ?? "").trim() || null;
    let recepciones: { lineaId: string; cantidad: number }[];
    try {
      recepciones = JSON.parse(String(formData.get("recepciones") ?? "[]"));
    } catch {
      return { error: "Recepción inválida." };
    }

    const oc = await prisma.ordenCompra.findUnique({
      where: { id: ocId },
      include: { lineas: { include: { producto: true } } },
    });
    if (!oc || oc.estado === "ANULADA" || oc.estado === "CERRADA") {
      return { error: "OC no disponible para recepción." };
    }
    if (!esRolGlobal(session.rol) && session.localId !== oc.localDestinoId) {
      return { error: "Solo el local de destino puede recepcionar." };
    }

    // Validar cantidades contra lo pendiente
    const efectivas = recepciones
      .map((r) => ({ ...r, cantidad: Math.trunc(r.cantidad) }))
      .filter((r) => r.cantidad > 0);
    if (efectivas.length === 0) return { error: "Indica al menos una cantidad a recibir." };

    for (const r of efectivas) {
      const linea = oc.lineas.find((l) => l.id === r.lineaId);
      if (!linea) return { error: "Línea inválida." };
      const pendiente = linea.cantidad - linea.cantidadRecibida;
      if (r.cantidad > pendiente) {
        return { error: `${linea.producto.nombre}: máximo pendiente ${pendiente}.` };
      }
    }

    const correlativoEntrada = await prisma.$transaction(async (tx) => {
      const maxE = await tx.entradaCompra.aggregate({ _max: { correlativo: true } });
      const entrada = await tx.entradaCompra.create({
        data: {
          correlativo: (maxE._max.correlativo ?? 0) + 1,
          ordenCompraId: oc.id,
          proveedorId: oc.proveedorId,
          localId: oc.localDestinoId,
          numeroGuia,
          recibidoPorId: session.sub,
        },
      });

      for (const r of efectivas) {
        const linea = oc.lineas.find((l) => l.id === r.lineaId)!;

        // ── CPP: stock total (todos los locales) ANTES de esta recepción ──
        const agg = await tx.stockLocal.aggregate({
          where: { productoId: linea.productoId },
          _sum: { cantidad: true },
        });
        const stockTotal = Math.max(agg._sum.cantidad ?? 0, 0);
        const costoActual = linea.producto.precioCosto;
        const nuevoCosto =
          stockTotal <= 0 || costoActual <= 0
            ? linea.costoUnitario
            : Math.round(
                (stockTotal * costoActual + r.cantidad * linea.costoUnitario) /
                  (stockTotal + r.cantidad),
              );

        await tx.entradaCompraLinea.create({
          data: {
            entradaId: entrada.id,
            productoId: linea.productoId,
            cantidad: r.cantidad,
            costoUnitario: linea.costoUnitario,
          },
        });
        await tx.ordenCompraLinea.update({
          where: { id: linea.id },
          data: { cantidadRecibida: { increment: r.cantidad } },
        });
        await tx.stockLocal.upsert({
          where: {
            productoId_localId: { productoId: linea.productoId, localId: oc.localDestinoId },
          },
          update: { cantidad: { increment: r.cantidad } },
          create: { productoId: linea.productoId, localId: oc.localDestinoId, cantidad: r.cantidad },
        });
        await tx.movimientoInventario.create({
          data: {
            tipo: "ENTRADA",
            productoId: linea.productoId,
            localId: oc.localDestinoId,
            cantidad: r.cantidad,
            usuarioId: session.sub,
            nota: `OC-${String(oc.correlativo).padStart(6, "0")}${numeroGuia ? ` · Guía ${numeroGuia}` : ""}`,
          },
        });
        await tx.producto.update({
          where: { id: linea.productoId },
          data: { precioCosto: nuevoCosto },
        });
        // Lista de precios de compra: último precio pactado con este proveedor
        await tx.precioCompraProveedor.upsert({
          where: {
            proveedorId_productoId: {
              proveedorId: oc.proveedorId,
              productoId: linea.productoId,
            },
          },
          update: {
            precio: linea.costoUnitario,
            origen: `EC-${String(entrada.correlativo).padStart(6, "0")}`,
          },
          create: {
            proveedorId: oc.proveedorId,
            productoId: linea.productoId,
            precio: linea.costoUnitario,
            origen: `EC-${String(entrada.correlativo).padStart(6, "0")}`,
          },
        });
      }

      // Estado de la OC según lo recibido
      const lineasActuales = await tx.ordenCompraLinea.findMany({
        where: { ordenCompraId: oc.id },
      });
      const completa = lineasActuales.every((l) => l.cantidadRecibida >= l.cantidad);
      await tx.ordenCompra.update({
        where: { id: oc.id },
        data: { estado: completa ? "RECIBIDA" : "RECIBIDA_PARCIAL" },
      });

      return entrada.correlativo;
    });

    revalidatePath("/dashboard/compras");
    revalidatePath(`/dashboard/compras/${ocId}`);
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/precios");
    return {
      ok: `Entrada EC-${String(correlativoEntrada).padStart(6, "0")} registrada. Stock y costo promedio actualizados.`,
    };
  } catch {
    return { error: "Error al recepcionar." };
  }
}
