"use client";

import { useCallback, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { UserForm } from "./UserForm";

interface LocalOption {
  id: string;
  nombre: string;
}

/** Botón "＋ Nuevo usuario" que abre el formulario en modal (mismo patrón que Nuevo producto) */
export function NuevoUsuarioModal({ locales }: { locales: LocalOption[] }) {
  const [abierto, setAbierto] = useState(false);
  const [sucio, setSucio] = useState(false);

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
        ＋ Nuevo usuario
      </button>

      {abierto && (
        <Modal
          titulo="＋ Nuevo usuario"
          descripcion="La cuenta queda activa de inmediato con el rol y local que asignes."
          onClose={cerrar}
        >
          <UserForm
            locales={locales}
            onChange={() => setSucio(true)}
            onDone={() => setSucio(false)}
          />
          <button
            type="button"
            onClick={cerrar}
            className="mt-4 h-11 w-full rounded-xl border border-slate-300 px-5 text-sm font-semibold text-slate-600 transition hover:border-electric-500 hover:text-electric-600"
          >
            Cerrar
          </button>
        </Modal>
      )}
    </>
  );
}
