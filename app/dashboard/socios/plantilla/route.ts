import ExcelJS from "exceljs";
import { puedeVer } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { COLUMNAS_SOCIOS, CONDICIONES_PAGO } from "@/features/partners/importacion";

/** Cuántas filas de la plantilla llevan los desplegables. */
const FILAS_CON_VALIDACION = 300;

/**
 * Descarga la plantilla .xlsx para cargar proveedores o clientes de forma masiva.
 * `?tipo=CLIENTE` agrega las columnas comerciales (descuento, cuenta abierta); por
 * defecto es la de proveedores.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || !(await puedeVer(session.rol, "socios.socios"))) {
    return new Response("No autorizado", { status: 401 });
  }
  const tipo = new URL(req.url).searchParams.get("tipo") === "CLIENTE" ? "CLIENTE" : "PROVEEDOR";
  const esCliente = tipo === "CLIENTE";
  const etiqueta = esCliente ? "clientes" : "proveedores";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pinturas Fenix";
  workbook.created = new Date();

  // ── Hoja de instrucciones ──
  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 95 }];
  const lineas = [
    `Carga masiva de ${etiqueta} — Pinturas Fenix`,
    "",
    `1. Completa la hoja "Socios" (una fila por ${esCliente ? "cliente" : "proveedor"}). Borra la fila de ejemplo antes de subir el archivo.`,
    "2. Columnas obligatorias: RUT y Razón social.",
    "3. RUT: con o sin puntos, con guion (12345678-9). Si ya existe un " +
      (esCliente ? "cliente" : "proveedor") +
      " con ese RUT, la fila lo actualiza en vez de crear uno nuevo.",
    "4. Un mismo RUT puede ser cliente y proveedor a la vez: son fichas separadas. Esta plantilla carga solo " + etiqueta + ".",
    "5. Condición de pago: elige del desplegable (Contado, 30, 60 o 90 días) o déjalo vacío.",
    ...(esCliente
      ? [
          "6. Descuento (%): porcentaje pactado con el cliente que el POS aplica solo al ingresar su RUT. 0 o vacío = sin descuento.",
          "7. Cuenta abierta (Sí/No): Sí permite que se lleve mercadería a cuenta y pague al consolidar. Es crédito: márcalo solo a propósito.",
          "8. Guarda el archivo en formato .xlsx (no lo conviertas a CSV) y súbelo en \"Importar clientes\".",
        ]
      : ["6. Guarda el archivo en formato .xlsx (no lo conviertas a CSV) y súbelo en \"Importar proveedores\"."]),
  ];
  lineas.forEach((l, i) => {
    const row = instrucciones.getRow(i + 1);
    row.getCell(1).value = l;
    if (i === 0) row.getCell(1).font = { bold: true, size: 14, color: { argb: "FF0B3B66" } };
  });

  // ── Hoja de socios ──
  const hoja = workbook.addWorksheet("Socios");
  const columnas: Partial<ExcelJS.Column>[] = [
    { header: COLUMNAS_SOCIOS.rut, key: "rut", width: 16, style: { numFmt: "@" } },
    { header: COLUMNAS_SOCIOS.razonSocial, key: "razonSocial", width: 34 },
    { header: COLUMNAS_SOCIOS.nombreFantasia, key: "nombreFantasia", width: 26 },
    { header: COLUMNAS_SOCIOS.giro, key: "giro", width: 26 },
    { header: COLUMNAS_SOCIOS.email, key: "email", width: 28 },
    { header: COLUMNAS_SOCIOS.telefono, key: "telefono", width: 16, style: { numFmt: "@" } },
    { header: COLUMNAS_SOCIOS.direccion, key: "direccion", width: 32 },
    { header: COLUMNAS_SOCIOS.comuna, key: "comuna", width: 18 },
    { header: COLUMNAS_SOCIOS.condicionPago, key: "condicionPago", width: 18 },
  ];
  if (esCliente) {
    columnas.push(
      { header: COLUMNAS_SOCIOS.descuento, key: "descuento", width: 14 },
      { header: COLUMNAS_SOCIOS.cuentaAbierta, key: "cuentaAbierta", width: 20 },
    );
  }
  hoja.columns = columnas;
  const header = hoja.getRow(1);
  header.font = { bold: true, color: { argb: "FF0B3B66" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7EEF7" } };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  // Fila de ejemplo (el usuario la borra antes de subir el archivo)
  hoja.addRow(
    esCliente
      ? {
          rut: "12345678-9",
          razonSocial: "Taller Desabolladura Pérez Ltda.",
          nombreFantasia: "Taller Pérez",
          giro: "Desabolladura y pintura",
          email: "contacto@tallerperez.cl",
          telefono: "+56 9 1234 5678",
          direccion: "Av. Ejemplo 123",
          comuna: "San Bernardo",
          condicionPago: "30 días",
          descuento: 5,
          cuentaAbierta: "No",
        }
      : {
          rut: "76123456-7",
          razonSocial: "Distribuidora de Pinturas Ejemplo SpA",
          nombreFantasia: "Pinturas Ejemplo",
          giro: "Distribución de pinturas",
          email: "ventas@ejemplo.cl",
          telefono: "+56 2 2345 6789",
          direccion: "Av. Ejemplo 123",
          comuna: "Santiago",
          condicionPago: "30 días",
        },
  );

  // Desplegable de condición de pago (columna I)
  const formulaPago = `"${CONDICIONES_PAGO.map((c) => c.etiqueta).join(",")}"`;
  for (let r = 2; r <= FILAS_CON_VALIDACION + 1; r++) {
    hoja.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [formulaPago],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Condición no válida",
      error: "Elige una condición de la lista o deja la celda vacía.",
    };
    if (esCliente) {
      hoja.getCell(`J${r}`).dataValidation = {
        type: "whole",
        operator: "between",
        allowBlank: true,
        formulae: [0, 100],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Descuento no válido",
        error: "Escribe un número entero entre 0 y 100.",
      };
      hoja.getCell(`K${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Sí,No"'],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "Valor no válido",
        error: "Usa Sí o No.",
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const hoy = new Date().toISOString().slice(0, 10);
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-${etiqueta}-fenix-${hoy}.xlsx"`,
    },
  });
}
