/**
 * Shape alineado al futuro modelo Prisma `Product` del sistema POS.
 * Al conectar la BD, este tipo se reemplaza por el tipo generado por Prisma.
 */
export interface Product {
  sku: string;
  slug: string;
  nombre: string;
  marca: string;
  categoria: CategoryId;
  precioVenta: number;
  precioAnterior?: number;
  imagen?: string;
  destacado?: boolean;
  /** Unidades disponibles por local (mock → luego StockLocal de Prisma). */
  stock?: Record<string, number>;
}

export type CategoryId =
  | "pinturas-lacas"
  | "primers"
  | "pulido-detailing"
  | "lijas-abrasivos"
  | "accesorios"
  | "kits";

export interface Category {
  id: CategoryId;
  nombre: string;
  descripcion: string;
}
