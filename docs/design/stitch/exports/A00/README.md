# Criterios de Implementación Técnica: Pantallas A00 (Administrador)

Este documento fija la **especificación oficial y vinculante** dictaminada por El Consejo para la implementación de las vistas de Administrador (`(admin)/...`) en Next.js, Tailwind CSS y shadcn/ui. Cualquier agente o colaborador debe ceñirse estrictamente a estas reglas.

---

## 1. Reglas Globales para el Grupo A00
- **Rutas de destino:** `src/app/(admin)/...` (`login/mfa/`, `applicants/`, `applicants/[id]/`, `merchants/`, `settings/`, `incidents/`, `audit/`).
- **Dispositivo y Layout:** **Desktop / Web** (contenedor centrado `max-w-[1280px] mx-auto p-6 min-h-screen bg-background`).
- **TopBar Administrativo:** Altura 64px, fondo blanco `#FFFFFF` con borde inferior `#E4E7EC`, logo horizontal oscuro `assets/3.svg` (`/brand/logo-horizontal-light.svg`).
- **Navegación Superior Única:** 5 pestañas exactas:
  1. **Postulantes** (`/admin/applicants`)
  2. **Comercios** (`/admin/merchants`)
  3. **Incidentes** (`/admin/incidents`)
  4. **Parámetros** (`/admin/settings`)
  5. **Auditoría** (`/admin/audit`)
  * **EXTIRPACIÓN VINCULANTE:** **Se elimina de cuajo la solapa "Liquidaciones"** presente en los mockups de Stitch. cadeApp no retiene fondos ni liquida saldos; mantener esa solapa introduce un riesgo laboral y fiscal crítico.
- **Seguridad Innegociable (MFA):** Todas las rutas y RPCs de admin exigen el claim **`aal2`** (TOTP 2FA verificado). Si el usuario solo tiene `aal1`, el middleware redirige a `A00`.
- **Componentes shadcn/ui base (`src/ui/`):** `Table`, `Badge`, `Button`, `Dialog`, `Sheet`, `Tabs`, `InputOTP`, `Textarea`, `Card`.

---

## 2. Especificación Pantalla por Pantalla

### `A00-verificacion-en-dos-pasos.png` / `.html` — MFA TOTP
* **Archivos exportados:** [`A00-verificacion-en-dos-pasos.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A00-verificacion-en-dos-pasos.png) · [`A00-verificacion-en-dos-pasos.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A00-verificacion-en-dos-pasos.html)
* **Qué se MANTIENE (Aprobado):**
  * Pantalla de seguridad previa al acceso con entrada de 6 dígitos numéricos.
  * Título: *"Verificación en dos pasos"*, subtítulo explicando la app autenticadora.
  * Conteo regresivo y botón primario *"Verificar"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Componente `InputOTP`:** Reemplazar las 6 cajas div estáticas de Stitch por el componente nativo `InputOTP` de shadcn/ui, con gestión accesible de foco y pegado directo desde portapapeles.
  * **Microcopia:** Cambiar el texto *"¿No recibiste el código?"* (típico de SMS) por *"¿Problemas con el código de tu app autenticadora?"*. En TOTP los códigos se generan localmente sin SMS.
  * **Elevación de sesión:** La verificación exitosa emite el claim `aal2` en Supabase Auth.

---

### `A01-postulantes.png` / `.html` — Bandeja de Postulantes
* **Archivos exportados:** [`A01-postulantes.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A01-postulantes.png) · [`A01-postulantes.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A01-postulantes.html)
* **Qué se MANTIENE (Aprobado):**
  * Pestañas de estado: *Pendientes (12), Aprobados (48), Rechazados (5), Suspendidos (1)*.
  * Tabla con columnas: Postulante (nombre, DNI hash), Vehículo, Documentación (DNI, Selfie, Licencia, Seguro), Fecha de postulación, Acciones.
  * Insignias visuales de completitud (`DocLevel` 0 a 2).
  * Botón *"Revisar"* que abre el detalle de A02.
* **Qué se CORRIGE / ADAPTA en código:**
  * **Piso de 14px:** Todo el texto de la tabla se renderiza en Inter 14px (`text-sm`), eliminando las clases `text-xs` (12px) de Stitch.
  * **Eliminar "Liquidaciones" del menú superior.**

---

### `A02-detalle-del-postulante.png` / `.html` — Visor Documental
* **Archivos exportados:** [`A02-detalle-del-postulante.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A02-detalle-del-postulante.png) · [`A02-detalle-del-postulante.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A02-detalle-del-postulante.html)
* **Qué se MANTIENE (Aprobado):**
  * Visor documental con controles: Zoom in/out, Rotación en 90° y Reset.
  * Tabs documentales: *DNI frente, DNI dorso, Selfie, Licencia (opcional), Seguro (opcional)*.
  * **Banner de seguridad y auditoría:** *"El acceso a estos documentos queda registrado en la auditoría inmutable"*.
  * Botones de decisión con motivo obligatorio: *"Aprobar repartidor"*, *"Rechazar postulación"*, *"Suspender"*.
* **Qué se CORRIGE / ADAPTA en código:**
  * **EXTIRPAR CBU / ALIAS BANCARIO:** En Stitch figura *"CBU / Alias validado: diego.santillan.mp"*. **Se elimina completamente.** cadeApp no recolecta CBU ni liquida fondos.
  * **URLs Firmadas:** Las imágenes se sirven exclusivamente mediante signed URLs de 60 segundos generadas en el servidor desde el bucket privado `courier-docs`. Cada visualización genera una fila en `audit_log`.

---

### `A03-comercios-y-pagos.png` / `.html` — Comercios y Suscripciones
* **Archivos exportados:** [`A03-comercios-y-pagos.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A03-comercios-y-pagos.png) · [`A03-comercios-y-pagos.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A03-comercios-y-pagos.html)
* **Qué se MANTIENE (Aprobado):**
  * Tabla de comercios: Nombre del local, Responsable, Teléfono, Barrio de retiro, Estado de plan, Pagado hasta (`paid_until`), Despachos realizados.
  * Modal para editar la vigencia de la suscripción (*"Extender piloto"* o *"Marcar mes pagado"*).
* **Qué se CORRIGE / ADAPTA en código:**
  * **EXTIRPAR CUIT:** En Stitch figura CUIT. En el MVP los comercios operan sin CUIT; se identifica por nombre del local y teléfono.
  * **SANEAMIENTO GEOGRÁFICO:** Stitch colocó comercios en *"San Miguel de Tucumán"* y *"Yerba Buena"*. Corregir todos los datos de prueba a **Aguilares** (Centro, Barrio Norte, etc.).
  * **Eliminar "Liquidaciones" del menú.**

---

### `A04-parametros.png` / `.html` — Configuración de la Plataforma
* **Archivos exportados:** [`A04-parametros.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A04-parametros.png) · [`A04-parametros.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A04-parametros.html)
* **Qué se MANTIENE (Aprobado):**
  * Control de variables críticas de `platform_settings`:
    * Oferta mínima: `$ 1.000`.
    * Vencimiento de solicitud (TTL): `30 minutos`.
    * Switch de Piloto activo: `Encendido`.
    * Días de gracia de suscripción: `0 días`.
    * Versión de Términos del piloto: `1.0`.
  * Panel lateral con historial en vivo de cambios de parámetros.
* **Qué se CORRIGE / ADAPTA en código:**
  * Corregir el texto *"Admin Central, Mendoza, AR"* a *"Aguilares, Tucumán, AR"*.
  * Toda mutación de parámetros invoca la RPC `admin_update_setting` que valida claim `aal2` y registra `before` y `after` en `audit_log`.

---

### `A05-incidentes.png` / `.html` — Gestión de Incidentes
* **Archivos exportados:** [`A05-incidentes.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A05-incidentes.png) · [`A05-incidentes.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A05-incidentes.html)
* **Qué se MANTIENE (Aprobado):**
  * Listado de reclamos con tipo (*"El repartidor no llegó"*, *"Problema con el cobro"*, *"Mercadería dañada"*).
  * Drawer lateral con la cronología completa del viaje.
  * Relato de las partes y teléfonos para mediación manual vía llamada directa.
  * Botones de resolución: *"Resolver sin sanción"*, *"Advertencia"*, *"Suspensión preventiva"*.

---

### `A06-auditoria.png` / `.html` — Registro Inmutable de Auditoría
* **Archivos exportados:** [`A06-auditoria.png`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A06-auditoria.png) · [`A06-auditoria.html`](file:///C:/Users/El%20Yisus%20Pai/Desktop/Proyectos/cadeApp/docs/design/stitch/exports/A00/A06-auditoria.html)
* **Qué se MANTIENE (Aprobado):**
  * Tabla inmutable: Fecha/Hora exacta, Operador (Lautaro / Admin), Acción realizada, Entidad (`courier`, `merchant`, `settings`), Detalles del cambio.
  * Filtros por operador y tipo de evento.
* **Qué se CORRIGE / ADAPTA en código:**
  * Lectura directa mediante Server Component sobre la tabla append-only `audit_log` con paginación server-side.
