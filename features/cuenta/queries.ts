import { prisma } from "@/lib/prisma";

/**
 * Consultas de la cuenta abierta.
 *
 * `esGlobal` es explícito, igual que en el resto del sistema: un usuario de local sin
 * local asignado no debe ver las cuentas de toda la cadena por accidente.
 */

export interface Alcance {
  esGlobal: boolean;
  localId: string | null;
}

export interface CuentaResumen {
  clienteId: string;
  nombre: string;
  rut: string;
  descuentoPorcentaje: number;
  nRetiros: number;
  total: number;
  /** Retiro abierto más antiguo: cuánto lleva la deuda en la calle. */
  desde: Date;
  locales: string[];
}

/** Clientes con retiros ABIERTOS, con su acumulado. Es la plata que está en la calle. */
export async function resumenCuentas(alcance: Alcance): Promise<CuentaResumen[]> {
  if (!alcance.esGlobal && !alcance.localId) return [];

  const retiros = await prisma.retiroCuenta.findMany({
    where: {
      estado: "ABIERTO",
      ...(alcance.localId ? { localId: alcance.localId } : {}),
    },
    select: {
      clienteId: true,
      total: true,
      creadoEn: true,
      cliente: {
        select: { razonSocial: true, nombreFantasia: true, rut: true, descuentoPorcentaje: true },
      },
      local: { select: { nombre: true } },
    },
    orderBy: { creadoEn: "asc" },
  });

  const porCliente = new Map<string, CuentaResumen>();
  for (const r of retiros) {
    const actual = porCliente.get(r.clienteId);
    if (actual) {
      actual.nRetiros += 1;
      actual.total += r.total;
      if (!actual.locales.includes(r.local.nombre)) actual.locales.push(r.local.nombre);
    } else {
      porCliente.set(r.clienteId, {
        clienteId: r.clienteId,
        nombre: r.cliente.nombreFantasia ?? r.cliente.razonSocial,
        rut: r.cliente.rut,
        descuentoPorcentaje: r.cliente.descuentoPorcentaje,
        nRetiros: 1,
        total: r.total,
        desde: r.creadoEn,
        locales: [r.local.nombre],
      });
    }
  }

  return [...porCliente.values()].sort((a, b) => b.total - a.total);
}

/** La cuenta de un cliente: retiros abiertos completos + los últimos ya resueltos. */
export async function cuentaDeCliente(clienteId: string, alcance: Alcance) {
  if (!alcance.esGlobal && !alcance.localId) return null;

  const cliente = await prisma.socioNegocio.findFirst({
    where: { id: clienteId, tipo: "CLIENTE" },
    select: {
      id: true,
      rut: true,
      razonSocial: true,
      nombreFantasia: true,
      descuentoPorcentaje: true,
      condicionPago: true,
      cuentaAbierta: true,
      activo: true,
    },
  });
  if (!cliente) return null;

  const filtroLocal = alcance.localId ? { localId: alcance.localId } : {};

  const [abiertos, recientes] = await Promise.all([
    prisma.retiroCuenta.findMany({
      where: { clienteId, estado: "ABIERTO", ...filtroLocal },
      include: {
        lineas: { include: { producto: { select: { nombre: true, sku: true } } } },
        local: { select: { id: true, nombre: true } },
        creadoPor: { select: { nombre: true } },
      },
      orderBy: { correlativo: "asc" },
    }),
    prisma.retiroCuenta.findMany({
      where: { clienteId, estado: { in: ["COBRADO", "ANULADO"] }, ...filtroLocal },
      include: {
        local: { select: { nombre: true } },
        venta: { select: { correlativo: true, local: { select: { codigo: true } } } },
        facturaVenta: { select: { id: true, correlativo: true } },
        anuladoPor: { select: { nombre: true } },
      },
      orderBy: { creadoEn: "desc" },
      take: 12,
    }),
  ]);

  return { cliente, abiertos, recientes };
}
