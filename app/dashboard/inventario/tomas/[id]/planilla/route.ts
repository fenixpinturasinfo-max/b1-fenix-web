import ExcelJS from "exceljs";
import { esRolGlobal, puedeVer } from "@/lib/auth/permissions";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { alcanceLabel } from "@/features/tomas/toma";
import { partesSantiago } from "@/lib/fechas";

/**
 * Planilla de conteo en .xlsx para contar en papel o tablet.
 *
 * Deliberadamente **no lleva la cantidad esperada**. Es la misma regla del conteo a ciegas
 * que el contador móvil aplica en el servidor: si la planilla trae el esperado al lado, se
 * completa copiando la columna y la toma deja de medir lo que hay para medir lo que el
 * sistema ya creía.
 *
 * Las filas van ordenadas por ubicación, no alfabéticamente: se cuenta caminando, y el
 * orden del papel debería ser el orden del pasillo.
 */

/** Fila donde arranca la tabla; arriba van los datos de la toma. */
const FILA_CABECERA = 7;

const NARANJA = "FFE7EEF7";
const AZUL = "FF0B3B66";

/**
 * aaaa-mm-dd en hora de Chile.
 *
 * Con `getMonth()`/`getDate()` a secas el servidor de Vercel —que corre en UTC— pondría
 * la fecha de mañana en cualquier planilla descargada después de las 20:00 chilenas.
 */
function fechaISO(d: Date): string {
  const p = partesSantiago(d);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await getSession();
  if (!session || !(await puedeVer(session.rol, "inventario.toma"))) {
    return new Response("No autorizado", { status: 401 });
  }

  const toma = await prisma.tomaInventario.findUnique({
    where: { id },
    include: {
      local: { select: { nombre: true } },
      lineas: {
        include: { producto: { select: { sku: true, nombre: true, marca: true, codigoBarra: true } } },
      },
    },
  });
  if (!toma) return new Response("Toma no encontrada", { status: 404 });
  if (!esRolGlobal(session.rol) && toma.localId !== session.localId) {
    return new Response("No autorizado", { status: 401 });
  }
  if (toma.estado === "APLICADA" || toma.estado === "ANULADA") {
    return new Response("Esta toma ya está cerrada: no admite más conteos.", { status: 409 });
  }

  // Ubicación por producto, para ordenar el recorrido
  const stocks = await prisma.stockLocal.findMany({
    where: { localId: toma.localId, productoId: { in: toma.lineas.map((l) => l.productoId) } },
    select: { productoId: true, ubicacion: true },
  });
  const ubicacionDe = new Map(stocks.map((s) => [s.productoId, s.ubicacion]));

  // Sin ubicación al final: son los que hay que buscar, no los que se cuentan al pasar
  const lineas = [...toma.lineas].sort((a, b) => {
    const ua = ubicacionDe.get(a.productoId) ?? "";
    const ub = ubicacionDe.get(b.productoId) ?? "";
    if (ua !== ub) {
      if (!ua) return 1;
      if (!ub) return -1;
      return ua.localeCompare(ub, "es");
    }
    return a.producto.nombre.localeCompare(b.producto.nombre, "es");
  });

  const folio = `TI-${String(toma.correlativo).padStart(6, "0")}`;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Pinturas Fenix";
  workbook.created = new Date();

  // ── Hoja de instrucciones ──
  const instrucciones = workbook.addWorksheet("Instrucciones");
  instrucciones.columns = [{ width: 95 }];
  [
    `Planilla de conteo ${folio} — ${toma.local.nombre}`,
    "",
    "1. Anota en la columna \"Cantidad contada\" lo que cuentes físicamente en el pasillo.",
    "2. Deja la celda VACÍA si no llegaste a contar ese producto: queda pendiente.",
    "3. Escribe 0 solo si contaste y no había ninguna unidad. Vacío y 0 significan cosas distintas.",
    "4. Completa la celda \"Fecha del conteo\" de la hoja Conteo con el día en que contaste,",
    "   aunque la planilla se cargue días después. De esa fecha depende el cálculo de diferencias:",
    "   las ventas posteriores al conteo se descuentan solas y no aparecen como faltantes.",
    "5. No cambies la columna SKU ni el encabezado de las columnas: con ellos se importa el archivo.",
    "6. Si encuentras mercadería que no está en la lista, agrégala al final con su SKU y la cantidad.",
    "   Al importar se incorporará como línea nueva de la toma.",
    "7. Guarda en formato .xlsx (no lo conviertas a CSV) y súbelo en \"Importar conteo\".",
    "",
    toma.ciego
      ? "Esta toma se abrió como conteo A CIEGAS: la cantidad que el sistema espera no aparece a\npropósito. Verla haría que uno confirme ese número en vez de contar, que es el sesgo que\narruina las tomas."
      : "Esta toma NO es a ciegas: la columna \"Cantidad sistema\" muestra lo que el sistema tenía al\nabrir la toma, para que puedas verificar. Cuenta primero y recién después mira esa columna.",
  ].forEach((l, i) => {
    const cell = instrucciones.getRow(i + 1).getCell(1);
    cell.value = l;
    if (i === 0) cell.font = { bold: true, size: 14, color: { argb: AZUL } };
  });

  // ── Hoja de conteo ──
  // Las columnas dependen del switch de conteo a ciegas: con `ciego` no se revela lo que el
  // sistema espera, y sin él se agrega para poder verificar. Los índices se calculan en vez
  // de escribirse a mano, porque agregar una columna corre todas las de la derecha.
  const hoja = workbook.addWorksheet("Conteo");
  const COL_SISTEMA = toma.ciego ? null : 7;
  const COL_CONTADO = toma.ciego ? 7 : 8;
  const COL_OBS = COL_CONTADO + 1;
  const letra = (n: number) => String.fromCharCode(64 + n);

  hoja.columns = [
    { key: "nro", width: 6 },
    { key: "sku", width: 18 },
    { key: "codigoBarra", width: 18 },
    { key: "nombre", width: 40 },
    { key: "marca", width: 18 },
    { key: "ubicacion", width: 16 },
    ...(COL_SISTEMA ? [{ key: "sistema", width: 16 }] : []),
    { key: "contado", width: 18 },
    { key: "observacion", width: 30 },
  ];

  const rotulo = (fila: number, etiqueta: string, valor: string) => {
    const row = hoja.getRow(fila);
    row.getCell(1).value = etiqueta;
    row.getCell(1).font = { bold: true, color: { argb: AZUL } };
    row.getCell(2).value = valor;
    return row;
  };

  hoja.getRow(1).getCell(1).value = `Planilla de conteo ${folio}`;
  hoja.getRow(1).getCell(1).font = { bold: true, size: 14, color: { argb: AZUL } };
  rotulo(2, "Local", toma.local.nombre);
  rotulo(
    3,
    "Alcance",
    `${alcanceLabel[toma.alcance] ?? toma.alcance}${toma.filtro ? ` · ${toma.filtro}` : ""}`,
  );
  // La celda que hay que llenar: de ella depende el cálculo de diferencias
  const filaFecha = rotulo(4, "Fecha del conteo", fechaISO(toma.fechaConteo ?? new Date()));
  filaFecha.getCell(2).numFmt = "yyyy-mm-dd";
  filaFecha.getCell(3).value = "← escribe el día en que contaste (aaaa-mm-dd)";
  filaFecha.getCell(3).font = { italic: true, size: 10, color: { argb: "FF8A8A8A" } };
  const filaHora = rotulo(5, "Hora aproximada", "");
  filaHora.getCell(3).value = "← opcional, ej. 09:30. Si la dejas vacía se asume la mañana.";
  filaHora.getCell(3).font = { italic: true, size: 10, color: { argb: "FF8A8A8A" } };

  // Llave para validar en la importación que el archivo es de ESTA toma. Sin esto, subir
  // la planilla de otra toma escribiría conteos cruzados sin que nadie lo note.
  const filaId = hoja.getRow(6);
  filaId.getCell(1).value = "ID toma";
  filaId.getCell(1).font = { bold: true, size: 8, color: { argb: "FFBBBBBB" } };
  filaId.getCell(2).value = toma.id;
  filaId.getCell(2).font = { size: 8, color: { argb: "FFBBBBBB" } };
  filaId.getCell(3).value = "no modificar";
  filaId.getCell(3).font = { italic: true, size: 8, color: { argb: "FFBBBBBB" } };

  const cabecera = hoja.getRow(FILA_CABECERA);
  // Estos títulos son el contrato con la importación: ahí se buscan por nombre, no por
  // posición, para que la planilla ciega y la no ciega se importen con el mismo código.
  [
    "Nro",
    "SKU",
    "Código de barra",
    "Descripción",
    "Marca",
    "Ubicación",
    ...(COL_SISTEMA ? ["Cantidad sistema"] : []),
    "Cantidad contada",
    "Observación",
  ].forEach((t, i) => {
    const cell = cabecera.getCell(i + 1);
    cell.value = t;
    cell.font = { bold: true, color: { argb: AZUL } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NARANJA } };
  });
  hoja.views = [{ state: "frozen", ySplit: FILA_CABECERA }];

  lineas.forEach((l, i) => {
    const nFila = FILA_CABECERA + 1 + i;
    const row = hoja.getRow(nFila);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = l.producto.sku;
    row.getCell(3).value = l.producto.codigoBarra ?? "";
    row.getCell(4).value = l.producto.nombre;
    row.getCell(5).value = l.producto.marca;
    row.getCell(6).value = ubicacionDe.get(l.productoId) ?? "";
    // Lo que el sistema tenía al abrir la toma. Solo si la toma NO es a ciegas.
    if (COL_SISTEMA) row.getCell(COL_SISTEMA).value = l.esperado;
    // Cantidad contada: vacía a propósito, con borde para que se vea dónde escribir
    row.getCell(COL_CONTADO).value = null;
    row.getCell(COL_CONTADO).border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    // Enteros y no negativos: atrapa el "12,5" o el "-3" en la planilla, no al importar
    hoja.getCell(`${letra(COL_CONTADO)}${nFila}`).dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      formulae: [0],
      allowBlank: true,
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "Cantidad no válida",
      error: "Escribe un número entero de 0 o más. Deja la celda vacía si no contaste este producto.",
    };
  });

  // Protección: se editan solo la cantidad, la observación y las celdas de fecha/hora.
  // No es seguridad —desproteger una hoja es trivial— sino evitar que se rompa el SKU sin
  // querer, que es la llave con la que la importación encuentra cada línea.
  for (let i = 0; i < lineas.length; i++) {
    const fila = FILA_CABECERA + 1 + i;
    hoja.getCell(`${letra(COL_CONTADO)}${fila}`).protection = { locked: false };
    hoja.getCell(`${letra(COL_OBS)}${fila}`).protection = { locked: false };
  }
  hoja.getCell("B4").protection = { locked: false };
  hoja.getCell("B5").protection = { locked: false };
  // Filas libres al final para la mercadería que no estaba en la lista (§ instrucción 6)
  for (let i = 0; i < 20; i++) {
    const fila = FILA_CABECERA + 1 + lineas.length + i;
    for (const col of ["B", "C", "D", letra(COL_CONTADO), letra(COL_OBS)]) {
      hoja.getCell(`${col}${fila}`).protection = { locked: false };
    }
  }
  await hoja.protect("", {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatColumns: true,
    formatRows: true,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="conteo-${folio}-${fechaISO(new Date())}.xlsx"`,
    },
  });
}
