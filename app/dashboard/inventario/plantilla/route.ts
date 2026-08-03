import ExcelJS from "exceljs";
import { puedeVer } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

/** Cuántas filas de la plantilla llevan los desplegables de Categoría/Marca/Destacado. */
const FILAS_CON_VALIDACION = 300;

/** Descarga la plantilla .xlsx para cargar productos de forma masiva. */
export async function GET() {
  const session = await getSession();
  if (!session || !(await puedeVer(session.rol, "inventario.productos"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const [categorias, marcasProductos] = await Promise.all([
    prisma.categoria.findMany({ orderBy: { nombre: "asc" } }),
    prisma.producto.findMany({
      distinct: ["marca"],
      select: { marca: true },
      orderBy: { marca: "asc" },
    }),
  ]);
  const nombresCategorias = categorias.map((c) => c.nombre);
  const nombresMarcas = marcasProductos.map((m) => m.marca).slice(0, 80);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pinturas Fenix";
  workbook.created = new Date();

  // ── Hoja de instrucciones ──
  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 95 }];
  const lineas = [
    "Carga masiva de productos — Pinturas Fenix",
    "",
    "1. Completa la hoja \"Productos\" (una fila por producto). Borra la fila de ejemplo antes de subir el archivo.",
    "2. Columnas obligatorias: Nombre, Marca, Categoría, Precio venta.",
    "3. SKU: déjalo vacío para que el sistema lo genere automáticamente.",
    "4. Categoría: elige una opción del desplegable de la columna E. Si escribes una categoría que no existe, esa fila quedará marcada como error al importar.",
    "5. Si el SKU que escribes ya existe en el catálogo, esa fila actualiza el producto en vez de crear uno nuevo.",
    "6. Precio anterior: complétalo solo si quieres mostrar una oferta (debe ser mayor al precio de venta).",
    "7. El stock por local no se carga aquí: se ingresa después con una Entrada de inventario, por local.",
    "8. Guarda el archivo en formato .xlsx (no lo conviertas a CSV) y súbelo en \"Importar productos\".",
  ];
  lineas.forEach((l, i) => {
    const row = instrucciones.getRow(i + 1);
    row.getCell(1).value = l;
    if (i === 0) row.getCell(1).font = { bold: true, size: 14, color: { argb: "FF0B3B66" } };
  });

  // ── Hoja de productos ──
  const hoja = workbook.addWorksheet("Productos");
  hoja.columns = [
    { header: "SKU", key: "sku", width: 16 },
    { header: "Código de barra", key: "codigoBarra", width: 18 },
    { header: "Nombre", key: "nombre", width: 34 },
    { header: "Marca", key: "marca", width: 18 },
    { header: "Categoría", key: "categoria", width: 20 },
    { header: "Precio costo", key: "precioCosto", width: 14 },
    { header: "Precio venta", key: "precioVenta", width: 14 },
    { header: "Precio anterior (oferta)", key: "precioAnterior", width: 22 },
    { header: "Imagen (URL)", key: "imagen", width: 32 },
    { header: "Destacado (Sí/No)", key: "destacado", width: 18 },
  ];
  const header = hoja.getRow(1);
  header.font = { bold: true, color: { argb: "FF0B3B66" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EEF7" } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  // Fila de ejemplo (el usuario la borra antes de subir el archivo)
  hoja.addRow({
    sku: "",
    codigoBarra: "",
    nombre: "Laca HS 1Lt Kit",
    marca: nombresMarcas[0] ?? "Sikkens",
    categoria: nombresCategorias[0] ?? "",
    precioCosto: 18000,
    precioVenta: 27500,
    precioAnterior: "",
    imagen: "",
    destacado: "No",
  });

  // Desplegable estricto de Categoría (columna E): debe existir tal cual en el catálogo.
  if (nombresCategorias.length > 0) {
    const formula = `"${nombresCategorias.join(",")}"`;
    for (let r = 2; r <= FILAS_CON_VALIDACION + 1; r++) {
      hoja.getCell(`E${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Categoría no válida",
        error: "Elige una categoría de la lista. Si necesitas una nueva, pide que la creen antes de importar.",
      };
    }
  }

  // Desplegable sugerido de Marca (columna D): no bloquea marcas nuevas de un proveedor.
  if (nombresMarcas.length > 0) {
    const formula = `"${nombresMarcas.join(",")}"`;
    for (let r = 2; r <= FILAS_CON_VALIDACION + 1; r++) {
      hoja.getCell(`D${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [formula],
        showErrorMessage: false,
      };
    }
  }

  // Desplegable estricto de Destacado (columna J).
  for (let r = 2; r <= FILAS_CON_VALIDACION + 1; r++) {
    hoja.getCell(`J${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"Sí,No"'],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Valor no válido",
      error: "Usa Sí o No.",
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-productos-fenix-${hoy}.xlsx"`,
    },
  });
}
