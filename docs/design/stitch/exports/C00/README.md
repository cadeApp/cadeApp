# Criterios de Implementación Técnica: Pantallas C00 (Comercio)

Este documento fija la **especificación oficial y vinculante** dictaminada por El Consejo para la implementación de las vistas de Comercio (`(merchant)/...`) en Next.js, Tailwind CSS y shadcn/ui. Cualquier agente o colaborador debe ceñirse estrictamente a estas reglas.

---

## 1. Reglas Globales para el Grupo C00
- **Rutas de destino:** `src/app/(merchant)/...` (`onboarding/`, `dashboard/`, `requests/new/`, `requests/[id]/`, `trips/[id]/`, `history/`, `plan/`).
- **Layout:** `src/app/(merchant)/layout.tsx` con contenedor móvil centrado (`max-w-[390px] mx-auto min-h-screen pb-20 bg-background`).
- **TopBar Unificado Institucional:** Altura 56px, fondo Ink Navy `#12182C`, logo horizontal blanco `assets/2.svg` (`/brand/logo-horizontal-dark.svg`) y avatar/campana accesible. **Se erradican las barras superiores blancas que Stitch colocó erráticamente en C03 y C04.**
- **Bottom Navigation Institucional:** Componente único `BottomNav` en `src/ui/bottom-nav.tsx` con 3 pestañas:
  1. **Inicio** (`/merchant/dashboard`): Ícono `Store` de `lucide-react`.
  2. **Historial** (`/merchant/history`): Ícono `History` de `lucide-react`.
  3. **Mi Plan** (`/merchant/plan`): Ícono `BadgeDollarSign` o `User` de `lucide-react`.
  * *Estado activo:* Deep Teal `#0B7A7D` o Ink Navy `#12182C`. Prohibido usar Teal claro `#09BABD` para texto o íconos sobre blanco.
- **Componentes shadcn/ui base (`src/ui/`):** `Button`, `Card`, `Badge`, `Sheet`, `Dialog`, `Input`, `Textarea`, `Switch`, `Skeleton`.

---

## 2. Especificación Pantalla por Pantalla

### `C01-alta-del-negocio.png` / `.html` — Registro del Comercio
* **Archivos exportados:** [`C01-alta-del-negocio.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C01-alta-del-negocio.png) · [`C01-alta-del-negocio.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C01-alta-del-negocio.html)
* **Qué se MANTIENE (Aprobado):**
  * Título: *"Alta de tu negocio"*. Subtítulo empático para calles sin número.
  * Selector de barrio en dropdown (`zones`).
  * Mapa centrado en Aguilares con crosshair fijo y botón *"Usar mi ubicación actual"*.
  * Consentimiento de términos del piloto antes de publicar.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Carga diferida del mapa:** Importación dinámica obligatoria (`next/dynamic`) de `@vis.gl/react-google-maps` con `MapSkeleton`.
  * **Fallback si el mapa falla:** Si el script de Google no carga o el usuario no da permiso de GPS, el formulario permite ingresar la dirección de texto manualmente y toma el centroide del barrio seleccionado en el dropdown (`zones.lat/lng`).
  * **Bounding Box Postgres:** Las coordenadas se validan en cliente con Zod y en servidor contra el bounding box de Aguilares (-27.4550 a -27.4100 lat, -65.6400 a -65.5950 lng). Coordenadas fuera de rango disparan alerta inline: *"El punto está fuera del radio de Aguilares"*.

---

### `C02-inicio-con-solicitudes-activas.png` / `.html` — Dashboard Comercio
* **Archivos exportados:** [`C02-inicio-con-solicitudes-activas.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C02-inicio-con-solicitudes-activas.png) · [`C02-inicio-con-solicitudes-activas.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C02-inicio-con-solicitudes-activas.html)
* **Qué se MANTIENE (Aprobado):**
  * Métricas del día: *"Despachos hoy"* y *"Tarifa promedio"*.
  * Botón primario prominente de 48px: *"Nueva solicitud"*.
  * Lista de solicitudes activas agrupadas por estado con badge: *"Con ofertas (3)"*, *"Asignada (en camino)"*.
  * Moneda en formato estricto: `$ 1.800`.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Badges de estado:** Usar `src/ui/status-badge.tsx` con estilos canónicos (píldoras `rounded-full`, 14px de fuente, contraste AA).
  * **Datos en vivo:** Suscripción ligera a Supabase Realtime para actualizar las ofertas entrantes sin recargar la página.

---

### `C03-nueva-solicitud.png` / `.html` — Crear Solicitud de Envío
* **Archivos exportados:** [`C03-nueva-solicitud.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C03-nueva-solicitud.png) · [`C03-nueva-solicitud.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C03-nueva-solicitud.html)
* **Qué se MANTIENE (Aprobado):**
  * Flujo en **1 solo paso** sin wizards engorrosos.
  * **Origen precargado por defecto** con el local del comercio (`San Martín 450, Centro`), editable solo si hace falta.
  * Chips de tamaño de paquete (*Sobre, Chico, Mediano, Grande*).
  * Segmented control de pago del destinatario (*Efectivo, Transferencia, A coordinar*).
  * Distancia calculada en servidor mostrada de forma clara (`≈ 2,5 km`).
* **Qué se CORRIGE / ADAPTA en código:**
  * **TopBar Marino:** Stitch lo puso blanco. Unificar en Ink Navy `#12182C`.
  * **EL MAPA DE ENTREGA ES OPCIONAL (Mandato de Personas):** En hora pico de rotisería, Don Juan no puede perder tiempo clavando pines. Si selecciona el barrio en el dropdown y tipea la calle y referencias (*"Frente a la plaza, reja blanca"*), el sistema calcula la distancia usando el centroide de `zones` y permite publicar en 5 segundos.
  * **FALTANTE DE CAMBIO (Mandato de Personas):** Al encender el switch *"Necesita cambio"*, desplegar chips rápidos de denominación: **"Paga con: $ 2.000 | $ 5.000 | $ 10.000 | Otro"**. Este dato se envía al cadete en R07.
  * **Adaptación a 360 px:** Los 4 chips de paquete deben distribuirse en `grid grid-cols-2 min-[370px]:grid-cols-4 gap-2` con altura mínima de 48px.
  * **Checkbox de consentimiento:** El checkbox *"Mi cliente sabe que compartimos estos datos"* no debe trabar el formulario; viene prechequeado y con texto legal pasivo.

---

### `C04-detalle-con-ofertas-en-vivo.png` / `.html` — Ofertas Entrantes
* **Archivos exportados:** [`C04-detalle-con-ofertas-en-vivo.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C04-detalle-con-ofertas-en-vivo.png) · [`C04-detalle-con-ofertas-en-vivo.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C04-detalle-con-ofertas-en-vivo.html)
* **Qué se MANTIENE (Aprobado):**
  * Cronómetro regresivo de vencimiento: *"Vence en 17:42"*.
  * Tarjetas de oferta con nombre del cadete, vehículo, insignias (*Licencia*, *Seguro*), monto ($ 1.800), tiempo de retiro (*"Llega en ~10 min"*) y mensaje opcional.
  * Selector de ordenamiento: *"Por documentación"* o *"Por precio"*.
  * Botón *"Aceptar"* de 48px en cada tarjeta.
* **Qué se CORRIGE / ADAPTA en código:**
  * **TopBar Marino:** Unificar a `#12182C`.
  * **EXTIRPACIÓN TOTAL DE ESTRELLAS Y REVIEWS:** En el fondo de Stitch figura *"4.9 ★ (182 viajes)"*. Esto queda **terminantemente prohibido**. El MVP no contempla sistema de calificaciones (supuesto S4).
  * **Tiempo Real:** Canal de Supabase Realtime escuchando `INSERT` / `UPDATE` en `offers` para invalidar el query de TanStack Query sin recargas manuales.

---

### `C05-confirmar-aceptacion.png` / `.html` — Diálogo de Aceptación
* **Archivos exportados:** [`C05-confirmar-aceptacion.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C05-confirmar-aceptacion.png) · [`C05-confirmar-aceptacion.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C05-confirmar-aceptacion.html)
* **Qué se MANTIENE (Aprobado):**
  * Título claro: *"¿Aceptás la oferta de Joaquín R. por $ 1.800?"*.
  * Advertencia explícita de revelación progresiva (D3): *"Al aceptar, Joaquín verá las direcciones y datos de contacto de tu cliente. Las otras ofertas se rechazan automáticamente."*.
  * Botones apilados de 48px: Primario *"Sí, aceptar"* y Outline *"Volver"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Primitiva Radix UI:** Reemplazar el modal simulado de Stitch por `<Dialog>` o `<AlertDialog>` de shadcn/ui.
  * **Transacción Atómica en Backend:** El botón *"Sí, aceptar"* invoca la Server Action que llama a la RPC `accept_offer(offer_id)`. Se ejecuta con `SELECT ... FOR UPDATE` para evitar colisiones si dos personas aceptan a la vez.
  * **Extirpar estrellas fantasma** en la tarjeta de resumen.

---

### `C06-viaje-activo.png` / `.html` — Seguimiento del Envío (Comercio)
* **Archivos exportados:** [`C06-viaje-activo.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C06-viaje-activo.png) · [`C06-viaje-activo.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C06-viaje-activo.html)
* **Qué se MANTIENE (Aprobado):**
  * Stepper superior: *"Asignada"* (hecho), *"Retirado"* (actual), *"Entregado"* (pendiente).
  * Tarjeta del cadete con avatar, vehículo, patente (`AB 123 CD`) y botones *"WhatsApp"* y *"Llamar"*.
  * **Tarjeta destacada "Avisale a tu cliente":** Preview del mensaje de WhatsApp listo para mandar a Laura y botón *"Avisar a mi cliente"*.
  * Datos exactos de entrega revelados.
  * Acciones de contingencia: *"El repartidor no llegó"*, *"Reportar un problema"*, *"Cancelar envío"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Botón de WhatsApp:** Estandarizado en verde oficial `#25D366` sólido con texto blanco y altura de 48px.
  * **Mapa de Recorrido (D15 y D7):** Mapa interactivo de Aguilares mostrando **únicamente dos pines fijos** (Retiro en local y Entrega en destino) unidos por una traza orientativa. **NO HAY LIVE TRACKING NI GPS EN TIEMPO REAL DEL REPARTIDOR (D7 vigente).**
  * **"El repartidor no llegó":** Dispara la RPC `report_no_show` que devuelve el pedido al estado `published` para recibir nuevas ofertas.

---

### `C07-historial.png` / `.html` — Historial de Envíos
* **Archivos exportados:** [`C07-historial.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C07-historial.png) · [`C07-historial.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C07-historial.html)
* **Qué se MANTIENE (Aprobado):**
  * Pestañas de filtro: *Todas, Entregadas, Canceladas, Vencidas*.
  * Filas agrupadas por fecha (*Hoy, Ayer, 12 de octubre*).
  * Datos clave en cada fila: Ruta (*Centro → Barrio Sur*), cadete, monto ($ 1.800), hora y badge de estado.
* **Qué se CORRIGE / ADAPTA en código:**
  * **BottomNav unificado:** Emplear exactamente el mismo componente y los mismos íconos (`Store`, `History`, `User`) que en C02.

---

### `C08-mi-plan.png` / `.html` — Estado de Suscripción / Piloto
* **Archivos exportados:** [`C08-mi-plan.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C08-mi-plan.png) · [`C08-mi-plan.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/C00/C08-mi-plan.html)
* **Qué se MANTIENE (Aprobado):**
  * Tarjeta de estado: *"Piloto gratuito activo en Aguilares"*.
  * Fecha de vigencia: *"Hasta el 31 de diciembre"*.
  * Explicación del modelo: envíos ilimitados, cobro directo cliente-cadete, comisión 0%.
* **Qué se CORRIGE / ADAPTA en código:**
  * **EXTIRPAR BLOQUE TRIBUTARIO ARBA / AFIP:** Prohibido por la decisión cerrada D6 (*sin facturación en el piloto*). Además, ARBA es de Buenos Aires (en Tucumán es DGR).
  * **Navegación:** Tab activo en la barra inferior debe usar Deep Teal `#0B7A7D`, nunca Teal claro `#09BABD` (infracción de contraste WCAG).
