import { redirect } from "next/navigation";

/** Locales se movió a Configuración: es configuración, no inventario. */
export default function LocalesRedirect() {
  redirect("/dashboard/configuracion/locales");
}
