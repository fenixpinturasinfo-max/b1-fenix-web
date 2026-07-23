"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { registrarVenta, type ActionState } from "../actions";
import { formatCLP } from "@/lib/format";

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
  const [flash, setFlash] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(registrarVenta, {});

  // Limpiar carro tras venta exitosa
  useEffect(() => {
    if (state.ventaCorrelativo) {
      setLineas([]);
      setPagaCon("");
    }
  }, [state.ventaCorrelativo]);

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
      productos.filter((p) => {
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
      }),
    [q, cat, productos],
  );

  const agregar = (p: PosProducto) => {
    if (p.stock <= 0) return;
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
        <input
          id="pos-buscar"
          type="search"
          autoFocus
          placeholder="Escanea o busca por nombre, SKU, marca o código…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onScan}
          className="h-14 w-full rounded-2xl border-2 border-slate-300 bg-white px-5 text-lg text-navy-950 outline-none transition focus:border-electric-500"
        />

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
        <div className="mt-4 grid max-h-[62vh] grid-cols-2 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
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
              <div className="relative flex h-24 items-center justify-center bg-cloud">
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
              <div className="flex flex-1 flex-col p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-electric-600">
                  {p.marca}
                </p>
                <p className="line-clamp-2 text-sm font-semibold leading-tight text-navy-950">
                  {p.nombre}
                </p>
                <p className="mt-auto pt-1.5 font-black tabular-nums text-navy-950">
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
      <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2 lg:max-h-[78vh]">
        <h2 className="mb-3 flex items-center justify-between text-lg font-bold text-navy-950">
          Venta actual
          {nItems > 0 && (
            <span className="rounded-full bg-electric-50 px-3 py-1 text-xs font-bold text-electric-600">
              {nItems} ítems
            </span>
          )}
        </h2>

        {lineas.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Toca un producto para agregarlo.
          </p>
        ) : (
          <ul className="flex-1 space-y-3 overflow-y-auto pr-1">
            {lineas.map((l) => (
              <li key={l.producto.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-navy-950">{l.producto.nombre}</p>
                  <button
                    type="button"
                    onClick={() => setCantidad(l.producto.id, 0)}
                    className="text-xs text-slate-400 hover:text-fenix-600"
                    aria-label={`Quitar ${l.producto.nombre}`}
                  >
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setCantidad(l.producto.id, l.cantidad - 1)}
                      className="h-9 w-9 font-bold text-navy-950 hover:bg-cloud"
                      aria-label="Disminuir"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-navy-950">{l.cantidad}</span>
                    <button
                      type="button"
                      onClick={() => setCantidad(l.producto.id, l.cantidad + 1)}
                      className="h-9 w-9 font-bold text-navy-950 hover:bg-cloud"
                      aria-label="Aumentar"
                    >
                      +
                    </button>
                  </div>
                  <span className="font-bold tabular-nums text-navy-950">
                    {formatCLP(l.cantidad * l.producto.precioVenta)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className="mb-4 flex items-center justify-between text-xl">
            <span className="font-semibold text-slate-600">Total</span>
            <span className="font-black tabular-nums text-navy-950">{formatCLP(total)}</span>
          </div>

          <form action={action} className="space-y-3">
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
            {state.ventaCorrelativo && (
              <div role="status" className="rounded-xl border border-lime-400/40 bg-lime-400/15 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#4d7c0f]">
                  Venta registrada · Boleta
                </p>
                <p className="font-mono text-2xl font-black text-navy-950">{state.ventaCorrelativo}</p>
                {state.ventaId && (
                  <a
                    href={`/dashboard/pos/boletas/${state.ventaId}`}
                    className="mt-1 inline-block text-sm font-bold text-electric-600 underline-offset-4 hover:underline"
                  >
                    Ver / imprimir boleta →
                  </a>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={pending || lineas.length === 0}
              className="bg-flame h-14 w-full rounded-xl text-lg font-black text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {pending ? "Registrando…" : `Cobrar ${formatCLP(total)}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
