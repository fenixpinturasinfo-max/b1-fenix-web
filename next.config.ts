import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
