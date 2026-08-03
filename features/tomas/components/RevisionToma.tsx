"use client";

import { useActionState, useState } from "react";
import { aplicarToma, guardarMotivo, pedirRecuento, type ActionState } from "../actions";
import {
  MOTIVOS,
  motivoLabel,
  origenLineaLabel,
  UMBRAL_MOTIVO,
  UMBRAL_RECUENTO,
} from "../toma";
import type { LineaDetalle, TomaDetalle } from "../queries";
import { AnularTomaButton } from "./AnularTomaButton";
import { Modal } from "@/components/ui/Modal";
import { ChipsFiltro } from "@/components/ui/lista";
import { formatCLP } from "@/lib/format";
import { fmtHora } from "@/lib/fechas";

type Filtro = "DIF" | "OK" | "SIN";

/**
 * Revisión previa a tocar el stock.
 *
 * Por defecto solo las diferencias: las que cuadraron no necesitan atención. Y el valor en
 * pesos al frente, porque "faltan 8 unidades" no es una decisión y "−$96.000" sí.
 */
export function RevisionToma({
  toma,
  puedeAplicar,
}: {
  toma: TomaDetalle;
  puedeAplicar: boolean;
}) {
  const [filtro, setFiltro] = useState<Filtro>("DIF");
  const [confirmar, setConfirmar] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const res = await aplicarToma(prev, fd);
      if (res.ok) setConfirmar(false);
      return res;
    },
    {},
  );

  const contadas = toma.lineas.filter((l) => l.contado !== null);
  const conDif = contadas.filter((l) => l.diferencia !== 0);
  const cuadraron = contadas.filter((l) => l.diferencia === 0);
  const sinContar = toma.lineas.filter((l) => l.contado === null);

  const impacto = conDif.reduce((n, l) => n + l.valorDiferencia, 0);
  const grandes = conDif.filter((l) => Math.abs(l.diferencia ?? 0) >= UMBRAL_RECUENTO);
  const sinMotivo = conDif.filter(
    (l) => !l.motivo && Math.abs(l.valorDiferencia) >= UMBRAL_MOTIVO,
  );

  // Faltantes y sobrantes por separado, no solo el neto: −$232.000 de faltante con
  // +$50.000 de sobrante se ven igual que −$182.000 parejos, y no son lo mismo. Un
  // faltante apunta a merma o robo; un sobrante, a un error de recepción o de digitación.
  const faltantes = conDif.filter((l) => (l.diferencia ?? 0) < 0);
  const sobrantes = conDif.filter((l) => (l.diferencia ?? 0) > 0);
  const valorFaltantes = faltantes.reduce((n, l) => n + l.valorDiferencia, 0);
  const valorSobrantes = sobrantes.reduce((n, l) => n + l.valorDiferencia, 0);

  const visibles = filtro === "DIF" ? conDif : filtro === "OK" ? cuadraron : sinContar;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Cuadraron" valor={`${cuadraron.length} de ${contadas.length}`} tono="ok" />
        <Kpi
          label="Con diferencia"
          valor={String(conDif.length)}
          tono={conDif.length > 0 ? "atencion" : "ok"}
        />
        <Kpi
          label="Impacto en el inventario"
          valor={impacto === 0 ? "Sin impacto" : formatCLP(impacto)}
          tono={impacto < 0 ? "malo" : impacto > 0 ? "ok" : "neutro"}
          // El neto solo: el desglose evita leer un faltante grande como algo menor
          detalle={
            faltantes.length > 0 && sobrantes.length > 0
              ? `${formatCLP(valorFaltantes)} faltante · +${formatCLP(valorSobrantes)} sobrante`
              : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ChipsFiltro<Filtro>
          opciones={[
            { valor: "DIF", label: "Con diferencia", n: conDif.length },
            { valor: "OK", label: "Cuadraron", n: cuadraron.length },
            { valor: "SIN", label: "Sin contar", n: sinContar.length },
          ]}
          valor={filtro}
          onChange={setFiltro}
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2.5">Producto</th>
              <th className="px-4 py-2.5 text-right">Sistema</th>
              <th className="px-4 py-2.5 text-right">Contado</th>
              <th className="px-4 py-2.5 text-right">Valor</th>
              <th className="px-4 py-2.5">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((l) => (
              <Fila
                key={l.id}
                linea={l}
                editable={puedeAplicar && toma.estado === "CONTADA" && l.diferencia !== 0}
              />
            ))}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">
                  {filtro === "DIF"
                    ? "Ninguna diferencia. El conteo cuadró con el sistema."
                    : filtro === "SIN"
                      ? "No quedó ningún producto sin contar."
                      : "Nada en este grupo."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {toma.estado === "CONTADA" && puedeAplicar && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
          {grandes.length > 0 && (
            <span className="text-sm text-[#b45309]">
              {grandes.length}{" "}
              {grandes.length === 1 ? "diferencia supera" : "diferencias superan"} las{" "}
              {UMBRAL_RECUENTO} unidades: conviene recontar antes de aplicar.
            </span>
          )}
          {state.error && (
            <span role="alert" className="text-sm font-semibold text-fenix-600">
              {state.error}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <AnularTomaButton
              tomaId={toma.id}
              folio={toma.folio}
              estado="CONTADA"
              contadas={contadas.length}
              total={toma.lineas.length}
            />
            <form action={pedirRecuento}>
              <input type="hidden" name="tomaId" value={toma.id} />
              <button
                type="submit"
                className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
              >
                Pedir recuento
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmar(true)}
              className="bg-flame h-11 rounded-xl px-5 font-bold text-white transition hover:opacity-90"
            >
              Aplicar al stock
            </button>
          </div>
        </div>
      )}

      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f]">
          ✅ {state.ok}
        </p>
      )}

      {confirmar && (
        <Modal
          titulo="¿Crear los ajustes de inventario?"
          descripcion={`Vas a corregir el stock de ${conDif.length} ${conDif.length === 1 ? "producto" : "productos"} en ${toma.localNombre}.`}
          onClose={() => setConfirmar(false)}
        >
          <div className="space-y-3 text-sm">
            {/* Faltantes y sobrantes separados: el neto solo esconde la mitad del problema */}
            <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200">
              {faltantes.length > 0 && (
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-slate-600">
                    ▼ Faltantes · {faltantes.length}{" "}
                    {faltantes.length === 1 ? "producto" : "productos"}
                  </dt>
                  <dd className="font-bold tabular-nums text-fenix-600">
                    {formatCLP(valorFaltantes)}
                  </dd>
                </div>
              )}
              {sobrantes.length > 0 && (
                <div className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-slate-600">
                    ▲ Sobrantes · {sobrantes.length}{" "}
                    {sobrantes.length === 1 ? "producto" : "productos"}
                  </dt>
                  <dd className="font-bold tabular-nums text-[#4d7c0f]">
                    +{formatCLP(valorSobrantes)}
                  </dd>
                </div>
              )}
              <div className="flex items-center justify-between gap-4 px-3 py-2">
                <dt className="font-bold text-navy-950">Efecto neto en el inventario</dt>
                <dd
                  className={`text-base font-black tabular-nums ${
                    impacto < 0 ? "text-fenix-600" : impacto > 0 ? "text-[#4d7c0f]" : "text-slate-500"
                  }`}
                >
                  {formatCLP(impacto)}
                </dd>
              </div>
            </dl>

            {cuadraron.length > 0 && (
              <p className="text-slate-500">
                Los {cuadraron.length} que cuadraron no generan movimiento: su stock ya está
                correcto.
              </p>
            )}

            {sinMotivo.length > 0 && (
              <div className="rounded-xl bg-[#f59e0b]/10 px-3 py-2 text-[#b45309]">
                <p>
                  {sinMotivo.length}{" "}
                  {sinMotivo.length === 1
                    ? "diferencia importante no tiene"
                    : "diferencias importantes no tienen"}{" "}
                  motivo. Sin motivo, el mes que viene nadie va a saber qué pasó.
                </p>
                {/* Cuáles, no solo cuántas: "3 sin motivo" obliga a cerrar y buscarlas */}
                <ul className="mt-1.5 space-y-0.5 text-xs">
                  {sinMotivo.slice(0, 4).map((l) => (
                    <li key={l.id}>
                      · {l.nombre} ({formatCLP(l.valorDiferencia)})
                    </li>
                  ))}
                  {sinMotivo.length > 4 && <li>· y {sinMotivo.length - 4} más</li>}
                </ul>
              </div>
            )}

            {/* Lo que el encargado necesita saber antes de confirmar, no después */}
            <p className="rounded-xl bg-cloud/60 px-3 py-2 text-xs text-slate-500">
              Esto <b className="text-navy-950">no se puede deshacer</b> desde la toma: queda un
              movimiento de ajuste por producto, con tu nombre y la fecha. Para revertirlo habría
              que registrar movimientos de ajuste a mano.
              <br />
              Las ventas ocurridas después del conteo ya están descontadas: no aparecen como
              faltante.
            </p>
          </div>

          <form action={action} className="mt-4 flex gap-2">
            <input type="hidden" name="tomaId" value={toma.id} />
            <button
              type="button"
              onClick={() => setConfirmar(false)}
              className="h-11 flex-1 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600"
            >
              No, volver a revisar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Creando ajustes…" : `Sí, ajustar ${conDif.length}`}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}

function Fila({ linea, editable }: { linea: LineaDetalle; editable: boolean }) {
  const dif = linea.diferencia;
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-2">
        <span className="font-semibold text-navy-950">{linea.nombre}</span>
        <span className="block text-xs text-slate-400">
          {linea.marca} · {linea.sku}
          {linea.ubicacion && ` · ${linea.ubicacion}`}
          {/* El alcance no incluía este producto: apareció durante el conteo, y un faltante
              acá significa algo distinto que uno en el pasillo que se pidió contar. */}
          {origenLineaLabel[linea.origen] && (
            <span className="ml-1 rounded-full bg-electric-50 px-1.5 py-0.5 text-[10px] font-bold text-electric-600">
              {origenLineaLabel[linea.origen]}
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-2 text-right tabular-nums text-slate-600">
        {linea.stockActual}
        {/* Al abrir la toma el sistema tenía otro número: mostrarlo evita la sensación
            de que el conteo "no cuadra" cuando lo que pasó fueron ventas normales. */}
        {linea.esperado !== linea.stockActual && (
          <span className="block text-[11px] text-slate-400">
            {linea.esperado} al abrir
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {linea.contado === null ? (
          <span className="text-slate-400">{linea.saltada ? "saltado" : "—"}</span>
        ) : (
          <>
            <span
              className={
                dif === 0 ? "text-[#4d7c0f]" : dif! < 0 ? "text-fenix-600" : "text-[#b45309]"
              }
            >
              {linea.contado}
            </span>
            {/* Sin esta explicación el encargado ve un número que no cuadra con lo reportado */}
            {linea.movPosteriores !== 0 && (
              <span className="block text-[11px] text-slate-400">
                {linea.movPosteriores > 0 ? "+" : ""}
                {linea.movPosteriores} desde las {fmtHora(linea.contadoEn!)}
              </span>
            )}
            {/* Quién contó y por qué vía: ante una diferencia grande es lo primero que se
                pregunta, y una cifra que pasó por una planilla merece otra mirada. */}
            <span className="block text-[11px] text-slate-400">
              {linea.origenConteo === "PLANILLA" ? "📄 planilla" : "📱 móvil"}
              {linea.contadoPor && ` · ${linea.contadoPor}`}
            </span>
          </>
        )}
      </td>
      <td className="px-4 py-2 text-right tabular-nums">
        {dif === null || dif === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          <span className={`font-bold ${dif < 0 ? "text-fenix-600" : "text-[#4d7c0f]"}`}>
            {dif > 0 ? "+" : "−"}
            {formatCLP(Math.abs(linea.valorDiferencia))}
          </span>
        )}
      </td>
      <td className="px-4 py-2">
        {dif === null || dif === 0 ? (
          <span className="text-xs text-slate-400">—</span>
        ) : editable ? (
          <form action={guardarMotivo}>
            <input type="hidden" name="lineaId" value={linea.id} />
            <select
              name="motivo"
              defaultValue={linea.motivo ?? ""}
              onChange={(e) => e.currentTarget.form?.requestSubmit()}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-navy-950 outline-none focus:border-electric-500"
            >
              <option value="">— Elegir —</option>
              {MOTIVOS.map((m) => (
                <option key={m.valor} value={m.valor}>
                  {m.label}
                </option>
              ))}
            </select>
          </form>
        ) : (
          <span className="text-xs text-slate-500">
            {linea.motivo ? motivoLabel[linea.motivo] : "—"}
          </span>
        )}
      </td>
    </tr>
  );
}

function Kpi({
  label,
  valor,
  tono,
  detalle,
}: {
  label: string;
  valor: string;
  tono: "ok" | "atencion" | "malo" | "neutro";
  /** Línea secundaria, para desglosar un número que de otro modo esconde su composición */
  detalle?: string;
}) {
  const color =
    tono === "ok"
      ? "text-[#4d7c0f]"
      : tono === "atencion"
        ? "text-[#b45309]"
        : tono === "malo"
          ? "text-fenix-600"
          : "text-navy-950";
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-black tabular-nums ${color}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs tabular-nums text-slate-400">{detalle}</p>}
    </div>
  );
}
