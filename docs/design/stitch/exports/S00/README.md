# Criterios de Implementación Técnica: S00 (Sistema de Diseño y Assets)

Este documento fija la **especificación oficial y vinculante** dictaminada por El Consejo para el sistema de diseño, los tokens semánticos y los activos de marca de cadeApp.

---

## 1. Mapeo Canónico de Tokens a shadcn/ui (`src/ui/tokens.css`)

Stitch generó automáticamente clases de Material Design 3 (`primary-container`, `surface-dim`, `inverse-surface`). **Se prohíbe terminantemente trasladar esa nomenclatura al código.**

Todo el sistema visual se implementa mapeando los tokens canónicos a las variables CSS que consumen shadcn/ui y Tailwind:

```css
/* src/ui/tokens.css o globals.css */
@layer base {
  :root {
    /* 1. Canvas y Superficies */
    --background: 30 33% 99%;          /* #FDFCFB (Canvas cálido neutral) */
    --foreground: 226 42% 12%;         /* #12182C (Ink Navy institucional) */
    
    --card: 0 0% 100%;                 /* #FFFFFF (Tarjetas y contenedores) */
    --card-foreground: 226 42% 12%;    /* #12182C */

    --popover: 0 0% 100%;              /* #FFFFFF */
    --popover-foreground: 226 42% 12%; /* #12182C */

    /* 2. Botón Primario y Acentos */
    --primary: 181 91% 39%;            /* #09BABD (Teal Brand oficial) */
    --primary-foreground: 226 42% 12%; /* #12182C (Ink Navy) -> CONTRASTE 6.93:1 WCAG AAA */

    /* 3. Botón Secundario y TopBar */
    --secondary: 226 42% 12%;          /* #12182C (Ink Navy) */
    --secondary-foreground: 0 0% 100%; /* #FFFFFF */

    /* 4. Textos Atenuados y Metadatos */
    --muted: 210 40% 96%;              /* #F1F5F9 */
    --muted-foreground: 219 13% 41%;   /* #5B6475 (Muted text con ratio 5.8:1) */

    /* 5. Énfasis y Links sobre fondo claro */
    --accent: 182 84% 27%;             /* #0B7A7D (Deep Teal con ratio 4.66:1) */
    --accent-foreground: 0 0% 100%;    /* #FFFFFF */

    /* 6. Estados de Feedback */
    --destructive: 0 66% 47%;          /* #C62828 (Rojo peligro) */
    --destructive-foreground: 0 0% 100%;

    /* 7. Bordes, Inputs y Enfoque */
    --border: 218 16% 91%;             /* #E4E7EC (Borde nítido de 1px) */
    --input: 218 16% 91%;              /* #E4E7EC */
    --ring: 181 91% 39%;               /* #09BABD (Anillo de foco) */

    /* 8. Radios de Curvatura */
    --radius: 10px;                    /* Base para Botones e Inputs: 10px */
  }
}
```

> [!IMPORTANT]
> **REGLA DE ORO DE CONTRASTE:**
> `--primary-foreground` DEBE ser siempre Ink Navy `#12182C`.
> - Ink Navy sobre Teal Brand: **Ratio 6.93:1 (Pasa WCAG AAA)**.
> - Blanco sobre Teal Brand: **Ratio 2.44:1 (REPRUEBA WCAG AA - PROHIBIDO)**.
> - Teal Brand sobre Blanco: **Ratio 2.44:1 (REPRUEBA WCAG AA - PROHIBIDO PARA TEXTO)**.

---

## 2. Tipografía y Jerarquía
- **Display, Títulos y Precios:** `Montserrat 700` (refleja la geometría del logo).
  - Precios: Siempre con espacio, punto de miles y sin decimales (`$ 1.500`, `$ 2.200`).
- **Lectura, Formularios y Botones:** `Inter` (pesos 400, 500 y 600).
- **Cláusula Anti-12px:** **Piso mínimo absoluto de 14px (`text-sm`)** en toda la interfaz móvil operativa. Textos de 11px o 12px quedan prohibidos porque no se leen bajo el sol en la calle.

---

## 3. Diagnóstico de `assets/` y Pipeline de Logos

### 🚨 Alerta de Rendimiento:
Los archivos en `assets/` son archivos fuente maestros de diseño creados con Canva AI:
- Contienen metadatos C2PA (`<c2pa:manifest>`) y un PNG embebido en Base64 adentro del XML.
- Pesan entre **226 KB y 1.29 MB cada SVG**, y hasta **3.5 MB cada PNG**.
- **PROHIBIDO IMPORTARLOS DIRECTAMENTE EN EL CLIENTE JS DE NEXT.JS.** Provocaría que el bundle de la app salte a más de 1 MB, violando el límite de 180 KB.

### 🗺️ Matriz de Asignación Canónica:

| Archivo Fuente | Composición | Fondo | Uso Oficial en cadeApp | Destino en `public/` |
|---|---|---|---|---|
| [`assets/2.svg`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/assets/2.svg) | Horizontal (Isotipo + Texto blanco) | **Oscuro (#12182C)** | **TopBar Institucional Móvil:** Encabezado en Comercio y Repartidor. Contraste 16.9:1. | `/brand/logo-horizontal-dark.svg` |
| [`assets/3.svg`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/assets/3.svg) | Horizontal (Isotipo + Texto tinta) | **Claro (#FFFFFF)** | **TopBar Admin Desktop:** Encabezado web en `A01-A06`. | `/brand/logo-horizontal-light.svg` |
| [`assets/4.svg`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/assets/4.svg) / `4.png` | Apilado vertical (Moto arriba, texto abajo) | **Claro (#FDFCFB)** | **Hero & Splash:** Landing (`P01`), Onboarding y Hoja de Marca (`S00`). | `/brand/logo-stacked-light.svg` |
| [`assets/6.svg`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/assets/6.svg) | Apilado vertical (Moto + Texto blanco) | **Oscuro** | Splash Dark y modales de alto contraste. | `/brand/logo-stacked-dark.svg` |
| [`assets/1.svg`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/assets/1.svg) | Monocromo oscuro puro (`#1D212F`) | **Blanco / Papel** | **Impresión Térmica:** Tickets y remitos para impresoras Bluetooth de 58/80 mm en comercios. | `/brand/logo-print-pos.svg` |
| [`assets/7.svg`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/assets/7.svg) | Monocromo blanco puro (100%) | **Oscuro** | Sellos de una sola tinta. | `/brand/logo-monochrome-white.svg` |

### Requisitos PWA (Manifest):
El estándar W3C PWA exige **PNGs rasterizados exactos** (el SVG no los reemplaza en el manifest de Android/iOS):
- `public/icons/icon-192.png` (192×192 px)
- `public/icons/icon-512.png` (512×512 px)
- `public/icons/icon-maskable-512.png` (512×512 px con zona segura)
- `public/icons/apple-touch-icon.png` (180×180 px para Safari en iPhone)

---

## 4. Componente Primitivo: `src/ui/brand-logo.tsx`

```tsx
// src/ui/brand-logo.tsx
import Image from 'next/image';

interface BrandLogoProps {
  variant?: 'topbar-dark' | 'topbar-light' | 'hero' | 'hero-dark';
  className?: string;
  priority?: boolean;
}

const LOGO_PATHS = {
  'topbar-dark':  '/brand/logo-horizontal-dark.svg',  // Derivado limpio de assets/2.svg
  'topbar-light': '/brand/logo-horizontal-light.svg', // Derivado limpio de assets/3.svg
  'hero':         '/brand/logo-stacked-light.svg',     // Derivado limpio de assets/4.svg
  'hero-dark':    '/brand/logo-stacked-dark.svg',      // Derivado limpio de assets/6.svg
};

export function BrandLogo({ variant = 'topbar-dark', className = 'h-8 w-auto', priority = false }: BrandLogoProps) {
  return (
    <Image
      src={LOGO_PATHS[variant]}
      alt="cadeApp"
      width={variant.startsWith('topbar') ? 128 : 160}
      height={36}
      priority={priority}
      className={className}
    />
  );
}
```
