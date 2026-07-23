import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pinturas Fenix | Pinturas, Insumos y Accesorios Automotrices",
  description:
    "Especialistas en pintura automotriz en San Bernardo y Buin. Lacas, primers, pulido y detailing de Sikkens, Sherwin-Williams, 3M, Menzerna y más. Arma tu pedido y retíralo en tienda.",
  keywords: [
    "pintura automotriz",
    "lacas",
    "primers",
    "detailing",
    "San Bernardo",
    "Buin",
    "Sikkens",
  ],
  icons: {
    icon: "/logo-fenix.png?v=2",
    apple: "/logo-fenix.png?v=2",
  },
  openGraph: {
    title: "Pinturas Fenix | Especialistas en pintura automotriz",
    description:
      "Pinturas, insumos y accesorios automotrices. San Bernardo y Buin.",
    locale: "es_CL",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
