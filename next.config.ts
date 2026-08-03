import { readFileSync } from "node:fs";
import type { NextConfig } from "next";

/**
 * Versión del sistema, leída de package.json al construir.
 *
 * Se expone como variable de entorno en vez de importar package.json desde el código: un
 * `import pkg from "@/package.json"` mete el archivo completo —con la lista de dependencias
 * y sus versiones— en el bundle que lo use, y si algún día eso pasa por un componente
 * cliente termina publicado en el navegador. Acá viaja solo el string de la versión.
 */
const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string };

const nextConfig: NextConfig = {
  env: { APP_VERSION: version },
  // El indicador de Next Dev Tools solo aparece en desarrollo, pero estorba al revisar
  // la landing y al tomar capturas. Los errores de compilación se siguen mostrando igual.
  devIndicators: false,
  images: {
    localPatterns: [
      // Imágenes locales sin query string
      { pathname: "/**", search: "" },
      // Cache-bust del logo
      { pathname: "/logo-fenix.png", search: "?v=2" },
    ],
  },
};

export default nextConfig;
