"use client";

import { useActionState, useEffect, useState } from "react";
import { crearProducto, type ActionState } from "../actions";

interface CategoriaOption {
  id: string;
  nombre: string;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function ProductForm({ categorias }: { categorias: CategoriaOption[] }) {
  const [abierto, setAbierto] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(crearProducto, {});

  // Tras crear con éxito, el formulario ya no tiene cambios sin guardar
  useEffect(() => {
    if (state.ok) setSucio(false);
  }, [state.ok]);

  const cerrar = () => {
    if (sucio && !window.confirm("Hay datos sin guardar. ¿Cerrar de todas formas?")) return;
    setAbierto(false);
    setSucio(false);
  };

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, sucio]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-flame h-10 rounded-xl px-4 text-sm font-bold leading-10 text-white transition hover:opacity-90"
      >
        ＋ Nuevo producto
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 p-4"
          onClick={cerrar}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Nuevo producto"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-navy-950">＋ Nuevo producto</h2>
                <p className="text-sm text-slate-500">
                  Se agrega al catálogo de todos los locales y a la tienda online.
                </p>
              </div>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-cloud hover:text-navy-950"
              >
                ✕
              </button>
            </div>

            <form
              action={action}
              onChange={() => setSucio(true)}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div>
                <label htmlFor="p-nombre" className="mb-1 block text-sm font-semibold text-slate-700">
                  Nombre *
                </label>
                <input id="p-nombre" name="nombre" required placeholder="Laca HS 1Lt Kit" className={input} />
              </div>
              <div>
                <label htmlFor="p-marca" className="mb-1 block text-sm font-semibold text-slate-700">
                  Marca *
                </label>
                <input id="p-marca" name="marca" required placeholder="Sikkens" className={input} />
              </div>
              <div>
                <label htmlFor="p-cat" className="mb-1 block text-sm font-semibold text-slate-700">
                  Categoría *
                </label>
                <select id="p-cat" name="categoriaId" required className={input} defaultValue="">
                  <option value="" disabled>— Selecciona —</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="p-venta" className="mb-1 block text-sm font-semibold text-slate-700">
                  Precio venta (CLP) *
                </label>
                <input id="p-venta" name="precioVenta" type="number" min={1} required className={input} />
              </div>
              <div>
                <label htmlFor="p-costo" className="mb-1 block text-sm font-semibold text-slate-700">
                  Precio costo (CLP)
                </label>
                <input id="p-costo" name="precioCosto" type="number" min={0} className={input} />
              </div>
              <div>
                <label htmlFor="p-sku" className="mb-1 block text-sm font-semibold text-slate-700">
                  SKU (vacío = automático)
                </label>
                <input id="p-sku" name="sku" placeholder="SIK-LHS-1L" className={`${input} uppercase`} />
              </div>
              <div>
                <label htmlFor="p-cb" className="mb-1 block text-sm font-semibold text-slate-700">
                  Código de barra
                </label>
                <input id="p-cb" name="codigoBarra" placeholder="Escanea aquí" className={input} />
              </div>
              <div>
                <label htmlFor="p-img" className="mb-1 block text-sm font-semibold text-slate-700">
                  Imagen (URL o /productos/archivo.jpg)
                </label>
                <input id="p-img" name="imagen" placeholder="https://… o /productos/laca-hs.jpg" className={input} />
              </div>

              <div className="flex items-center gap-2 sm:col-span-2">
                <button
                  type="submit"
                  disabled={pending}
                  className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? "Creando…" : "Crear producto"}
                </button>
                <button
                  type="button"
                  onClick={cerrar}
                  className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600"
                >
                  Cerrar
                </button>
              </div>

              {state.error && (
                <p role="alert" className="text-sm font-semibold text-fenix-600 sm:col-span-2">
                  {state.error}
                </p>
              )}
              {state.ok && (
                <p role="status" className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2">
                  ✅ {state.ok}
                </p>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
