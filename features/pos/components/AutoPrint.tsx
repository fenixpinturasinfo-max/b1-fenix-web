"use client";

import { useEffect } from "react";

/** Lanza el diálogo de impresión al cargar la página (?print=1). */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);
  return null;
}
