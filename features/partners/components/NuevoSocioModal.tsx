"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { SocioForm } from "./SocioForm";

/** Botón "＋ Nuevo proveedor/cliente" que abre el formulario en modal (mismo patrón que Nuevo producto) */
export function NuevoSocioModal({ tipo }: { tipo: string }) {
  const [abierto, setAbierto] = useState(false);
  const [sucio, setSucio] = useState(false);

  const etiqueta = tipo === "CLIENTE" ? "cliente" : "proveedor";

  const cerrar = useCallback(() => {
    if (sucio && !window.confirm("Hay datos sin guardar. ¿Cerrar de todas formas?")) return;
    setAbierto(false);
    setSucio(false);
  }, [sucio]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="bg-flame h-10 rounded-xl px-4 text-sm font-bold leading-10 text-white transition hover:opacity-90"
      >
        ＋ Nuevo {etiqueta}
      </button>

      {abierto && (
        <Modal
          titulo={`＋ Nuevo ${etiqueta}`}
          descripcion={
            tipo === "CLIENTE"
              ? "Queda disponible de inmediato para pedidos y ventas."
              : "Queda disponible de inmediato para solicitudes, cotizaciones y órdenes de compra."
          }
          ancho="max-w-4xl"
          onClose={cerrar}
        >
          <SocioForm
            tipoDefault={tipo}
            onChange={() => setSucio(true)}
            onDone={() => setSucio(false)}
            onCancel={cerrar}
          />
        </Modal>
      )}
    </>
  );
}
