import { redirect } from "next/navigation";

/** Usuarios se movió a Configuración. Alguien puede tener la ruta vieja en favoritos. */
export default function UsuariosRedirect() {
  redirect("/dashboard/configuracion/usuarios");
}
