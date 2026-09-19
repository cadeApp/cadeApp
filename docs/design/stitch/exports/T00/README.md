# Criterios de Implementación Técnica: Pantallas T00 (Transversales)

Este documento fija la **especificación oficial y vinculante** dictaminada por El Consejo para la implementación de las vistas transversales de la aplicación móvil en Next.js, Tailwind CSS y shadcn/ui. Cualquier agente o colaborador debe ceñirse estrictamente a estas reglas.

---

## 1. Reglas Globales para el Grupo T00
- **Naturaleza:** Son estados de ciclo de vida, contingencia, errores y guías que se disparan condicionalmente dentro de las rutas de Comercio y Repartidor.
- **Componentes shadcn/ui base (`src/ui/`):** `AlertDialog`, `Sheet`, `Skeleton`, `Sonner` (`toast`), `Button`.
- **TopBar:** Fondo marino institucional `#12182C` cuando el estado ocupa la pantalla completa.

---

## 2. Especificación Pantalla por Pantalla

### `T01-instalar-la-app-en-iphone.png` / `.html` — Guía PWA en iOS
* **Archivos exportados:** [`T01-instalar-la-app-en-iphone.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T01-instalar-la-app-en-iphone.png) · [`T01-instalar-la-app-en-iphone.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T01-instalar-la-app-en-iphone.html)
* **Qué se MANTIENE (Aprobado):**
  * Guía visual en 3 pasos claros:
    1. *"Tocá el botón Compartir"* (ícono nativo de iOS).
    2. *"Elegí «Agregar a inicio»"*.
    3. *"Abrí cadeApp desde el ícono de tu pantalla"*.
  * Advertencia fundamental: *"Si usás Chrome en iPhone, primero abrí este link en Safari"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * Implementar como un `<Sheet>` deslizante desde abajo cuando se detecta iOS Safari en modo navegador (`standalone === false`).
  * Comillas tipográficas rioplatenses ("Agregar a inicio").

---

### `T02-pedido-de-notificaciones.png` / `.html` — Permiso Web Push
* **Archivos exportados:** [`T02-pedido-de-notificaciones.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T02-pedido-de-notificaciones.png) · [`T02-pedido-de-notificaciones.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T02-pedido-de-notificaciones.html)
* **Qué se MANTIENE (Aprobado):**
  * Pantalla persuasiva previa al diálogo nativo del navegador (*"soft prompt"*).
  * Explicación del valor: *"Te avisamos al instante cuando aparezca una solicitud o cuando te elijan"*.
  * Botón primario *"Activar avisos"* y ghost *"Ahora no"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **TopBar Marino:** Unificar a `#12182C`.
  * **Integración:** El clic en *"Activar avisos"* invoca `Notification.requestPermission()`, registra la suscripción Web Push en la tabla `push_subscriptions` y guarda la preferencia en `localStorage`.

---

### `T03-sin-conexion.png` / `.html` — Estado Offline
* **Archivos exportados:** [`T03-sin-conexion.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T03-sin-conexion.png) · [`T03-sin-conexion.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T03-sin-conexion.html)
* **Qué se MANTIENE (Aprobado):**
  * **Degradación no destructiva:** Banner superior sutil con ícono wifi-off: *"Sin conexión. Mostramos lo último que cargó"*.
  * El feed se atenúa al 60% en escala de grises (`grayscale-[20%] opacity-80`) y los botones de ofertar se deshabilitan.
  * Tarjeta flotante inferior: *"Cuando vuelva la conexión, actualizamos solo"* con botón *"Reintentar"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **SANEAMIENTO DE DATOS:** Stitch colocó barrios de Córdoba (*Alberdi, Microcentro, Tribunales*) y un emisor *"Particular"*. Corregir a **barrios reales de Aguilares** y comercios locales.
  * **Gestión en Cliente:** Escuchar eventos `window.addEventListener('offline')` y `window.addEventListener('online')` para alternar este estado automáticamente.

---

### `T04-error-general.png` / `.html` — Página de Error y 404
* **Archivos exportados:** [`T04-error-general.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T04-error-general.png) · [`T04-error-general.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T04-error-general.html)
* **Qué se MANTIENE (Aprobado):**
  * Motivo gráfico: Línea de ruta ondulada rota (`wavy-accent`).
  * Tono empático y sin tecnicismos: *"Algo salió mal. No es tu culpa. Probá de nuevo en unos segundos."*.
  * Código de soporte para atención rápida (*"Código: 5F2A"*).
  * Botones: Primario *"Reintentar"* y Ghost *"Ir al inicio"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * Mapear a los archivos de Next.js App Router: `src/app/error.tsx` (para excepciones runtime) y `src/app/not-found.tsx` (para 404).

---

### `T05-confirmar-cancelacion.png` / `.html` — Cancelación Destructiva
* **Archivos exportados:** [`T05-confirmar-cancelacion.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T05-confirmar-cancelacion.png) · [`T05-confirmar-cancelacion.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T05-confirmar-cancelacion.html)
* **Qué se MANTIENE (Aprobado):**
  * Ícono de peligro y advertencia: *"¿Cancelar esta solicitud? Las ofertas que recibiste se van a cerrar. No se puede deshacer."*.
  * Selector obligatorio de motivo (*"Ya no hace falta"*, *"Lo resolví de otra forma"*, *"Me equivoqué en los datos"*, *"Otro"*).
  * Botón destructivo rojo de 48px: *"Sí, cancelar solicitud"* y outline *"Volver"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Primitiva Radix UI:** `<AlertDialog>` de shadcn/ui.
  * **Extirpar estrellas y calificaciones del fondo** que Stitch renderizó en la vista duplicada.
  * Invocar la RPC `cancel_request(id, reason)` con motivo no vacío.

---

### `T06-aviso-y-estado-de-carga.png` / `.html` — Skeletons y Toasts
* **Archivos exportados:** [`T06-aviso-y-estado-de-carga.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T06-aviso-y-estado-de-carga.png) · [`T06-aviso-y-estado-de-carga.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/T00/T06-aviso-y-estado-de-carga.html)
* **Qué se MANTIENE (Aprobado):**
  * **Estructura idéntica de Skeleton:** Tarjetas de carga con exactamente la misma forma y posición que los elementos reales (insignia, ruta, detalles, monto y botón).
  * **Toast accesible:** Notificación flotante en fondo Ink Navy `#12182C` con texto blanco y botón de acción ghost (*"Oferta aceptada — Ver"*).
* **Qué se CORRIGE / ADAPTA en código:**
  * Implementar los Skeletons con el componente `Skeleton` de shadcn/ui en los archivos `loading.tsx` de cada ruta.
  * Implementar los avisos flotantes con **Sonner** (`toast.success(...)`, regla 25).
