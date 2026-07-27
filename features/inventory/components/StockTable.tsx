"use client";

import { useActionState, useEffect, useState } from "react";
import { actualizarParametros, editarProducto, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";
import { Paginacion } from "@/components/ui/Paginacion";

export interface StockPorLocal {
  cantidad: number;
  stockMin: number;
  stockMax: number | null;
  ubicacion: string | null;
}

export interface ProductoStock {
  productoId: string;
  sku: string;
  nombre: string;
  marca: string;
  categoriaId: string;
  codigoBarra: string | null;
  precioCosto: number;
  precioVenta: number;
  imagen: string | null;
  activo: boolean;
  /** localId → stock en ese local */
  porLocal: Record<string, StockPorLocal>;
}

interface Fila {
  p: ProductoStock;
  cantidad: number;
  stockMin: number;
  stockMax: number | null;
  ubicacion: string | null;
  /** desglose por local (para la fila expandible) */
  desglose: { nombre: string; cantidad: number }[];
}

const CONSOLIDADO = "ALL";
const PAGINA = 10;

function estadoDe(f: Fila): { label: string; cls: string } {
  if (f.cantidad <= 0) return { label: "Sin stock", cls: "bg-fenix-600/10 text-fenix-600" };
  if (f.cantidad <= f.stockMin)
    return { label: "Bajo mínimo", cls: "bg-[#f59e0b]/15 text-[#b45309]" };
  return { label: "OK", cls: "bg-lime-400/15 text-[#4d7c0f]" };
}

function EditModal({
  fila,
  localId,
  localNombre,
  onClose,
}: {
  fila: Fila;
  localId: string;
  localNombre: string;
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    actualizarParametros,
    {},
  );
  const input =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

  // Cerrar con Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar parámetros de ${fila.p.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-navy-950">
              ✏️ Parámetros de stock ·{" "}
              <span className="font-mono text-electric-600">{fila.p.sku}</span>
            </h3>
            <p className="text-sm text-slate-500">
              {fila.p.nombre} · válidos para el local <b>{localNombre}</b>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
          >
            ✕
          </button>
        </div>

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="productoId" value={fila.p.productoId} />
          <input type="hidden" name="localId" value={localId} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Stock mín</label>
            <input name="stockMin" type="number" min={0} defaultValue={fila.stockMin} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Stock máx</label>
            <input name="stockMax" type="number" min={0} defaultValue={fila.stockMax ?? ""} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">Ubicación</label>
            <input
              name="ubicacion"
              defaultValue={fila.ubicacion ?? ""}
              placeholder="Ej: Pasillo 2 - Estante B"
              className={input}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
            >
              Cerrar
            </button>
          </div>
          {state.error && (
            <p className="text-sm font-semibold text-fenix-600 sm:col-span-2">{state.error}</p>
          )}
          {state.ok && (
            <p className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2">✅ {state.ok}</p>
          )}
        </form>
      </div>
    </div>
  );
}

/** Ficha maestra del producto — editable desde la vista Consolidado (solo admin) */
function EditProductoModal({
  p,
  categorias,
  onClose,
}: {
  p: ProductoStock;
  categorias: { id: string; nombre: string }[];
  onClose: () => void;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(editarProducto, {});
  const input =
    "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-navy-950 outline-none transition focus:border-electric-500";

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Editar producto ${p.nombre}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-navy-950">
              ✏️ Editar producto ·{" "}
              <span className="font-mono text-electric-600">{p.sku}</span>
            </h3>
            <p className="text-sm text-slate-500">
              Ficha maestra: rige para todos los locales, el POS y la tienda online.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
          >
            ✕
          </button>
        </div>

        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="productoId" value={p.productoId} />
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Nombre *</label>
            <input name="nombre" required defaultValue={p.nombre} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Marca *</label>
            <input name="marca" required defaultValue={p.marca} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Categoría *</label>
            <select name="categoriaId" required defaultValue={p.categoriaId} className={input}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Código de barra</label>
            <input name="codigoBarra" defaultValue={p.codigoBarra ?? ""} placeholder="Escanea aquí" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Precio venta *</label>
            <input name="precioVenta" type="number" min={1} required defaultValue={p.precioVenta} className={input} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Precio costo (CPP)</label>
            <input name="precioCosto" type="number" min={0} defaultValue={p.precioCosto} className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-semibold text-slate-700">
              Imagen (URL o /productos/archivo.jpg)
            </label>
            <input name="imagen" defaultValue={p.imagen ?? ""} placeholder="https://… o /productos/laca-hs.jpg" className={input} />
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={p.activo}
              className="h-4 w-4 accent-[#0e518d]"
            />
            Producto activo (visible en POS y tienda online)
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
            >
              Cerrar
            </button>
          </div>
          {state.error && (
            <p className="text-sm font-semibold text-fenix-600 sm:col-span-2">{state.error}</p>
          )}
          {state.ok && (
            <p className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2">✅ {state.ok}</p>
          )}
        </form>
      </div>
    </div>
  );
}

export type EstadoStock = "TODOS" | "SIN" | "BAJO" | "OK";

export function StockTable({
  productos,
  locales,
  localFijo,
  categorias,
  esAdmin,
  puedeAjustar = true,
  estadoInicial = "TODOS",
}: {
  productos: ProductoStock[];
  locales: { id: string; comuna: string }[];
  localFijo: string | null; // null = admin elige (incluye consolidado)
  categorias: { id: string; nombre: string }[];
  esAdmin: boolean;
  /** Si puede editar mínimos, máximos y ubicación del local. El encargado no. */
  puedeAjustar?: boolean;
  /** Prefiltro al entrar desde el dashboard (?estado=SIN|BAJO) */
  estadoInicial?: EstadoStock;
}) {
  const [localSel, setLocalSel] = useState(localFijo ?? CONSOLIDADO);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<EstadoStock>(estadoInicial);
  const [marca, setMarca] = useState("TODAS");
  const [categoria, setCategoria] = useState("TODAS");
  const [editing, setEditing] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [orden, setOrden] = useState<{ campo: "nombre" | "stock"; asc: boolean }>({
    campo: "nombre",
    asc: true,
  });
  const [pagina, setPagina] = useState(1);

  const esConsolidado = localSel === CONSOLIDADO;

  // ── Derivar filas según el local seleccionado (sin ir al servidor) ──
  const rows: Fila[] = productos.map((p) => {
    if (esConsolidado) {
      const valores = locales.map((l) => p.porLocal[l.id]);
      return {
        p,
        cantidad: valores.reduce((n, v) => n + (v?.cantidad ?? 0), 0),
        stockMin: valores.reduce((n, v) => n + (v?.stockMin ?? 0), 0),
        stockMax: null,
        ubicacion: null,
        desglose: locales.map((l) => ({
          nombre: l.comuna,
          cantidad: p.porLocal[l.id]?.cantidad ?? 0,
        })),
      };
    }
    const propio = p.porLocal[localSel];
    return {
      p,
      cantidad: propio?.cantidad ?? 0,
      stockMin: propio?.stockMin ?? 0,
      stockMax: propio?.stockMax ?? null,
      ubicacion: propio?.ubicacion ?? null,
      desglose: locales
        .filter((l) => l.id !== localSel)
        .map((l) => ({ nombre: l.comuna, cantidad: p.porLocal[l.id]?.cantidad ?? 0 })),
    };
  });

  const ordenarPor = (campo: "nombre" | "stock") =>
    setOrden((o) => ({ campo, asc: o.campo === campo ? !o.asc : campo === "nombre" }));

  const marcas = [...new Set(productos.map((p) => p.marca))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );

  const estaEn = (f: Fila, e: typeof estado) =>
    e === "TODOS"
      ? true
      : e === "SIN"
        ? f.cantidad <= 0
        : e === "BAJO"
          ? f.cantidad > 0 && f.cantidad <= f.stockMin
          : f.cantidad > f.stockMin;

  const q = query.trim().toLowerCase();
  const filtrados = rows.filter((f) => {
    const p = f.p;
    if (
      q &&
      !p.nombre.toLowerCase().includes(q) &&
      !p.sku.toLowerCase().includes(q) &&
      !p.marca.toLowerCase().includes(q) &&
      !(p.codigoBarra ?? "").includes(q)
    )
      return false;
    if (marca !== "TODAS" && p.marca !== marca) return false;
    if (categoria !== "TODAS" && p.categoriaId !== categoria) return false;
    return estaEn(f, estado);
  });
  const ordenados = [...filtrados].sort((a, b) => {
    const cmp =
      orden.campo === "stock" ? a.cantidad - b.cantidad : a.p.nombre.localeCompare(b.p.nombre, "es");
    return orden.asc ? cmp : -cmp;
  });
  const visibles = ordenados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const flecha = (campo: "nombre" | "stock") =>
    orden.campo === campo ? (orden.asc ? " ↑" : " ↓") : "";

  // KPIs de la selección actual
  const valor = rows.reduce((t, f) => t + f.cantidad * f.p.precioCosto, 0);
  const bajos = rows.filter((f) => f.cantidad <= f.stockMin).length;

  const chips: [typeof estado, string][] = [
    ["TODOS", "Todos"],
    ["SIN", "Sin stock"],
    ["BAJO", "Bajo mínimo"],
    ["OK", "OK"],
  ];

  const chipCls = (activo: boolean) =>
    `flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition ${
      activo
        ? "bg-electric-600 text-white"
        : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
    }`;

  return (
    <div>
      {/* Fila 1: contexto — local + KPIs de la selección */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {localFijo === null && locales.length > 1 && (
          <>
            <button type="button" onClick={() => setLocalSel(CONSOLIDADO)} className={chipCls(esConsolidado)}>
              🏪 Consolidado
            </button>
            {locales.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setLocalSel(l.id);
                  setPagina(1);
                  setEditing(null);
                }}
                className={chipCls(localSel === l.id)}
              >
                {l.comuna}
              </button>
            ))}
          </>
        )}
        <span className="ml-auto text-sm text-slate-500">
          Valor (CPP): <b className="tabular-nums text-navy-950">{formatCLP(valor)}</b>
          {" · "}
          {bajos > 0 ? (
            <b className="text-[#b45309]">{bajos} por reponer</b>
          ) : (
            <span className="text-[#4d7c0f]">todo en orden</span>
          )}
        </span>
      </div>

      {/* Fila 2: filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chips.map(([valorChip, label]) => (
          <button
            key={valorChip}
            type="button"
            onClick={() => {
              setEstado(valorChip);
              setPagina(1);
            }}
            className={chipCls(estado === valorChip)}
          >
            {label}
            <span
              className={`rounded-full px-1.5 text-xs ${
                estado === valorChip ? "bg-white/20" : "bg-cloud"
              }`}
            >
              {rows.filter((f) => estaEn(f, valorChip)).length}
            </span>
          </button>
        ))}
        <select
          value={marca}
          onChange={(e) => {
            setMarca(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por marca"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-electric-500"
        >
          <option value="TODAS">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setPagina(1);
          }}
          aria-label="Filtrar por categoría"
          className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-600 outline-none focus:border-electric-500"
        >
          <option value="TODAS">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <input
          type="search"
          placeholder="Nombre, SKU, marca o código…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPagina(1);
          }}
          className="ml-auto h-10 w-full max-w-64 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-navy-950 outline-none focus:border-electric-500"
        />
      </div>

      {/* Cuerpo con scroll interno: filtros y paginador siempre visibles */}
      <div className="max-h-[calc(100vh-360px)] overflow-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wider text-slate-500 shadow-[inset_0_-1px_0_var(--color-slate-200)]">
            <tr>
              <th className="px-4 py-2.5">SKU</th>
              <th className="px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => ordenarPor("nombre")}
                  className="font-bold uppercase tracking-wider transition hover:text-electric-600"
                >
                  Producto{flecha("nombre")}
                </button>
              </th>
              <th className="px-3 py-2.5 text-right">
                <button
                  type="button"
                  onClick={() => ordenarPor("stock")}
                  className="font-bold uppercase tracking-wider transition hover:text-electric-600"
                >
                  Stock{flecha("stock")}
                </button>
              </th>
              <th className="whitespace-nowrap px-4 py-2.5 text-right">Mín / Máx</th>
              <th className="px-4 py-2.5">Ubicación</th>
              <th className="px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => {
              const est = estadoDe(f);
              const id = f.p.productoId;
              return (
                <FragmentRow
                  key={id}
                  fila={f}
                  estado={est}
                  mostrarEditar={esConsolidado ? esAdmin : puedeAjustar}
                  etiquetaEditar={esConsolidado ? "Editar producto" : "Editar"}
                  esConsolidado={esConsolidado}
                  expandido={expandido === id}
                  onEdit={() => setEditing(editing === id ? null : id)}
                  onExpand={() => setExpandido(expandido === id ? null : id)}
                />
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Sin resultados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex justify-center">
        <Paginacion
          total={filtrados.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>

      {/* Modal de edición (fuera de la tabla: HTML válido).
          Consolidado → ficha maestra del producto · Local → parámetros de stock */}
      {editing &&
        (() => {
          const f = rows.find((r) => r.p.productoId === editing);
          if (!f) return null;
          if (esConsolidado) {
            return esAdmin ? (
              <EditProductoModal
                p={f.p}
                categorias={categorias}
                onClose={() => setEditing(null)}
              />
            ) : null;
          }
          if (!puedeAjustar) return null;
          return (
            <EditModal
              fila={f}
              localId={localSel}
              localNombre={locales.find((l) => l.id === localSel)?.comuna ?? ""}
              onClose={() => setEditing(null)}
            />
          );
        })()}
    </div>
  );
}

function FragmentRow({
  fila,
  estado,
  esConsolidado,
  mostrarEditar,
  etiquetaEditar,
  expandido,
  onEdit,
  onExpand,
}: {
  fila: Fila;
  estado: { label: string; cls: string };
  esConsolidado: boolean;
  mostrarEditar: boolean;
  etiquetaEditar: string;
  expandido: boolean;
  onEdit: () => void;
  onExpand: () => void;
}) {
  const p = fila.p;
  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-500">{p.sku}</td>
        <td className="px-3 py-2">
          <button
            type="button"
            onClick={onExpand}
            className="block w-full max-w-md text-left"
            title={esConsolidado ? "Ver desglose por local" : "Ver stock en otros locales"}
          >
            <p className="truncate font-semibold leading-tight text-navy-950">
              <span
                aria-hidden="true"
                className={`mr-1 inline-block text-xs text-slate-400 transition-transform ${
                  expandido ? "rotate-90" : ""
                }`}
              >
                ▸
              </span>
              {p.nombre}
              <span className="ml-1.5 text-xs font-normal text-slate-400">{p.marca}</span>
            </p>
          </button>
        </td>
        <td className="px-3 py-2 text-right text-base font-bold tabular-nums text-navy-950">
          {fila.cantidad}
        </td>
        <td className="whitespace-nowrap px-4 py-2 text-right text-slate-600">
          {fila.stockMin} / {fila.stockMax ?? "—"}
        </td>
        <td className="px-4 py-2 text-slate-600">{fila.ubicacion ?? "—"}</td>
        <td className="whitespace-nowrap px-4 py-2">
          <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${estado.cls}`}>
            {estado.label}
          </span>
        </td>
        <td className="px-4 py-2 text-right">
          <div className="flex justify-end gap-1.5">
            <a
              href={`/dashboard/inventario/registrar?producto=${p.productoId}`}
              title="Registrar movimiento de este producto"
              className="whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
            >
              ↕ Mov.
            </a>
            {mostrarEditar && (
              <button
                type="button"
                onClick={onEdit}
                title={
                  esConsolidado
                    ? "Ficha maestra del producto (todos los locales)"
                    : "Parámetros de stock de este local"
                }
                className="whitespace-nowrap rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
              >
                {etiquetaEditar}
              </button>
            )}
          </div>
        </td>
      </tr>
      {expandido && (
        <tr className="border-b border-slate-100 bg-electric-50/40">
          <td colSpan={7} className="px-5 py-3">
            <div className="flex flex-wrap items-center gap-3 pl-4 text-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {esConsolidado ? "Stock por local:" : "Stock en otros locales:"}
              </span>
              {fila.desglose.length > 0 ? (
                fila.desglose.map((o) => (
                  <span
                    key={o.nombre}
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      o.cantidad > 0
                        ? "bg-lime-400/15 text-[#4d7c0f]"
                        : "bg-fenix-600/10 text-fenix-600"
                    }`}
                  >
                    {o.nombre}: {o.cantidad} un.
                  </span>
                ))
              ) : (
                <span className="text-slate-400">Sin registros en otros locales.</span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
