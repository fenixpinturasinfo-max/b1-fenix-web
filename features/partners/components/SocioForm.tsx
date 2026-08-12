"use client";

import { useActionState, useRef, useState } from "react";
import { guardarSocio, type ActionState } from "../actions";

export interface SocioData {
  id: string;
  tipo: string;
  rut: string;
  razonSocial: string;
  nombreFantasia: string | null;
  giro: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  comuna: string | null;
  condicionPago: string | null;
  /** Descuento pactado (%). Solo tiene sentido en clientes; en proveedores queda 0. */
  descuentoPorcentaje: number;
  /** Puede llevarse mercadería a cuenta y pagar al consolidar (solo clientes). */
  cuentaAbierta: boolean;
}

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

export function SocioForm({
  socio,
  onChange,
  onDone,
  onCancel,
  tipoDefault,
}: {
  socio?: SocioData;
  /** Se dispara ante cualquier edición (para el aviso de "datos sin guardar") */
  onChange?: () => void;
  /** Se dispara tras guardar con éxito */
  onDone?: () => void;
  /** Si se entrega, muestra un botón "Cerrar" junto al de guardar */
  onCancel?: () => void;
  tipoDefault?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  // Al crear, limpia el formulario para encadenar altas; al editar, el padre cierra el modal
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const res = await guardarSocio(prev, fd);
    if (res.ok) {
      if (!socio) formRef.current?.reset();
      onDone?.();
    }
    return res;
  }, {});
  const uid = socio?.id ?? "new";
  // Controlado solo para saber si mostrar el campo de descuento: el % de un proveedor
  // no significa nada y verlo ahí invitaría a llenarlo.
  const [tipo, setTipo] = useState(socio?.tipo ?? tipoDefault ?? "PROVEEDOR");

  return (
    <form
      ref={formRef}
      action={action}
      onChange={onChange}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {socio && <input type="hidden" name="id" value={socio.id} />}
      <div>
        <label htmlFor={`s-tipo-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Tipo *</label>
        <select
          id={`s-tipo-${uid}`}
          name="tipo"
          required
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={input}
        >
          <option value="PROVEEDOR">Proveedor</option>
          <option value="CLIENTE">Cliente</option>
        </select>
      </div>
      <div>
        <label htmlFor={`s-rut-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">RUT *</label>
        <input id={`s-rut-${uid}`} name="rut" required defaultValue={socio?.rut} placeholder="76123456-7" className={input} />
      </div>
      <div>
        <label htmlFor={`s-razon-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Razón social *</label>
        <input id={`s-razon-${uid}`} name="razonSocial" required defaultValue={socio?.razonSocial} placeholder="Distribuidora XYZ SpA" className={input} />
      </div>
      <div>
        <label htmlFor={`s-fant-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Nombre fantasía</label>
        <input id={`s-fant-${uid}`} name="nombreFantasia" defaultValue={socio?.nombreFantasia ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor={`s-giro-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Giro</label>
        <input id={`s-giro-${uid}`} name="giro" defaultValue={socio?.giro ?? ""} placeholder="Venta de pinturas" className={input} />
      </div>
      <div>
        <label htmlFor={`s-email-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Correo</label>
        <input id={`s-email-${uid}`} name="email" type="email" defaultValue={socio?.email ?? ""} placeholder="ventas@proveedor.cl" className={input} />
      </div>
      <div>
        <label htmlFor={`s-fono-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Teléfono</label>
        <input id={`s-fono-${uid}`} name="telefono" defaultValue={socio?.telefono ?? ""} placeholder="+56 9 …" className={input} />
      </div>
      <div>
        <label htmlFor={`s-dir-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Dirección</label>
        <input id={`s-dir-${uid}`} name="direccion" defaultValue={socio?.direccion ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor={`s-com-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Comuna</label>
        <input id={`s-com-${uid}`} name="comuna" defaultValue={socio?.comuna ?? ""} className={input} />
      </div>
      <div>
        <label htmlFor={`s-pago-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">Condición de pago</label>
        <select id={`s-pago-${uid}`} name="condicionPago" defaultValue={socio?.condicionPago ?? ""} className={input}>
          <option value="">— Sin definir —</option>
          <option value="CONTADO">Contado</option>
          <option value="30D">30 días</option>
          <option value="60D">60 días</option>
          <option value="90D">90 días</option>
        </select>
      </div>
      {tipo === "CLIENTE" && (
        <div>
          <label htmlFor={`s-dcto-${uid}`} className="mb-1 block text-sm font-semibold text-slate-700">
            Descuento cliente (%)
          </label>
          <input
            id={`s-dcto-${uid}`}
            name="descuentoPorcentaje"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            defaultValue={socio?.descuentoPorcentaje || ""}
            placeholder="0"
            className={input}
          />
          <p className="mt-1 text-xs text-slate-400">
            Se aplica solo al ingresar su RUT en el POS o al elegirlo en una factura.
          </p>
        </div>
      )}
      {tipo === "CLIENTE" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-300 p-3 transition hover:border-electric-500 sm:col-span-2 lg:col-span-1">
          <input
            type="checkbox"
            name="cuentaAbierta"
            defaultChecked={socio?.cuentaAbierta ?? false}
            className="mt-0.5 h-4 w-4 accent-[#0e4c92]"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold text-navy-950">Cuenta abierta</span>
            <span className="block text-xs text-slate-500">
              Puede retirar mercadería a cuenta y pagar al cierre (semana, quincena o mes).
              Es crédito: actívalo a propósito.
            </span>
          </span>
        </label>
      )}
      <div className="flex items-end gap-2">
        <button
          type="submit"
          disabled={pending}
          className="bg-flame h-11 flex-1 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Guardando…" : socio ? "Guardar cambios" : "Crear socio"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
          >
            Cerrar
          </button>
        )}
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-fenix-600 sm:col-span-2 lg:col-span-3">{state.error}</p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-semibold text-[#4d7c0f] sm:col-span-2 lg:col-span-3">✅ {state.ok}</p>
      )}
    </form>
  );
}
