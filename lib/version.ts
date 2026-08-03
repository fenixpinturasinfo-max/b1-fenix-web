/**
 * Versión del sistema, inyectada en build desde package.json (ver next.config.ts).
 *
 * El fallback existe para los contextos que no pasan por el build de Next —scripts de
 * seed, tsx suelto, tests— donde la variable no está definida. Mostrar "dev" es más
 * honesto que mostrar una versión inventada.
 */
export const APP_VERSION = process.env.APP_VERSION ?? "dev";

/** Con la v adelante, como se lee en un pie de página o al reportar un problema. */
export const APP_VERSION_LABEL = `v${APP_VERSION}`;
