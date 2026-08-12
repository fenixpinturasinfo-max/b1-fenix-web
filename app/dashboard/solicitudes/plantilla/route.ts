import ExcelJS from "exceljs";
import { puedeVer } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/**
 * Plantilla .xlsx para armar una solicitud de compra desde Excel.
 *
 * A diferencia de la plantilla de productos —que se llena desde cero— esta baja **con el
 * catálogo ya listado**: el comprador solo completa la Cantidad de lo que quiere pedir y
 * ajusta el precio si el proveedor cotizó otro valor. Las filas sin cantidad se ignoran
 * al subir, así que no hay que borrar nada.
 *
 * `?proveedor=<id>` precarga el precio desde la lista de ese proveedor; sin el parámetro
 * (o para productos sin precio de lista) va el costo promedio. Es el mismo criterio de
 * sugerencia que usa la grilla de la pantalla.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !(await puedeVer(session.rol, "compras.solicitudes"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const proveedorId = new URL(request.url).searchParams.get("proveedor");

  const [productos, proveedor, precioRows] = await Promise.all([
    prisma.producto.findMany({
      where: { activo: true },
      orderBy: [{ marca: "asc" }, { nombre: "asc" }],
      select: { id: true, sku: true, nombre: true, marca: true, precioCosto: true },
    }),
    proveedorId
      ? prisma.socioNegocio.findFirst({
          where: { id: proveedorId, tipo: "PROVEEDOR" },
          select: { razonSocial: true, nombreFantasia: true },
        })
      : null,
    proveedorId
      ? prisma.precioCompraProveedor.findMany({
          where: { proveedorId },
          select: { productoId: true, precio: true },
        })
      : [],
  ]);
  const precioDeLista = new Map(precioRows.map((p) => [p.productoId, p.precio]));
  const nombreProveedor = proveedor ? (proveedor.nombreFantasia ?? proveedor.razonSocial) : null;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pinturas Fenix";
  workbook.created = new Date();

  // ── Hoja de instrucciones ──
  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 95 }];
  const lineas = [
    "Solicitud de compra desde Excel — Pinturas Fenix",
    "",
    "1. La hoja \"Solicitud\" trae el catálogo completo. Completa la columna CANTIDAD solo en los productos que quieres pedir.",
    "2. Las filas sin cantidad (o con 0) se ignoran al subir: no necesitas borrar nada.",
    "3. El precio viene sugerido " +
      (nombreProveedor
        ? `desde la lista de ${nombreProveedor} (o el costo promedio si no tiene precio de lista).`
        : "desde el costo promedio (descarga la plantilla con un proveedor elegido para traer su lista)."),
    "   Ajústalo si te cotizaron otro valor; si lo borras, el sistema vuelve a sugerirlo al cargar.",
    "4. No cambies la columna SKU: es la llave con que el sistema reconoce cada producto.",
    "5. Guarda en formato .xlsx (no lo conviertas a CSV) y súbelo en \"Cargar Excel\" dentro de Nueva Solicitud de Compra.",
    "6. Al subir, las líneas llenan la grilla para que las revises: nada se envía hasta que aprietes \"Crear solicitud\".",
  ];
  lineas.forEach((l, i) => {
    const row = instrucciones.getRow(i + 1);
    row.getCell(1).value = l;
    if (i === 0) row.getCell(1).font = { bold: true, size: 14, color: { argb: "FF0B3B66" } };
  });

  // ── Hoja de solicitud ──
  const hoja = workbook.addWorksheet("Solicitud");
  hoja.columns = [
    { header: "SKU", key: "sku", width: 16 },
    { header: "Producto", key: "nombre", width: 40 },
    { header: "Marca", key: "marca", width: 18 },
    { header: "Cantidad", key: "cantidad", width: 12 },
    { header: "Precio compra (neto)", key: "precio", width: 20 },
  ];
  const header = hoja.getRow(1);
  header.font = { bold: true, color: { argb: "FF0B3B66" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EEF7" } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];
  hoja.autoFilter = "A1:E1";

  for (const p of productos) {
    const fila = hoja.addRow({
      sku: p.sku,
      nombre: p.nombre,
      marca: p.marca,
      cantidad: "",
      precio: precioDeLista.get(p.id) ?? p.precioCosto,
    });
    // La cantidad es lo único que el comprador debe tocar: se destaca para guiar el ojo.
    fila.getCell(4).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF7E6" },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const hoy = new Date().toISOString().slice(0, 10);
  const sufijo = nombreProveedor
    ? `-${nombreProveedor.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`
    : "";
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="solicitud-compra${sufijo}-${hoy}.xlsx"`,
    },
  });
}
