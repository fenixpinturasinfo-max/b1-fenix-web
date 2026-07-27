import { getSession } from "@/lib/auth/session";
import { puedeVer } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";

/** Descarga la lista de precios de compra de un proveedor como CSV (Excel). */
export async function GET(req: Request) {
  const session = await getSession();
  // El CSV es la misma información que la pantalla: mismo permiso
  if (!session || !(await puedeVer(session.rol, "inventario.precios-compra"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const proveedorId = new URL(req.url).searchParams.get("proveedor") ?? "";
  const proveedor = await prisma.socioNegocio.findUnique({ where: { id: proveedorId } });
  if (!proveedor || proveedor.tipo !== "PROVEEDOR") {
    return new Response("Proveedor no encontrado", { status: 404 });
  }

  const [productos, precios] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      orderBy: { nombre: "asc" },
    }),
    prisma.precioCompraProveedor.findMany({ where: { proveedorId } }),
  ]);
  const precioDe = new Map(precios.map((p) => [p.productoId, p.precio]));

  const esc = (v: string | null) => `"${(v ?? "").replaceAll('"', '""')}"`;
  const filas = [
    "SKU;Producto;Marca;CPP referencia;Precio compra (neto)",
    ...productos.map((p) =>
      [
        esc(p.sku),
        esc(p.nombre),
        esc(p.marca),
        p.precioCosto,
        precioDe.get(p.id) ?? "",
      ].join(";"),
    ),
  ].join("\r\n");

  const nombre = (proveedor.nombreFantasia ?? proveedor.razonSocial)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(`﻿${filas}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="precios-compra-${nombre}-${hoy}.csv"`,
    },
  });
}
