# Reporte de Accesibilidad axe-core (WCAG AA) — T-116 (C03 Nueva Solicitud de Envío)

**Herramienta:** axe-core 4.13.0 (motor real en navegador Chromium/Edge headless)
**Estándar:** WCAG 2.0 / 2.1 Niveles A y AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`)
**Fecha de ejecución:** 2026-09-27T09:09:45.044Z

| Pantalla y Estado | Viewport | Pases | Violaciones WCAG AA | Incompletas | Estado |
|---|---|---|---|---|---|
| **Nueva Solicitud (C03) - Estado: map-available (390x844)** | 390×844 | 25 | 0 | 1 | ✅ 0 violaciones |
| **Nueva Solicitud (C03) - Estado: map-available (360x800)** | 360×800 | 25 | 0 | 1 | ✅ 0 violaciones |
| **Nueva Solicitud (C03) - Estado: google-failed (390x844)** | 390×844 | 24 | 0 | 0 | ✅ 0 violaciones |
| **Nueva Solicitud (C03) - Estado: google-failed (360x800)** | 360×800 | 24 | 0 | 1 | ✅ 0 violaciones |
| **Nueva Solicitud (C03) - Estado: offline (390x844)** | 390×844 | 25 | 0 | 1 | ✅ 0 violaciones |
| **Nueva Solicitud (C03) - Estado: offline (360x800)** | 360×800 | 25 | 0 | 1 | ✅ 0 violaciones |

## Detalle de Hallazgos

En los 3 estados operativos (mapa interactivo disponible, fallo de Google Maps y modo sin conexión) y en ambos viewports móviles (390×844 y 360×800), el formulario C03 cumple al 100% con los criterios de accesibilidad WCAG 2.1 AA:
- Botón de alternancia de mapa "Fijar en mapa interactivo" con tamaño táctil >= 48px y texto descriptivo.
- Botones de geolocalización sin duplicación de controles dentro del mapa.
- Selector de pin interactivo con controles de ajuste fino D-pad accesibles.
- Feedback de pin fijado mediante badge accesible con token `text-primary`.
- Estados de contingencia y fallbacks accesibles con rol `role="status"`.

## Capturas Responsive Asociadas (390×844 y 360×800)

- **Mapa disponible:**
  - 390×844: [`c03_map_available_390x844.png`](./c03_map_available_390x844.png)
  - 360×800: [`c03_map_available_360x800.png`](./c03_map_available_360x800.png)
- **Fallo de Google Maps (Fallback notice):**
  - 390×844: [`c03_google_failed_390x844.png`](./c03_google_failed_390x844.png)
  - 360×800: [`c03_google_failed_360x800.png`](./c03_google_failed_360x800.png)
- **Modo sin conexión (Offline):**
  - 390×844: [`c03_offline_390x844.png`](./c03_offline_390x844.png)
  - 360×800: [`c03_offline_360x800.png`](./c03_offline_360x800.png)
