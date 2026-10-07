/**
 * T-338: Detecta si la aplicación se ejecuta en modo instalado (PWA standalone).
 * Retorna false por defecto durante la fase RED inicial.
 */
export function isStandalone(): boolean {
  return false;
}
