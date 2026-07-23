import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
