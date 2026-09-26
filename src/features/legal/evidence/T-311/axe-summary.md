# Reporte de Accesibilidad axe-core (WCAG AA) — T-311

**Herramienta:** axe-core 4.13.0 (motor real en navegador Chromium/Edge headless)
**Estándar:** WCAG 2.0 / 2.1 Niveles A y AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`)
**Fecha de ejecución:** 2026-09-26T02:02:38.774Z

| Pantalla | URL | Pases | Violaciones WCAG AA | Incompletas | Estado |
|---|---|---|---|---|---|
| **Hub Legal (/legal)** | `http://localhost:3000/legal` | 20 | 0 | 0 | ✅ 0 violaciones |
| **Términos y Condiciones (/legal/terms)** | `http://localhost:3000/legal/terms` | 22 | 0 | 0 | ✅ 0 violaciones |
| **Política de Privacidad (/legal/privacy)** | `http://localhost:3000/legal/privacy` | 22 | 0 | 0 | ✅ 0 violaciones |
| **Condiciones Repartidores (/legal/courier)** | `http://localhost:3000/legal/courier` | 22 | 0 | 0 | ✅ 0 violaciones |
| **Términos Piloto (/legal/pilot)** | `http://localhost:3000/legal/pilot` | 22 | 0 | 0 | ✅ 0 violaciones |
| **Inicio de Sesión (/login)** | `http://localhost:3000/login` | 26 | 0 | 0 | ✅ 0 violaciones |
| **Registro con Enlaces Legales (/register)** | `http://localhost:3000/register` | 26 | 0 | 0 | ✅ 0 violaciones |
| **Onboarding Comercio (/merchant/onboarding)** | `http://localhost:3000/merchant/onboarding` | 21 | 0 | 0 | ✅ 0 violaciones |
| **Onboarding Repartidor (/onboarding/vehicle)** | `http://localhost:3000/onboarding/vehicle` | 25 | 1 | 0 | ⚠️ 1 violaciones |

## Detalle de Hallazgos por Pantalla

### Hub Legal (/legal)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 20

### Términos y Condiciones (/legal/terms)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 22

### Política de Privacidad (/legal/privacy)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 22

### Condiciones Repartidores (/legal/courier)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 22

### Términos Piloto (/legal/pilot)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 22

### Inicio de Sesión (/login)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 26

### Registro con Enlaces Legales (/register)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 26

### Onboarding Comercio (/merchant/onboarding)

- **Violaciones:** 0 (cumple 100% WCAG 2.0/2.1 AA)
- **Reglas satisfechas (passes):** 21

### Onboarding Repartidor (/onboarding/vehicle)

- **Violaciones encontradas (1):**
  - **[SERIOUS] color-contrast**: Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds ([Documentación](https://dequeuniversity.com/rules/axe/4.13/color-contrast?application=axeAPI))
    - Nodo: `.gap-1.flex-1.flex-col:nth-child(1) > .gap-0\.5.text-primary.font-semibold`
    - HTML: `<span class="flex items-center gap-0.5 text-sm font-semibold text-primary">`
    - Causa: Fix any of the following:
  Element has insufficient color contrast of 2.39 (foreground color: #09babd, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1
    - Nodo: `.gap-1.flex-1.flex-col:nth-child(2) > .gap-0\.5.text-primary.font-semibold`
    - HTML: `<span class="flex items-center gap-0.5 text-sm font-semibold text-primary">`
    - Causa: Fix any of the following:
  Element has insufficient color contrast of 2.39 (foreground color: #09babd, background color: #ffffff, font size: 10.5pt (14px), font weight: normal). Expected contrast ratio of 4.5:1

## Capturas Responsive Asociadas (390×844 y 360×800)

Todas las capturas se encuentran almacenadas y versionadas en `src/features/legal/evidence/T-311/`:

- **Hub Legal (/legal):**
  - 390×844: [`legal_hub_390x844.png`](./legal_hub_390x844.png)
  - 360×800: [`legal_hub_360x800.png`](./legal_hub_360x800.png)
- **Términos y Condiciones (/legal/terms):**
  - 390×844: [`legal_terms_390x844.png`](./legal_terms_390x844.png)
  - 360×800: [`legal_terms_360x800.png`](./legal_terms_360x800.png)
- **Política de Privacidad (/legal/privacy):**
  - 390×844: [`legal_privacy_390x844.png`](./legal_privacy_390x844.png)
  - 360×800: [`legal_privacy_360x800.png`](./legal_privacy_360x800.png)
- **Condiciones Repartidores (/legal/courier):**
  - 390×844: [`legal_courier_390x844.png`](./legal_courier_390x844.png)
  - 360×800: [`legal_courier_360x800.png`](./legal_courier_360x800.png)
- **Términos Piloto (/legal/pilot):**
  - 390×844: [`legal_pilot_390x844.png`](./legal_pilot_390x844.png)
  - 360×800: [`legal_pilot_360x800.png`](./legal_pilot_360x800.png)
- **Inicio de Sesión (/login):**
  - 390×844: [`login_390x844.png`](./login_390x844.png)
  - 360×800: [`login_360x800.png`](./login_360x800.png)
- **Registro con Enlaces Legales (/register):**
  - 390×844: [`register_390x844.png`](./register_390x844.png)
  - 360×800: [`register_360x800.png`](./register_360x800.png)
- **Onboarding Comercio (/merchant/onboarding):**
  - 390×844: [`merchant_onboarding_390x844.png`](./merchant_onboarding_390x844.png)
  - 360×800: [`merchant_onboarding_360x800.png`](./merchant_onboarding_360x800.png)
- **Onboarding Repartidor (/onboarding/vehicle):**
  - 390×844: [`courier_onboarding_390x844.png`](./courier_onboarding_390x844.png)
  - 360×800: [`courier_onboarding_360x800.png`](./courier_onboarding_360x800.png)
