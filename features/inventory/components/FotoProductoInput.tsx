"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { subirFotoDrive } from "../fotos";
import { urlImagenProducto } from "@/lib/imagen-producto";

/** Lado máximo de la foto que se sube. Las tarjetas del catálogo piden 400 px; 800 deja margen para retina. */
const LADO_MAX = 800;
const CALIDAD_JPEG = 0.82;

const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-navy-950 outline-none transition focus:border-electric-500";

/**
 * Reduce la imagen en el navegador antes de enviarla: una foto de celular de 4 MB queda
 * en 100–300 KB. Así la Server Action nunca recibe originales pesados y Drive guarda
 * solo lo que el catálogo necesita. PNG se conserva como PNG (puede tener transparencia).
 */
async function reducirImagen(archivo: File): Promise<File> {
  // `from-image` respeta la orientación EXIF: las fotos de celular en vertical no salen giradas.
  const bitmap = await createImageBitmap(archivo, { imageOrientation: "from-image" });
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const esPng = archivo.type === "image/png";
  const tipo = esPng ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, tipo, esPng ? undefined : CALIDAD_JPEG),
  );
  if (!blob) throw new Error("canvas");
  const nombre = archivo.name.replace(/\.[^.]+$/, "") + (esPng ? ".png" : ".jpg");
  return new File([blob], nombre, { type: tipo });
}

interface Props {
  /** `name` del input de texto que guarda el link (lo lee la Server Action del formulario). */
  name?: string;
  defaultValue?: string | null;
  /** Si el servidor no tiene credenciales de Drive, se muestra solo el campo de texto. */
  subidaDisponible: boolean;
}

export function FotoProductoInput({ name = "imagen", defaultValue, subidaDisponible }: Props) {
  const [valor, setValor] = useState(defaultValue ?? "");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRota, setPreviewRota] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = urlImagenProducto(valor);

  const onArchivo = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      let reducido: File;
      try {
        reducido = await reducirImagen(archivo);
      } catch {
        setError("No se pudo leer la imagen. Usa una foto JPG o PNG (HEIC de iPhone no sirve).");
        return;
      }
      // Nombre sugerido para Drive: el SKU del mismo formulario, o el nombre del producto.
      const form = e.target.closest("form");
      const sku = (form?.elements.namedItem("sku") as HTMLInputElement | null)?.value?.trim();
      const nombreProd = (form?.elements.namedItem("nombre") as HTMLInputElement | null)?.value?.trim();

      const fd = new FormData();
      fd.append("archivo", reducido);
      fd.append("nombre", sku || nombreProd || "");
      const res = await subirFotoDrive(fd);
      if (res.error || !res.url) {
        setError(res.error ?? "No se pudo subir la foto.");
        return;
      }
      setValor(res.url);
      setPreviewRota(false);
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex gap-3">
      <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-cloud text-[11px] text-slate-400">
        {preview && !previewRota ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={preview}
            src={preview}
            alt=""
            className="h-full w-full object-contain"
            referrerPolicy="no-referrer"
            onError={() => setPreviewRota(true)}
          />
        ) : preview ? (
          <span className="px-2 text-center">Drive aún procesa la miniatura</span>
        ) : (
          <span>Sin foto</span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          name={name}
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            setPreviewRota(false);
          }}
          placeholder="https://drive.google.com/file/d/… o /productos/laca-hs.jpg"
          className={input}
        />
        {subidaDisponible && (
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onArchivo}
              disabled={subiendo}
              className="hidden"
              id={`foto-${name}`}
            />
            <label
              htmlFor={`foto-${name}`}
              className={`inline-flex h-9 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-navy-950 transition hover:border-electric-500 ${
                subiendo ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {subiendo ? "Subiendo a Drive…" : valor ? "Reemplazar foto" : "Subir foto"}
            </label>
            <span className="text-xs text-slate-500">Se reduce a 800 px y queda en la carpeta Inventario de Drive.</span>
          </div>
        )}
        {error && <p className="text-sm text-fenix-600">{error}</p>}
        <AyudaFotos subidaDisponible={subidaDisponible} />
      </div>
    </div>
  );
}

/**
 * Ayuda contextual, plegada por defecto: quien ya sabe no la ve; quien carga por primera
 * vez tiene la respuesta al lado del campo, sin ir a buscar un manual.
 */
function AyudaFotos({ subidaDisponible }: { subidaDisponible: boolean }) {
  return (
    <details className="group text-xs text-slate-600">
      <summary className="cursor-pointer select-none font-semibold text-electric-600 hover:underline">
        ¿Cómo cargar la foto?
      </summary>
      <div className="mt-2 space-y-2 rounded-xl border border-slate-200 bg-cloud/60 p-3 leading-relaxed">
        {subidaDisponible ? (
          <p>
            <strong className="text-navy-950">Lo más simple:</strong> pulsa <em>Subir foto</em> y elige una imagen
            JPG o PNG de tu computador o celular. El sistema la reduce (máx. 800 px, ~100 KB) y la deja en la
            carpeta <em>Inventario</em> del Drive de Fénix con el nombre del SKU. El link se completa solo; después
            guarda la ficha.
          </p>
        ) : (
          <p>
            <strong className="text-navy-950">Subir desde aquí</strong> no está activo en este servidor: pega el link
            de Drive como se explica abajo.
          </p>
        )}
        <p>
          <strong className="text-navy-950">Si la foto ya está en Drive:</strong> en la carpeta <em>Inventario</em>,
          clic derecho sobre la foto → <em>Compartir</em> → <em>Copiar enlace</em>, y pégalo en el campo. Sirve
          cualquier formato de link de Drive; el sistema lo convierte a una miniatura liviana para el catálogo.
        </p>
        <p>
          <strong className="text-navy-950">Si la foto no se ve en la web:</strong> casi siempre es porque el archivo
          o la carpeta no está compartido como <em>Cualquier persona con el enlace</em>. Corrígelo en Drive y recarga
          la página; no hace falta volver a pegar el link.
        </p>
        <p className="text-slate-500">
          Consejo: una foto cuadrada, con fondo claro y el envase centrado, se ve mejor en las tarjetas del catálogo.
          HEIC de iPhone no sirve: expórtala como JPG antes.
        </p>
      </div>
    </details>
  );
}
