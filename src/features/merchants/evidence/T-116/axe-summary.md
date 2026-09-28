# Reporte de Accesibilidad axe-core (WCAG AA) — T-116 (C01 Alta de Comercio)

> [!WARNING]
> **EVIDENCIA PRELIMINAR — NO VÁLIDA PARA CERRAR H07.** La evidencia final se reemplazará en T-300 / staging sobre las rutas reales.

**Herramienta:** axe-core 4.13.0 (motor real en navegador Chromium/Edge headless)
**Estándar:** WCAG 2.0 / 2.1 Niveles A y AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`)
**Fecha de ejecución:** 2026-09-27T09:09:45.043Z

| Pantalla y Estado | Viewport | Pases | Violaciones WCAG AA | Incompletas | Estado |
|---|---|---|---|---|---|
| **Alta de Comercio (C01) - Estado: map-available (390x844)** | 390×844 | 26 | 0 | 1 | ✅ 0 violaciones |
| **Alta de Comercio (C01) - Estado: map-available (360x800)** | 360×800 | 26 | 0 | 1 | ✅ 0 violaciones |
| **Alta de Comercio (C01) - Estado: google-failed (390x844)** | 390×844 | 24 | 0 | 0 | ✅ 0 violaciones |
| **Alta de Comercio (C01) - Estado: google-failed (360x800)** | 360×800 | 24 | 0 | 0 | ✅ 0 violaciones |
| **Alta de Comercio (C01) - Estado: offline (390x844)** | 390×844 | 26 | 0 | 1 | ✅ 0 violaciones |
| **Alta de Comercio (C01) - Estado: offline (360x800)** | 360×800 | 26 | 0 | 1 | ✅ 0 violaciones |

## Detalle de Hallazgos

En los 3 estados operativos (mapa disponible, fallo de Google Maps y modo sin conexión) y en ambos viewports móviles (390×844 y 360×800), este harness registró 0 violaciones automáticas, pero contiene resultados incompletos y no acredita cumplimiento WCAG AA final:
- Jerarquía de encabezados e inputs accesibles con labels asociados.
- Botón "Usar mi ubicación actual" con tamaño táctil >= 48px y contraste AA.
- Controles de ajuste fino (D-pad) con atributos `aria-label` descriptivos.
- Mensajes de contingencia y fallbacks accesibles con rol semántico `role="status"`.
- Ausencia de violaciones de contraste ni scroll horizontal.

## Capturas Responsive Asociadas (390×844 y 360×800)

- **Mapa disponible:**
  - 390×844: [`c01_map_available_390x844.png`](./c01_map_available_390x844.png)
  - 360×800: [`c01_map_available_360x800.png`](./c01_map_available_360x800.png)
- **Fallo de Google Maps (Fallback notice):**
  - 390×844: [`c01_google_failed_390x844.png`](./c01_google_failed_390x844.png)
  - 360×800: [`c01_google_failed_360x800.png`](./c01_google_failed_360x800.png)
- **Modo sin conexión (Offline):**
  - 390×844: [`c01_offline_390x844.png`](./c01_offline_390x844.png)
  - 360×800: [`c01_offline_360x800.png`](./c01_offline_360x800.png)
