export function isIosSafariNonStandalone(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isStandalone =
    ('standalone' in navigator && (navigator as unknown as { standalone: boolean }).standalone === true) ||
    (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches);

  return isIos && !isStandalone;
}
