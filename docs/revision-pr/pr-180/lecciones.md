# Lecciones aprendidas — PR #180 (T-307)

- `page.context().setOffline(true)` en Chromium dispara los eventos nativos de red del navegador y conmuta `navigator.onLine`, lo que permite probar componentes reactivos como `OfflineBanner` y `OfflineFloatingCard` con fidelidad total.
- Al testear formularios con React hidratado sobre Next.js SSR, esperar a la hidratación completa (`networkidle` / interactuabilidad) antes de interactuar previene sobreescrituras por estado inicial.
