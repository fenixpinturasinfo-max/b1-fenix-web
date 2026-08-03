"use client";

import { useActionState, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { registrarVenta, type ActionState } from "../actions";
import { CierreVenta, TiraUltimaVenta, type VentaCerrada } from "./CierreVenta";
import { formatCLP } from "@/lib/format";
import { IconTrash } from "@/components/ui/icons";

export interface PosProducto {
  id: string;
  sku: string;
  codigoBarra: string | null;
  nombre: string;
  marca: string;
  categoria: string;
  imagen: string | null;
  precioVenta: number;
  stock: number;
}

interface Linea {
  producto: PosProducto;
  cantidad: number;
}

/** Placeholder de lata cuando el producto no tiene foto. */
function CanIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 64 64" fill="none" aria-hidden="true" className="opacity-70">
      <rect x="16" y="18" width="32" height="38" rx="3" fill="#ffffff" stroke="#2a3650" strokeWidth="2" />
      <rect x="16" y="24" width="32" height="8" fill="#ff4d26" />
      <path d="M20 18v-4a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v4" stroke="#2a3650" strokeWidth="2" />
    </svg>
  );
}

export function PosVenta({ cajaId, productos }: { cajaId: string; productos: PosProducto[] }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("todas");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [medioPago, setMedioPago] = useState("EFECTIVO");
  const [pagaCon, setPagaCon] = useState("");
  const [premium, setPremium] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  /** Venta recién cobrada: se conserva aparte del carro, que ya se vació */
  const [cerrada, setCerrada] = useState<VentaCerrada | null>(null);
  const [modalCierre, setModalCierre] = useState(false);
  /** Explícito, no derivado de que el carro esté vacío: si el cajero borra las líneas
   *  a mano, la boleta anterior no debe reaparecer en medio de la venta nueva. */
  const [mostrarTira, setMostrarTira] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  const cobrando = useRef(false);

  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      try {
        // El monto que entregó el cliente solo existe en el cliente: hay que guardarlo
        // antes de vaciar el carro, o el vuelto desaparece justo al entregar el cambio.
        const pago = pagaCon === "" ? null : Math.trunc(Number(pagaCon));
        const medio = String(fd.get("medioPago") ?? medioPago);

        const res = await registrarVenta(prev, fd);
        if (!res.ventaCorrelativo) return res;

        // El total viene del servidor, que recalcula los precios desde la BD. Tomarlo del
        // carro daría un vuelto equivocado si el precio cambió con el POS abierto.
        const cobrado = res.ventaTotal ?? 0;
        setCerrada({
          folio: res.ventaCorrelativo,
          ventaId: res.ventaId ?? null,
          total: cobrado,
          pagoCon: medio === "EFECTIVO" ? pago : null,
          vuelto: medio === "EFECTIVO" && pago !== null ? pago - cobrado : null,
          medioPago: medio,
          premium: fd.get("premium") === "on",
        });
        setModalCierre(true);
        setMostrarTira(true);
        setLineas([]);
        setPagaCon("");
        // Se apaga para la venta siguiente: dejarlo encendido marcaría Premium a todo el
        // que venga después, y es el tipo de error que nadie nota hasta ver el reporte.
        setPremium(false);
        return res;
      } finally {
        cobrando.current = false;
      }
    },
    {},
  );

  /**
   * Cierra el cierre de venta y deja el POS listo para la siguiente.
   * Si el cajero ya empezó a escanear, esa primera tecla no se pierde.
   */
  const nuevaVenta = useCallback((charInicial?: string) => {
    setModalCierre(false);
    setQuery(charInicial ?? "");
    buscador.current?.focus();
  }, []);

  // Feedback visual al agregar
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 400);
    return () => clearTimeout(t);
  }, [flash]);

  const categorias = useMemo(
    () => [...new Set(productos.map((p) => p.categoria))].sort(),
    [productos],
  );

  const q = query.trim().toLowerCase();
  const visibles = useMemo(
    () =>
      productos
        .filter((p) => {
          if (cat !== "todas" && p.categoria !== cat) return false;
          if (
            q &&
            !p.nombre.toLowerCase().includes(q) &&
            !p.sku.toLowerCase().includes(q) &&
            !p.marca.toLowerCase().includes(q) &&
            !(p.codigoBarra ?? "").includes(q)
          )
            return false;
          return true;
        })
        // Con stock primero; los sin stock quedan visibles al final
        .sort((a, b) => Number(b.stock > 0) - Number(a.stock > 0)),
    [q, cat, productos],
  );

  const agregar = (p: PosProducto) => {
    if (p.stock <= 0) return;
    // Empezó la venta siguiente: la boleta anterior deja de estar a mano
    setMostrarTira(false);
    setLineas((ls) => {
      const existe = ls.find((l) => l.producto.id === p.id);
      if (existe) {
        return ls.map((l) =>
          l.producto.id === p.id
            ? { ...l, cantidad: Math.min(l.cantidad + 1, p.stock) }
            : l,
        );
      }
      return [...ls, { producto: p, cantidad: 1 }];
    });
    setFlash(p.id);
    // Volver al catálogo completo para la siguiente búsqueda
    setQuery("");
  };

  /** Escáner: código + Enter agrega directo. */
  const onScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const code = query.trim();
    if (!code) return;
    const exacto = productos.find(
      (p) => p.codigoBarra === code || p.sku.toLowerCase() === code.toLowerCase(),
    );
    if (exacto && exacto.stock > 0) {
      e.preventDefault();
      agregar(exacto);
      setQuery("");
    }
  };

  const setCantidad = (id: string, cantidad: number) => {
    setLineas((ls) =>
      cantidad <= 0
        ? ls.filter((l) => l.producto.id !== id)
        : ls.map((l) =>
            l.producto.id === id
              ? { ...l, cantidad: Math.min(cantidad, l.producto.stock) }
              : l,
          ),
    );
  };

  const total = lineas.reduce((n, l) => n + l.cantidad * l.producto.precioVenta, 0);
  const nItems = lineas.reduce((n, l) => n + l.cantidad, 0);

  // Vuelto (solo efectivo, cálculo en pantalla)
  const pagaConNum = pagaCon === "" ? null : Math.trunc(Number(pagaCon));
  const vuelto = pagaConNum !== null ? pagaConNum - total : null;
  const billetes = [1000, 2000, 5000, 10000, 20000];
  const sugerencias = [
    total,
    ...billetes.filter((b) => b > total),
    ...billetes.map((b) => Math.ceil(total / b) * b).filter((v) => v > total),
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .sort((a, b) => a - b)
    .slice(0, 4);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      {/* Catálogo */}
      <div className="lg:col-span-3">
        <label htmlFor="pos-buscar" className="sr-only">Buscar producto</label>
        <div className="relative">
          <input
            id="pos-buscar"
            ref={buscador}
            type="search"
            autoFocus
            placeholder="Escanea o busca por nombre, SKU, marca o código…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onScan}
            className="h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 pr-12 text-lg text-navy-950 outline-none transition focus:border-electric-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Limpiar búsqueda y ver todos los artículos"
              title="Ver todos los artículos"
              className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
            >
              ✕
            </button>
          )}
        </div>

        {/* Chips de categoría */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCat("todas")}
            aria-pressed={cat === "todas"}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold transition ${
              cat === "todas"
                ? "bg-electric-600 text-white"
                : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
            }`}
          >
            Todas
          </button>
          {categorias.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={`h-9 shrink-0 rounded-full px-4 text-sm font-bold transition ${
                cat === c
                  ? "bg-electric-600 text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:border-electric-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Grilla de tarjetas */}
        <p className="mt-3 text-xs text-slate-400">
          {visibles.length} artículo{visibles.length === 1 ? "" : "s"}
          {cat !== "todas" ? ` en ${cat}` : ""}
          {q ? ` para “${query.trim()}”` : ""}
        </p>
        <div className="mt-2 grid max-h-[calc(100vh-330px)] grid-cols-2 content-start gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
          {visibles.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => agregar(p)}
              disabled={p.stock <= 0}
              className={`group flex flex-col overflow-hidden rounded-2xl border bg-white text-left transition active:scale-[0.97] disabled:opacity-40 ${
                flash === p.id
                  ? "border-lime-400 shadow-[0_0_0_3px_rgba(166,226,46,0.3)]"
                  : "border-slate-200 hover:-translate-y-0.5 hover:border-electric-500 hover:shadow-card"
              }`}
            >
              <div className="relative flex h-14 items-center justify-center bg-cloud">
                {p.imagen ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.imagen}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <CanIcon />
                )}
                <span
                  className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    p.stock <= 0
                      ? "bg-fenix-600 text-white"
                      : p.stock <= 3
                        ? "bg-[#f59e0b] text-white"
                        : "bg-white/90 text-slate-600"
                  }`}
                >
                  {p.stock <= 0 ? "Sin stock" : `${p.stock} un.`}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-2">
                <p className="text-[9px] font-bold uppercase tracking-wider text-electric-600">
                  {p.marca}
                </p>
                <p className="line-clamp-2 text-xs font-semibold leading-tight text-navy-950">
                  {p.nombre}
                </p>
                <p className="mt-auto pt-1 text-sm font-black tabular-nums text-navy-950">
                  {formatCLP(p.precioVenta)}
                </p>
              </div>
            </button>
          ))}
          {visibles.length === 0 && (
            <p className="col-span-full py-10 text-center text-sm text-slate-400">
              Sin resultados para tu búsqueda.
            </p>
          )}
        </div>
      </div>

      {/* Carro */}
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-4 lg:col-span-2 lg:max-h-[calc(100vh-140px)] lg:self-start">
        {/* Rastro de la venta anterior: se va con el primer producto de la siguiente */}
        {cerrada && mostrarTira && (
          <TiraUltimaVenta
            venta={cerrada}
            onVerCierre={() => setModalCierre(true)}
            onDescartar={() => setMostrarTira(false)}
          />
        )}

        <h2 className="mb-3 flex items-center justify-between text-lg font-bold text-navy-950">
          Venta actual
          {nItems > 0 && (
            <span className="rounded-full bg-electric-50 px-3 py-1 text-xs font-bold text-electric-600">
              {nItems} un.
            </span>
          )}
        </h2>

        {lineas.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {cerrada
              ? "Escanea o toca un producto para la siguiente venta."
              : "Toca un producto para agregarlo."}
          </p>
        ) : (
          <ul className="max-h-[38vh] min-h-0 divide-y divide-slate-100 overflow-y-auto pr-1 lg:max-h-none lg:flex-1">
            {lineas.map((l) => (
              <li key={l.producto.id} className="flex items-center gap-2 py-1.5">
                {/* Cantidad compacta */}
                <div className="flex shrink-0 items-center overflow-hidden rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setCantidad(l.producto.id, l.cantidad - 1)}
                    className="h-7 w-7 bg-cloud/60 text-sm font-bold text-navy-950 transition hover:bg-electric-50 hover:text-electric-600"
                    aria-label={`Disminuir ${l.producto.nombre}`}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={l.producto.stock}
                    value={l.cantidad}
                    onChange={(e) =>
                      setCantidad(
                        l.producto.id,
                        Math.max(1, Math.trunc(Number(e.target.value)) || 1),
                      )
                    }
                    aria-label={`Cantidad de ${l.producto.nombre}`}
                    className="h-7 w-9 border-x border-slate-300 bg-white text-center text-xs font-bold text-navy-950 outline-none focus:bg-electric-50/40 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCantidad(l.producto.id, l.cantidad + 1)}
                    disabled={l.cantidad >= l.producto.stock}
                    className="h-7 w-7 bg-cloud/60 text-sm font-bold text-navy-950 transition hover:bg-electric-50 hover:text-electric-600 disabled:opacity-30"
                    aria-label={`Aumentar ${l.producto.nombre}`}
                  >
                    +
                  </button>
                </div>

                {/* Producto */}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-[13px] font-semibold leading-tight text-navy-950"
                    title={l.producto.nombre}
                  >
                    {l.producto.nombre}
                  </p>
                  <p className="text-[11px] leading-tight text-slate-400">
                    {formatCLP(l.producto.precioVenta)} c/u
                    {l.cantidad >= l.producto.stock && (
                      <b className="text-[#b45309]"> · máx {l.producto.stock}</b>
                    )}
                  </p>
                </div>

                {/* Subtotal + quitar */}
                <span className="shrink-0 text-[13px] font-bold tabular-nums text-navy-950">
                  {formatCLP(l.cantidad * l.producto.precioVenta)}
                </span>
                <button
                  type="button"
                  onClick={() => setCantidad(l.producto.id, 0)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition hover:bg-fenix-600/10 hover:text-fenix-600"
                  aria-label={`Eliminar ${l.producto.nombre} de la venta`}
                  title="Eliminar de la venta"
                >
                  <IconTrash size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="mb-4 flex items-center justify-between text-xl">
            <span className="font-semibold text-slate-600">Total</span>
            <span className="font-black tabular-nums text-navy-950">{formatCLP(total)}</span>
          </div>

          <form
            action={action}
            onSubmit={(e) => {
              // Dos clics en el mismo frame envían dos veces. `pending` recién existe tras
              // el re-render y useActionState encola, así que el segundo llegaría igual y
              // registraría otra venta con doble descuento de stock. Se corta acá.
              if (cobrando.current) {
                e.preventDefault();
                return;
              }
              cobrando.current = true;
            }}
            className="space-y-3"
          >
            <input type="hidden" name="cajaId" value={cajaId} />
            <input
              type="hidden"
              name="lineas"
              value={JSON.stringify(lineas.map((l) => ({ productoId: l.producto.id, cantidad: l.cantidad })))}
            />
            <div>
              <label htmlFor="medioPago" className="mb-1 block text-sm font-semibold text-slate-700">
                Medio de pago
              </label>
              <select
                id="medioPago"
                name="medioPago"
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none focus:border-electric-500"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="DEBITO">Débito</option>
                <option value="CREDITO">Crédito</option>
                <option value="TRANSFERENCIA">Transferencia</option>
              </select>
            </div>

            {/* Marca Premium.
                Va antes de cobrar y no al final, junto al total, para que quede claro que
                no lo modifica: si estuviera pegado al botón de cobrar, el cajero podría
                esperar que el precio cambie al activarlo. El texto lo dice explícito. */}
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                premium
                  ? "border-[#f59e0b] bg-[#f59e0b]/10"
                  : "border-slate-300 bg-white hover:border-[#f59e0b]/60"
              }`}
            >
              <input
                type="checkbox"
                name="premium"
                checked={premium}
                onChange={(e) => setPremium(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#b45309]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-navy-950">⭐ Venta Premium</span>
                <span className="block text-xs text-slate-500">
                  Queda marcada en la boleta y en los reportes. No cambia el total.
                </span>
              </span>
            </label>

            {/* Vuelto (solo efectivo) */}
            {medioPago === "EFECTIVO" && total > 0 && (
              <div className="rounded-xl border border-slate-200 bg-cloud/60 p-3">
                <label htmlFor="pagaCon" className="mb-1 block text-sm font-semibold text-slate-700">
                  Paga con
                </label>
                <input
                  id="pagaCon"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Monto que entrega el cliente"
                  value={pagaCon}
                  onChange={(e) => setPagaCon(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none focus:border-electric-500"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sugerencias.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPagaCon(String(s))}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                    >
                      {s === total ? "Justo" : formatCLP(s)}
                    </button>
                  ))}
                </div>
                {vuelto !== null && (
                  <div
                    className={`mt-3 flex items-center justify-between rounded-xl px-4 py-2.5 ${
                      vuelto < 0 ? "bg-fenix-600/10" : "bg-lime-400/15"
                    }`}
                  >
                    <span
                      className={`text-sm font-bold ${vuelto < 0 ? "text-fenix-600" : "text-[#4d7c0f]"}`}
                    >
                      {vuelto < 0 ? "Falta" : "Vuelto"}
                    </span>
                    <span
                      className={`text-2xl font-black tabular-nums ${
                        vuelto < 0 ? "text-fenix-600" : "text-[#4d7c0f]"
                      }`}
                    >
                      {formatCLP(Math.abs(vuelto))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {state.error && (
              <p role="alert" className="text-sm font-semibold text-fenix-600">{state.error}</p>
            )}

            <button
              type="submit"
              disabled={pending || lineas.length === 0}
              className="bg-flame h-14 w-full rounded-xl text-lg font-black text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "Registrando…" : `Cobrar ${formatCLP(total)}`}
            </button>
          </form>

          {/* El cierre se muestra en CierreVenta, fuera del panel: el aviso pegado acá
              permitía imprimir la boleta anterior mientras se cargaba la siguiente. */}
        </div>
      </div>

      {cerrada && modalCierre && (
        <CierreVenta venta={cerrada} onNuevaVenta={nuevaVenta} />
      )}
    </div>
  );
}
