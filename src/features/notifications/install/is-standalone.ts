/**
 * T-338: Detecta si la aplicación se ejecuta en modo instalado (PWA standalone).
 * Aplica lógica compatible con Android/Desktop (display-mode: standalone) e iOS (navigator.standalone).
 * En SSR o entornos sin ventana devuelve false de forma segura.
 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const isIosStandalone =
    'standalone' in navigator &&
    (navigator as unknown as { standalone: boolean }).standalone === true;

  const isMediaStandalone =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(display-mode: standalone)').matches;

  return Boolean(isIosStandalone || isMediaStandalone);
}
