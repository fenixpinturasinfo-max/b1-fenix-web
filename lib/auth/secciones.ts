/**
 * Catálogo de secciones del sistema.
 *
 * Una sección es una ruta con una pantalla detrás. Por eso vive en código y no en la base:
 * si no existe el archivo, no existe la sección, y no tiene sentido poder inventar filas
 * que no llevan a ninguna parte.
 *
 * Los permisos (qué perfil ve qué) sí viven en la base, en `PermisoPerfil`, y se editan
 * desde Configuración › Perfiles.
 */

export type Nivel = "TOTAL" | "LECTURA" | "SIN_ACCESO";

export const NIVELES: { valor: Nivel; label: string; ayuda: string }[] = [
  { valor: "TOTAL", label: "Total", ayuda: "Consulta y opera" },
  { valor: "LECTURA", label: "Solo lectura", ayuda: "Consulta, sin modificar" },
  { valor: "SIN_ACCESO", label: "Sin acceso", ayuda: "No aparece en el menú" },
];

export type ModuloId =
  | "inventario"
  | "compras"
  | "ventas"
  | "socios"
  | "reportes"
  | "configuracion";

export const MODULOS: { id: ModuloId; label: string }[] = [
  { id: "inventario", label: "Inventario" },
  { id: "compras", label: "Compras" },
  { id: "ventas", label: "Ventas" },
  { id: "socios", label: "Socios" },
  { id: "reportes", label: "Reportes" },
  { id: "configuracion", label: "Configuración" },
];

export interface Seccion {
  id: string;
  modulo: ModuloId;
  label: string;
  href: string;
  /** Si false, la sección solo admite Total o Sin acceso (el POS en solo lectura no significa nada) */
  permiteLectura: boolean;
  /** Qué implica dar acceso. Se muestra bajo el nombre en la pantalla de perfiles. */
  descripcion: string;
  /**
   * Si false, es un permiso sin pantalla propia y no aparece en el menú.
   * "Aplicar tomas" no es un lugar al que ir: es un derecho sobre una pantalla que ya existe.
   */
  enMenu?: boolean;
}

export const SECCIONES: Seccion[] = [
  // ── Inventario ──
  {
    id: "inventario.productos",
    modulo: "inventario",
    label: "Productos",
    href: "/dashboard/inventario",
    permiteLectura: true,
    descripcion: "Stock por local, mínimos, máximos y ubicaciones",
  },
  {
    id: "inventario.registrar",
    modulo: "inventario",
    label: "Registrar documento",
    href: "/dashboard/inventario/registrar",
    permiteLectura: false,
    descripcion: "Entradas, mermas, ajustes y transferencias entre locales",
  },
  {
    id: "inventario.toma",
    modulo: "inventario",
    label: "Toma de inventario",
    href: "/dashboard/inventario/tomas",
    permiteLectura: true,
    descripcion: "Abrir un conteo físico, contarlo y cerrarlo",
  },
  {
    id: "inventario.toma-aprobar",
    modulo: "inventario",
    label: "Aplicar tomas de inventario",
    href: "/dashboard/inventario/tomas",
    permiteLectura: false,
    enMenu: false,
    descripcion: "Autorizar el ajuste al stock después de revisar las diferencias",
  },
  {
    id: "inventario.movimientos",
    modulo: "inventario",
    label: "Movimientos",
    href: "/dashboard/inventario/movimientos",
    permiteLectura: true,
    descripcion: "Historial de todo lo que entró y salió",
  },
  {
    id: "inventario.precios-venta",
    modulo: "inventario",
    label: "Precios de venta",
    href: "/dashboard/precios",
    permiteLectura: true,
    descripcion: "Lista de precios al público y márgenes",
  },
  {
    id: "inventario.precios-compra",
    modulo: "inventario",
    label: "Precios de compra",
    href: "/dashboard/compras/precios",
    permiteLectura: true,
    descripcion: "Costo negociado con cada proveedor",
  },

  // ── Compras ──
  {
    id: "compras.solicitudes",
    modulo: "compras",
    label: "Solicitudes",
    href: "/dashboard/solicitudes",
    permiteLectura: true,
    descripcion: "Pedidos de reposición de los locales y su resolución",
  },
  {
    id: "compras.ordenes",
    modulo: "compras",
    label: "Orden de compra",
    href: "/dashboard/compras",
    permiteLectura: true,
    descripcion: "Órdenes al proveedor con costos y fechas comprometidas",
  },
  {
    id: "compras.entradas",
    modulo: "compras",
    label: "Entrada mercadería",
    href: "/dashboard/compras/entradas",
    permiteLectura: true,
    descripcion: "Recepción física: sube el stock y recalcula el costo promedio",
  },
  {
    id: "compras.facturas",
    modulo: "compras",
    label: "Facturas de compra",
    href: "/dashboard/compras/facturas",
    permiteLectura: true,
    descripcion: "Facturas del proveedor y cuentas por pagar",
  },
  {
    id: "compras.notas-credito",
    modulo: "compras",
    label: "Notas de crédito",
    href: "/dashboard/compras/notas-credito",
    permiteLectura: true,
    descripcion: "Devoluciones y rebajas sobre facturas de compra",
  },
  {
    id: "compras.partidas",
    modulo: "compras",
    label: "Lista de partidas",
    href: "/dashboard/compras/partidas",
    permiteLectura: true,
    descripcion: "Trazabilidad del flujo solicitud → orden → entrada → factura",
  },

  // ── Ventas ──
  {
    id: "ventas.pedidos",
    modulo: "ventas",
    label: "Pedidos",
    href: "/dashboard/ventas/pedidos",
    permiteLectura: true,
    descripcion: "Pedidos de clientes para retiro en local",
  },
  {
    id: "ventas.pos",
    modulo: "ventas",
    label: "POS",
    href: "/dashboard/pos",
    permiteLectura: false,
    descripcion: "Caja: apertura, venta, cierre y arqueo",
  },
  {
    id: "ventas.boletas",
    modulo: "ventas",
    label: "Boletas",
    href: "/dashboard/pos/boletas",
    permiteLectura: true,
    descripcion: "Historial de boletas emitidas y envío por correo",
  },
  {
    id: "ventas.partidas",
    modulo: "ventas",
    label: "Lista de partidas",
    href: "/dashboard/ventas/partidas",
    permiteLectura: true,
    descripcion: "Trazabilidad de pedidos y ventas",
  },

  // ── Socios ──
  {
    id: "socios.socios",
    modulo: "socios",
    label: "Socios de negocio",
    href: "/dashboard/socios",
    permiteLectura: true,
    descripcion: "Clientes y proveedores con sus datos comerciales",
  },

  // ── Reportes ──
  // Un reporte no se edita: todos van sin nivel intermedio de lectura.
  {
    id: "reportes.mi-turno",
    modulo: "reportes",
    label: "Mi turno",
    href: "/dashboard/reportes/mi-turno",
    permiteLectura: false,
    descripcion: "Sus propias ventas y sus cierres de caja, sin ver los de otros",
  },
  {
    id: "reportes.general",
    modulo: "reportes",
    label: "Ventas",
    href: "/dashboard/reportes",
    permiteLectura: false,
    descripcion: "Ventas del período, top de productos y boletas enviadas",
  },
  {
    id: "reportes.caja",
    modulo: "reportes",
    label: "Caja y turnos",
    href: "/dashboard/reportes/caja",
    permiteLectura: false,
    descripcion: "Turnos del día, huecos sin caja abierta, sangrías y descuadres",
  },

  // ── Configuración ──
  {
    id: "config.usuarios",
    modulo: "configuracion",
    label: "Usuarios",
    href: "/dashboard/configuracion/usuarios",
    permiteLectura: true,
    descripcion: "Cuentas del equipo: alta, perfil, local y activación",
  },
  {
    id: "config.perfiles",
    modulo: "configuracion",
    label: "Perfiles",
    href: "/dashboard/configuracion/perfiles",
    permiteLectura: true,
    descripcion: "Qué ve y qué puede hacer cada tipo de cuenta",
  },
  {
    id: "config.locales",
    modulo: "configuracion",
    label: "Locales",
    href: "/dashboard/configuracion/locales",
    permiteLectura: true,
    descripcion: "Sucursales, casa matriz y horarios",
  },
];

export const seccionPorId = new Map(SECCIONES.map((s) => [s.id, s]));

export function seccionesDeModulo(modulo: ModuloId): Seccion[] {
  return SECCIONES.filter((s) => s.modulo === modulo);
}

export interface GrupoMenu {
  modulo: ModuloId;
  label: string;
  /** Un módulo con una sola sección visible se muestra como enlace, sin submenú de un ítem */
  plano: boolean;
  secciones: Seccion[];
}

/**
 * Agrupa las secciones visibles en la estructura del menú lateral.
 *
 * Lo usan el sidebar real y la vista previa de la pantalla de perfiles. Es a propósito:
 * si fueran dos implementaciones, la vista previa podría mentir sobre lo que la persona
 * va a ver, que es justo lo que esa pantalla promete.
 */
export function agruparMenu(visibles: Seccion[]): GrupoMenu[] {
  const grupos: GrupoMenu[] = [];
  for (const m of MODULOS) {
    const suyas = visibles.filter((s) => s.modulo === m.id && s.enMenu !== false);
    if (suyas.length === 0) continue;
    grupos.push({
      modulo: m.id,
      label: m.label,
      plano: suyas.length === 1,
      secciones: suyas,
    });
  }
  return grupos;
}

/**
 * Describe un perfil en castellano a partir de su matriz.
 *
 * "9 de 20 secciones" no dice nada: dos perfiles muy distintos pueden dar el mismo número.
 * Esto responde de una la pregunta que el administrador trae de verdad, que es qué va a
 * poder hacer la persona.
 */
export function resumenPerfil(mapa: Record<string, Nivel>): string {
  const nivel = (id: string): Nivel => mapa[id] ?? "SIN_ACCESO";
  const total = (id: string) => nivel(id) === "TOTAL";
  const abierta = (id: string) => nivel(id) !== "SIN_ACCESO";

  const frases: string[] = [];
  const noConfig = SECCIONES.filter((s) => s.modulo !== "configuracion");

  // Casos extremos primero: si no se distinguen acá, dos perfiles muy distintos
  // terminan con el mismo resumen porque comparten las primeras capacidades.
  if (SECCIONES.every((s) => nivel(s.id) === "TOTAL")) {
    return "Acceso total a todo el sistema, incluida la configuración.";
  }
  if (noConfig.every((s) => nivel(s.id) === "TOTAL")) {
    return "Opera todo el negocio: inventario, compras, ventas, socios y reportes. No entra a la configuración del sistema.";
  }

  // Ordenadas por lo que más define el día a día del cargo. En infinitivo: van tras "Puede".
  const capacidades: [boolean, string][] = [
    [total("ventas.pos"), "vender en caja"],
    [total("ventas.pedidos"), "tomar pedidos"],
    [total("compras.entradas"), "recibir mercadería"],
    [total("inventario.registrar"), "registrar movimientos de stock"],
    [total("compras.solicitudes"), "resolver reposiciones"],
    [total("compras.ordenes"), "emitir órdenes de compra"],
    [total("compras.facturas"), "registrar facturas de proveedor"],
    [total("inventario.precios-venta"), "definir precios de venta"],
    [total("socios.socios"), "administrar clientes y proveedores"],
    [total("config.perfiles") || total("config.usuarios"), "configurar el sistema"],
  ];
  const puede = capacidades.filter(([ok]) => ok).map(([, t]) => t);
  const extra = Math.max(0, puede.length - 4);
  const listadas = puede.slice(0, 4);

  if (listadas.length === 0) {
    frases.push("Solo consulta: no puede modificar nada.");
  } else {
    const ultima = listadas.pop()!;
    const cuerpo =
      listadas.length > 0 ? `${listadas.join(", ")} y ${ultima}` : ultima;
    frases.push(extra > 0 ? `Puede ${cuerpo}, entre otras cosas.` : `Puede ${cuerpo}.`);
  }

  // Matiz que sorprende si no se dice: ve el stock pero no lo toca
  if (nivel("inventario.productos") === "LECTURA") {
    frases.push("Consulta el stock sin editarlo.");
  }

  const cerrados = MODULOS.filter(
    (m) =>
      m.id !== "configuracion" &&
      SECCIONES.filter((s) => s.modulo === m.id).every((s) => !abierta(s.id)),
  ).map((m) => m.label.toLowerCase());

  if (cerrados.length > 0) {
    const ultimo = cerrados.pop()!;
    frases.push(
      cerrados.length > 0 ? `No ve ${cerrados.join(", ")} ni ${ultimo}.` : `No ve ${ultimo}.`,
    );
  }

  return frases.join(" ");
}

/**
 * Matriz de permisos por defecto. Es el punto de partida que carga la migración;
 * de ahí en adelante manda lo que haya en la base.
 *
 * El perfil ADMINISTRADOR no está aquí a propósito: siempre tiene TOTAL en todo, resuelto
 * en código antes de tocar la base. Es la llave maestra del sistema y no debe depender de
 * que existan filas ni de que nadie se equivoque en una pantalla.
 */
export const MATRIZ_DEFECTO: Record<string, Record<string, Nivel>> = {
  GERENTE: {
    "inventario.productos": "TOTAL",
    "inventario.registrar": "TOTAL",
    "inventario.toma": "TOTAL",
    "inventario.toma-aprobar": "TOTAL",
    "inventario.movimientos": "TOTAL",
    "inventario.precios-venta": "TOTAL",
    "inventario.precios-compra": "TOTAL",
    "compras.solicitudes": "TOTAL",
    "compras.ordenes": "TOTAL",
    "compras.entradas": "TOTAL",
    "compras.facturas": "TOTAL",
    "compras.notas-credito": "TOTAL",
    "compras.partidas": "TOTAL",
    "ventas.pedidos": "TOTAL",
    "ventas.pos": "TOTAL",
    "ventas.boletas": "TOTAL",
    "ventas.partidas": "TOTAL",
    "socios.socios": "TOTAL",
    "reportes.mi-turno": "TOTAL",
    "reportes.general": "TOTAL",
    "reportes.caja": "TOTAL",
  },
  JEFE_LOCAL: {
    // Inventario: consulta el stock de su local y registra movimientos
    "inventario.productos": "LECTURA",
    "inventario.registrar": "TOTAL",
    "inventario.toma": "TOTAL",
    "inventario.toma-aprobar": "TOTAL",
    "inventario.movimientos": "TOTAL",
    // Compras: solo recepción. Conserva Solicitudes porque el encargado de la casa
    // matriz es quien resuelve las reposiciones de todos los locales.
    "compras.solicitudes": "TOTAL",
    "compras.entradas": "TOTAL",
    "ventas.pedidos": "TOTAL",
    "ventas.pos": "TOTAL",
    "ventas.boletas": "TOTAL",
    "ventas.partidas": "TOTAL",
    "reportes.mi-turno": "TOTAL",
    "reportes.general": "TOTAL",
    "reportes.caja": "TOTAL",
  },
  VENDEDOR: {
    "ventas.pedidos": "TOTAL",
    "ventas.pos": "TOTAL",
    "ventas.boletas": "TOTAL",
    "ventas.partidas": "LECTURA",
    // Solo lo suyo: ver el descuadre de un compañero no le sirve y genera roce
    "reportes.mi-turno": "TOTAL",
  },
  BODEGA: {
    // Bodega sí define los mínimos: son ellos quienes saben cuándo hay que reponer
    "inventario.productos": "TOTAL",
    "inventario.registrar": "TOTAL",
    // Cuenta y cierra, pero no aplica: quien cuenta no autoriza su propio ajuste
    "inventario.toma": "TOTAL",
    "inventario.movimientos": "TOTAL",
    "compras.solicitudes": "TOTAL",
    "compras.ordenes": "LECTURA",
    "compras.entradas": "TOTAL",
    "compras.partidas": "LECTURA",
  },
};
