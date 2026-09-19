# Criterios de Implementación Técnica: Pantallas P00 (Público)

Este documento fija la **especificación oficial y vinculante** dictaminada por El Consejo para la implementación de las vistas públicas (`(public)/...`) en Next.js, Tailwind CSS y shadcn/ui. Cualquier agente o colaborador debe ceñirse estrictamente a estas reglas.

---

## 1. Reglas Globales para el Grupo P00
- **Rutas de destino:** `src/app/(public)/...` (`page.tsx`, `login/page.tsx`, `register/page.tsx`, `terms/page.tsx`).
- **Layout:** `src/app/(public)/layout.tsx` con contenedor centrado móvil (`max-w-[390px] mx-auto min-h-screen bg-background`).
- **Componentes shadcn/ui base (`src/ui/`):** `Button`, `Input`, `Card`, `Label`, `Tabs`.
- **TopBar Unificado:** Fondo marino institucional Ink Navy `#12182C`, altura 56px, con logo horizontal blanco `assets/2.svg` (`/brand/logo-horizontal-dark.svg`).
- **Formularios:** Gestionados con `react-hook-form` y validación estricta de schemas Zod (`src/features/auth/schemas.ts`).

---

## 2. Especificación Pantalla por Pantalla

### `P01-inicio.png` / `P01-inicio.html` — Landing de Bienvenida
* **Archivos exportados:** [`P01-inicio.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P01-inicio.png) · [`P01-inicio.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P01-inicio.html)
* **Qué se MANTIENE (Aprobado):**
  * Propuesta de valor: *"Envíos directos entre comercios y repartidores de Aguilares"*.
  * Composición del hero central con el logo apilado sobre fondo cálido neutral `#FDFCFB`.
  * Acciones duales: Botón primario *"Ingresar a mi cuenta"* y secundario outline *"Registrarme"*.
  * Sección educativa: *"¿Quién paga el envío? Lo paga quien recibe al momento de la entrega"*.
  * Sin fotos stock, sin mapas, sin precios ni insignias de app stores.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Logo:** Usar el componente `<BrandLogo variant="hero" />` consumiendo el asset optimizado derivado de `assets/4.svg` (< 5 KB), nunca el archivo bruto de Canva.
  * **Botones:** Reemplazar las clases manuales por `<Button variant="default" className="w-full h-12">` y `<Button variant="outline" className="w-full h-12">`.
  * **Fuentes:** Erradicar Google Material Symbols; usar `lucide-react` para íconos informativos (`Package`, `Bike`, `ShieldCheck`).

---

### `P02-ingresar.png` / `P02-ingresar.html` — Inicio de Sesión
* **Archivos exportados:** [`P02-ingresar.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P02-ingresar.png) · [`P02-ingresar.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P02-ingresar.html)
* **Qué se MANTIENE (Aprobado):**
  * Formulario conciso: Identificador (Teléfono o Email) y Contraseña.
  * Botón para alternar visibilidad de contraseña (ojo).
  * Enlace accesible *"¿Olvidaste tu contraseña?"* y pie con acceso a registro.
* **Qué se CORRIGE / ADAPTA en código:**
  * **TopBar Marino:** Stitch exportó esta pantalla con barra blanca. **Corrección mandatoria:** Usar la barra marina unificada `#12182C` de 56px con flecha de retroceso accesible.
  * **Touch Target:** El botón de mostrar/ocultar contraseña debe tener un área táctil mínima de 48×48px.
  * **Validación Zod:** Integrar con `loginSchema` en `src/features/auth/schemas.ts`. Autenticación vía Server Action delegando a Supabase Auth (`signInWithPassword`).

---

### `P02-error-ingresar-con-error.png` / `.html` — Error de Inicio de Sesión
* **Archivos exportados:** [`P02-error-ingresar-con-error.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P02-error-ingresar-con-error.png) · [`P02-error-ingresar-con-error.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P02-error-ingresar-con-error.html)
* **Qué se MANTIENE (Aprobado):**
  * Alerta inline en tarjeta visible arriba del formulario: *"Teléfono o contraseña incorrectos. Revisá los datos y probá de nuevo."*.
  * No disparar toasts invasivos ni popups bloqueantes. Los campos retienen el valor ingresado (salvo contraseña).
* **Qué se CORRIGE / ADAPTA en código:**
  * **Tokens shadcn:** Usar tarjeta de alerta construida con tokens semánticos: `border-destructive/30 bg-destructive/10 text-destructive-foreground`.
  * **TopBar:** Mantener barra marina institucional `#12182C`.

---

### `P03-registrarse.png` / `P03-registrarse.html` — Selección de Rol y Registro
* **Archivos exportados:** [`P03-registrarse.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P03-registrarse.png) · [`P03-registrarse.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P03-registrarse.html)
* **Qué se MANTIENE (Aprobado):**
  * Selector de tarjetas claras con ícono e ilustración: **"Tengo un comercio"** (local, rotisería, farmacia) vs **"Quiero repartir"** (moto, bici, a pie).
  * Formulario de datos básicos: Nombre / Negocio, Teléfono, Contraseña.
  * Checkbox de aceptación de Términos y Política de Privacidad con enlaces directos.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Piso de 14px:** Los textos descriptivos de cada rol deben tener mínimo 14px (`text-sm`) con Inter Medium.
  * **Touch Targets:** Las tarjetas de selección de rol deben tener mínimo 64px de alto con feedback háptico/visual (`active:scale-[0.99] border-brand-teal`).
  * **Redirección condicional:** Si elige comercio ➔ `C01` (alta local); si elige repartidor ➔ `R01` (onboarding DNI).

---

### `P04-documento-legal.png` / `P04-documento-legal.html` — Términos y Privacidad
* **Archivos exportados:** [`P04-documento-legal.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P04-documento-legal.png) · [`P04-documento-legal.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/P00/P04-documento-legal.html)
* **Qué se MANTIENE (Aprobado):**
  * Estructura legal limpia para lectura: Título, versión vigente, fecha de actualización.
  * Tabla de contenidos con saltos ancla (`#seccion-1`).
  * Cláusulas de intermediación independiente: cadeApp no es parte del flete, no cobra comisiones y no custodia dinero.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Tipografía:** Cuerpo en Inter 16px (`leading-relaxed`), texto color Ink Navy `#12182C` sobre `#FFFFFF`.
  * **Botón flotante:** Botón sticky inferior o botón de volver en el TopBar de 48px para retornar fácilmente al flujo previo.
