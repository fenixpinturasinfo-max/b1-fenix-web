"use client";

import { useCallback, useState } from "react";
import { SocioForm, type SocioData } from "./SocioForm";
import { toggleSocioActivo } from "../actions";
import { Modal } from "@/components/ui/Modal";
import { Paginacion } from "@/components/ui/Paginacion";
import { BuscadorLista, ChipsFiltro, TablaScroll, theadSticky } from "@/components/ui/lista";

export type SocioItem = SocioData & { activo: boolean };

type Estado = "TODOS" | "ACTIVOS" | "INACTIVOS";

const PAGINA = 10;

const pagoLabel: Record<string, string> = {
  CONTADO: "Contado",
  "30D": "30 días",
  "60D": "60 días",
  "90D": "90 días",
};

export function SociosList({ socios, tipo }: { socios: SocioItem[]; tipo: string }) {
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<Estado>("TODOS");
  const [pagina, setPagina] = useState(1);
  const [sucio, setSucio] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);

  const etiqueta = tipo === "CLIENTE" ? "cliente" : "proveedor";

  const q = query.trim().toLowerCase();
  const filtrados = socios.filter((s) => {
    if (estado === "ACTIVOS" && !s.activo) return false;
    if (estado === "INACTIVOS" && s.activo) return false;
    if (!q) return true;
    return [s.razonSocial, s.nombreFantasia, s.rut, s.comuna, s.giro, s.email]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });
  const visibles = filtrados.slice((pagina - 1) * PAGINA, pagina * PAGINA);

  const nActivos = socios.filter((s) => s.activo).length;
  const enEdicion = socios.find((s) => s.id === editando) ?? null;

  const cerrarEdicion = useCallback(() => {
    if (sucio && !window.confirm("Hay cambios sin guardar. ¿Cerrar de todas formas?")) return;
    setEditando(null);
    setSucio(false);
  }, [sucio]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Estado>
          opciones={[
            { valor: "TODOS", label: "Todos", n: socios.length },
            { valor: "ACTIVOS", label: "Activos", n: nActivos },
            { valor: "INACTIVOS", label: "Inactivos", n: socios.length - nActivos },
          ]}
          valor={estado}
          onChange={(v) => {
            setEstado(v);
            setPagina(1);
          }}
        />
        <BuscadorLista
          value={query}
          onChange={(v) => {
            setQuery(v);
            setPagina(1);
          }}
          placeholder="Nombre, RUT, giro o comuna…"
        />
      </div>

      <TablaScroll>
        <thead className={theadSticky}>
          <tr>
            <th className="px-4 py-2.5">Nombre</th>
            <th className="px-4 py-2.5">RUT</th>
            <th className="px-4 py-2.5">Giro</th>
            <th className="px-4 py-2.5">Contacto</th>
            <th className="px-4 py-2.5">Comuna</th>
            <th className="px-4 py-2.5">Pago</th>
            {tipo === "CLIENTE" && <th className="px-4 py-2.5">Dcto.</th>}
            <th className="px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {visibles.map((s) => (
            <tr
              key={s.id}
              onClick={() => setEditando(s.id)}
              title="Editar ficha"
              className="cursor-pointer border-b border-slate-100 transition last:border-0 hover:bg-electric-50/40"
            >
              <td className="px-4 py-2">
                <span className="font-bold text-navy-950">
                  {s.nombreFantasia ?? s.razonSocial}
                </span>
                {s.nombreFantasia && (
                  <span className="block text-xs text-slate-400">{s.razonSocial}</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 font-mono text-slate-600">{s.rut}</td>
              <td className="px-4 py-2 text-slate-600">{s.giro ?? "—"}</td>
              <td className="px-4 py-2 text-slate-600">
                {s.email ?? "—"}
                {s.telefono && <span className="block text-xs text-slate-400">{s.telefono}</span>}
              </td>
              <td className="px-4 py-2 text-slate-600">{s.comuna ?? "—"}</td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                {s.condicionPago ? (pagoLabel[s.condicionPago] ?? s.condicionPago) : "—"}
              </td>
              {tipo === "CLIENTE" && (
                <td className="whitespace-nowrap px-4 py-2">
                  <span className="flex items-center gap-1.5">
                    {s.descuentoPorcentaje > 0 ? (
                      <span className="rounded-full bg-[#f59e0b]/15 px-2.5 py-0.5 text-xs font-bold text-[#b45309]">
                        {s.descuentoPorcentaje}%
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                    {s.cuentaAbierta && (
                      <span
                        title="Puede retirar a cuenta y pagar al cierre"
                        className="rounded-full bg-electric-50 px-2.5 py-0.5 text-xs font-bold text-electric-600"
                      >
                        Cuenta
                      </span>
                    )}
                  </span>
                </td>
              )}
              <td className="px-4 py-2">
                <span
                  className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    s.activo ? "bg-lime-400/15 text-[#4d7c0f]" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {s.activo ? "Activo" : "Inactivo"}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditando(s.id);
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
                  >
                    Editar
                  </button>
                  <form action={toggleSocioActivo} onClick={(e) => e.stopPropagation()}>
                    <input type="hidden" name="id" value={s.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-fenix-500 hover:text-fenix-600"
                    >
                      {s.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>
              </td>
            </tr>
          ))}
          {visibles.length === 0 && (
            <tr>
              <td colSpan={tipo === "CLIENTE" ? 9 : 8} className="px-4 py-10 text-center text-sm text-slate-400">
                {socios.length === 0
                  ? `Aún no hay ${etiqueta}s registrados. Crea el primero con “＋ Nuevo ${etiqueta}”.`
                  : "Sin resultados para tu búsqueda."}
              </td>
            </tr>
          )}
        </tbody>
      </TablaScroll>

      <div className="flex justify-center">
        <Paginacion
          total={filtrados.length}
          pagina={pagina}
          porPagina={PAGINA}
          onChange={setPagina}
        />
      </div>

      {enEdicion && (
        <Modal
          titulo={enEdicion.nombreFantasia ?? enEdicion.razonSocial}
          descripcion={`RUT ${enEdicion.rut} · ${enEdicion.tipo.toLowerCase()}`}
          ancho="max-w-4xl"
          onClose={cerrarEdicion}
        >
          <SocioForm
            socio={enEdicion}
            onChange={() => setSucio(true)}
            onDone={() => {
              setSucio(false);
              setEditando(null);
            }}
            onCancel={cerrarEdicion}
          />
        </Modal>
      )}
    </div>
  );
}
