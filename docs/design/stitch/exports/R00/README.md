# Criterios de Implementación Técnica: Pantallas R00 (Repartidor)

Este documento fija la **especificación oficial y vinculante** dictaminada por El Consejo para la implementación de las vistas de Repartidor (`(courier)/...`) en Next.js, Tailwind CSS y shadcn/ui. Cualquier agente o colaborador debe ceñirse estrictamente a estas reglas.

---

## 1. Reglas Globales para el Grupo R00
- **Rutas de destino:** `src/app/(courier)/...` (`onboarding/identity/`, `onboarding/vehicle/`, `onboarding/status/`, `feed/`, `offers/`, `trips/[id]/`, `profile/`).
- **Layout:** `src/app/(courier)/layout.tsx` con contenedor móvil centrado (`max-w-[390px] mx-auto min-h-screen pb-20 bg-background`).
- **TopBar Unificado Institucional:** Altura 56px, fondo Ink Navy `#12182C`, logo horizontal blanco `assets/2.svg` (`/brand/logo-horizontal-dark.svg`).
- **Bottom Navigation Institucional:** Componente único `BottomNav` en `src/ui/bottom-nav.tsx` con 3 pestañas:
  1. **Solicitudes** (`/courier/feed`): Ícono `PackageSearch` de `lucide-react`.
  2. **Mis ofertas** (`/courier/offers`): Ícono `BadgeDollarSign` de `lucide-react`.
  3. **Perfil** (`/courier/profile`): Ícono `User` de `lucide-react`.
- **Regla de Ergonomía Outdoor:**
  * Todas las acciones principales miden **48 px o 56 px** de alto para uso con una mano y guantes de moto en el semáforo.
  * Piso mínimo absoluto de fuente de **14 px (`text-sm`)**; prohibido `text-xs` (12 px) en datos operativos.

---

## 2. Especificación Pantalla por Pantalla

### `R01-onboarding-documentos-obligatorios.png` / `.html` — Documentación
* **Archivos exportados:** [`R01-onboarding-documentos-obligatorios.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R01-onboarding-documentos-obligatorios.png) · [`R01-onboarding-documentos-obligatorios.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R01-onboarding-documentos-obligatorios.html)
* **Qué se MANTIENE (Aprobado):**
  * Barra de progreso en 4 pasos: *Datos -> Identidad -> Vehículo -> Listo*.
  * Input de DNI numérico.
  * Tarjetas de subida: DNI frente, DNI dorso, Selfie, Foto de perfil.
  * Tips empáticos: *"Sin anteojos de sol ni gorra"*, *"Con buena luz y sin reflejos"*.
  * Botón *"Continuar"* deshabilitado hasta completar los 4 requisitos.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Touch Target Masivo:** En lugar de botones diminutos de "Subir" (36px), la tarjeta entera debe funcionar como un label clickeable de 72px de altura sobre `<input type="file" class="sr-only">`.
  * **Compresión en el Cliente:** Importar dinámicamente `browser-image-compression` para comprimir las fotos a < 500 KB antes de enviarlas al Storage privado de Supabase (`courier-docs`).
  * **Privacidad Estricta:** Las fotos nunca son públicas; se almacenan en un bucket privado con RLS denegada y acceso exclusivo para auditoría del Admin.

---

### `R02-onboarding-vehiculo-y-consentimientos.png` / `.html` — Vehículo
* **Archivos exportados:** [`R02-onboarding-vehiculo-y-consentimientos.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R02-onboarding-vehiculo-y-consentimientos.png) · [`R02-onboarding-vehiculo-y-consentimientos.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R02-onboarding-vehiculo-y-consentimientos.html)
* **Qué se MANTIENE (Aprobado):**
  * Grid 2×2 para tipo de transporte: *A pie, Bici, Moto (seleccionado), Auto*.
  * Campo de Patente condicional (visible solo para moto o auto).
  * Tarjeta de incentivo *"Aparecé primero"*: subida opcional de Licencia y Seguro para ganar insignias verificadas.
  * Tres checkboxes de consentimiento independientes (Términos, Privacidad y Reconocimiento de prestador independiente).
* **Qué se CORRIGE / ADAPTA en código:**
  * Validaciones Zod con formato de patente argentina (`AB 123 CD` o `A 123 BCD`).
  * Botón *"Enviar para revisión"* de 48px anclado al pie con `safe-area-inset-bottom`.

---

### `R03-en-revision.png` / `.html` — Espera de Aprobación
* **Archivos exportados:** [`R03-en-revision.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R03-en-revision.png) · [`R03-en-revision.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R03-en-revision.html)
* **Qué se MANTIENE (Aprobado):**
  * Estado sereno y transparente: *"Estamos revisando tus datos"*.
  * Checklist de documentos cargados vs opcionales pendientes.
  * Botón para completar documentación opcional y botón *"Salir"*.

---

### `R04-solicitudes-abiertas.png` / `.html` — Feed de Solicitudes
* **Archivos exportados:** [`R04-solicitudes-abiertas.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R04-solicitudes-abiertas.png) · [`R04-solicitudes-abiertas.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R04-solicitudes-abiertas.html)
* **Qué se MANTIENE (Aprobado):**
  * Switch principal *"Disponible"* (verde/teal cuando está activo).
  * Contador en vivo de pedidos abiertos en Aguilares.
  * Tarjetas de solicitud con:
    * Ruta por barrios: *"Centro → Barrio Norte"*.
    * Distancia aproximada calculada en servidor: *"≈ 2,5 km"*.
    * Tipo de paquete (*"Paquete chico"*).
    * Modalidad de pago (*"Paga en efectivo · necesita cambio"*).
    * Tiempo de publicación y vencimiento.
    * Botón secundario *"Ofertar"* (48 px).
    * Si ya ofertó: Badge *"Ya ofertaste $ 1.600"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **BLINDAJE D3 Y D15 (VINCULANTE):** **ESTRICTAMENTE PROHIBIDO MOSTRAR MAPAS, COORDENADAS O DIRECCIONES EXACTAS EN ESTA PANTALLA.** El DTO que entrega el servidor no incluye lat/lng ni direcciones de retiro o entrega.
  * **First-Load JS < 100 KB:** Cero SDK de Google Maps en esta ruta. Garantiza carga instantánea en redes 3G periféricas.
  * **Distancias Redondeadas:** Siempre redondeadas a múltiplos de 0,5 km (`1,0 km`, `1,5 km`, `2,0 km`, `2,5 km`) para no filtrar la ubicación por triangulación.

---

### `R05-ofertar.png` / `.html` — Enviar Oferta (Bottom Sheet)
* **Archivos exportados:** [`R05-ofertar.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R05-ofertar.png) · [`R05-ofertar.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R05-ofertar.html)
* **Qué se MANTIENE (Aprobado):**
  * **Diseño ergonómico para una sola mano:** Bottom Sheet ubicado en la zona natural del pulgar.
  * **Chips de tarifa predeterminados:** `$ 1.200`, `$ 1.500`, `$ 2.000`.
  * **Chips de tiempo de llegada a retirar:** `10 min`, `15 min`, `20 min`, `30 min`.
  * Input de monto con tipografía Montserrat 700 y prefijo `$`.
  * Texto explicativo: *"Si te eligen, vas a ver las direcciones exactas, el mapa del recorrido y el contacto del cliente. El envío se lo cobrás a quien recibe."*.
  * Botón primario *"Enviar oferta"* de 48px.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Primitiva Radix UI:** Implementar con el componente `Sheet` de shadcn/ui.
  * **EXTIRPAR PRECIOS SUGERIDOS:** En el fondo de Stitch figura *"Sugerido $ 1.400"*. Prohibido: en cadeApp no hay tarifas sugeridas por algoritmo; la cotización es libre respetando el piso ($ 1.000).
  * **EXTIRPAR BARRIOS CORDOBESES:** Corregir a barrios de Aguilares (*Centro, Los Ceibos, etc.*).
  * **Teclado móvil:** El input de monto debe llevar `inputmode="numeric"` para abrir exclusivamente teclado numérico grande en el celular.
  * **Validación de Piso:** El botón valida que el monto sea $\ge \$1.000$.

---

### `R06-mis-ofertas.png` / `.html` — Ofertas Enviadas
* **Archivos exportados:** [`R06-mis-ofertas.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R06-mis-ofertas.png) · [`R06-mis-ofertas.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R06-mis-ofertas.html)
* **Qué se MANTIENE (Aprobado):**
  * Tabs: *Pendientes (2), Aceptadas (1), Otras*.
  * **Tarjeta destacada de victoria:** *"¡Te eligieron! Centro → Barrio Norte, $ 1.800"* con botón primario *"Ir al viaje"*.
  * Botón outline para *"Retirar oferta"* en las pendientes.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Eventos en vivo:** Suscripción Supabase a la tabla `offers` filtrando por el `courier_id` para alertar en tiempo real cuando el comercio acepte la oferta.

---

### `R07-viaje-vista-del-repartidor.png` / `.html` — Viaje Activo
* **Archivos exportados:** [`R07-viaje-vista-del-repartidor.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R07-viaje-vista-del-repartidor.png) · [`R07-viaje-vista-del-repartidor.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R07-viaje-vista-del-repartidor.html)
* **Qué se MANTIENE (Aprobado):**
  * **Tarjeta de cobro en mano destacada:** *"Cobrás al entregar: $ 1.800 — Efectivo · necesita cambio de $ 2.000"*.
  * Direcciones exactas reveladas: Retiro (*San Martín 450*) y Entrega (*Belgrano 1220*).
  * Contactos con botones directos de WhatsApp y Llamada para comercio y cliente.
  * **Mapa de Recorrido de Aguilares (D15):** Muestra el pin de retiro y el de entrega.
  * **BOTÓN PROMINENTE "Abrir en Google Maps":** Botón de 48 px con enlace universal que abre el GPS nativo del teléfono (`https://www.google.com/maps/dir/?api=1&origin=...&destination=...`).
  * **BOTÓN STICKY GIGANTE DE 56 PX:** *"Marcar como retirado"* y luego *"Confirmar entrega ($ 1.800)"*. Diseñado para uso con guantes.
* **Qué se CORRIGE / ADAPTA en código:**
  * **SIN LIVE TRACKING (D7):** No hay seguimiento en vivo de la posición del repartidor.
  * **Botones de contacto en 48 px:** Elevar los botones de WhatsApp y Llamar de 44px a **48 px**, con el verde oficial `#25D366` para WhatsApp.
  * **Cancelación segura:** El botón *"No puedo hacer este viaje"* debe solicitar confirmación con motivo obligatorio para evitar cancelaciones involuntarias en la moto.

---

### `R08-perfil-y-documentacion.png` / `.html` — Perfil del Repartidor
* **Archivos exportados:** [`R08-perfil-y-documentacion.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R08-perfil-y-documentacion.png) · [`R08-perfil-y-documentacion.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/R00/R08-perfil-y-documentacion.html)
* **Qué se MANTIENE (Aprobado):**
  * Avatar, nombre y estado *"Aprobado"*.
  * Vehículo y patente declarados.
  * Estado de insignias: Licencia y Seguro (*Verificado* o *En revisión*).
  * Ajustes de notificaciones y cierre de sesión.
* **Qué se CORRIGE / ADAPTA en código:**
  * **EXTIRPAR CBU / ALIAS BANCARIO:** Prohibido solicitar datos bancarios en el perfil. cadeApp no retiene ni liquida dinero; el repartidor cobra en mano o por transferencia directa acordada con quien recibe. Esto blinda a la plataforma contra riesgos de relación laboral encubierta (Ley 20.744, art. 23).
