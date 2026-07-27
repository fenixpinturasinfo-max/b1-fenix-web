import { puedeVer } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Descarga la lista de precios de venta como CSV (Excel). */
export async function GET() {
  const session = await getSession();
  if (!session || !(await puedeVer(session.rol, "inventario.precios-venta"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const productos = await prisma.producto.findMany({
    where: { activo: true },
    include: { categoria: true },
    orderBy: [{ categoria: { nombre: "asc" } }, { nombre: "asc" }],
  });

  const esc = (v: string | null) => `"${(v ?? "").replaceAll('"', '""')}"`;
  const filas = [
    "SKU;Codigo de barra;Producto;Marca;Categoria;Precio costo (CPP);Precio venta",
    ...productos.map((p) =>
      [
        esc(p.sku),
        esc(p.codigoBarra),
        esc(p.nombre),
        esc(p.marca),
        esc(p.categoria.nombre),
        p.precioCosto,
        p.precioVenta,
      ].join(";"),
    ),
  ].join("\r\n");

  const hoy = new Date().toISOString().slice(0, 10);
  // BOM para que Excel abra el UTF-8 con tildes correctas
  return new Response(`﻿${filas}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lista-precios-fenix-${hoy}.csv"`,
    },
  });
}
