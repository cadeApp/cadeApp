# 04 — Administración

Tipo de dispositivo: **Desktop (web)**, 1280 px. Cada prompt va precedido por el Bloque de estilo de
`00-sistema-de-diseno.md` y además por esta línea:

```text
This is the internal admin panel: desktop web at 1280 px, left sidebar navigation, dense but readable tables, same colors and typography as the mobile app.
```

Navegación común: barra lateral en tinta `#12182C` con el logo horizontal y los ítems **Postulantes**, **Comercios**,
**Incidentes**, **Parámetros** y **Auditoría**.

Reglas de estas pantallas:
- MFA obligatorio para entrar.
- Ver un DNI o una selfie queda registrado en la auditoría, y la pantalla lo dice.
- Aprobar, rechazar, suspender o cambiar parámetros pide confirmación y motivo.

## A00 — Verificación en dos pasos

```prompt
Screen: admin second-factor check after password login, centered card on the #FDFCFB background.
Small cadeApp logo on top, title "Verificación en dos pasos", text "Ingresá el código de 6 dígitos de tu app de autenticación."
Six separate digit boxes, the first three filled. Primary button "Verificar". Muted link "Cerrar sesión".
Below the card a muted line with a lock icon: "El panel de administración requiere un segundo factor."
```

## A01 — Postulantes

```prompt
Screen: courier applicants queue, page title "Postulantes" with a count badge "7 pendientes".
Filter tabs: "Pendientes", "Aprobados", "Rechazados", "Suspendidos" ("Pendientes" selected) and a search input "Buscar por nombre".
Table columns: "Postulante" (avatar + name), "Vehículo", "Documentos" (small icons with checks: DNI, selfie, licencia, seguro), "Opcionales" ("0/2", "1/2", "2/2"), "Enviado" ("hace 2 h"), "Alerta", and a right-aligned button "Revisar".
One row shows in the "Alerta" column a warning badge "DNI ya registrado" (possible re-entry of a rejected person).
Pagination at the bottom: "Anterior", "1 de 2", "Siguiente".
```

## A02 — Detalle del postulante

```prompt
Screen: applicant review, breadcrumb "Postulantes / Diego S.".
Left column (60%): a document viewer with tabs "DNI frente", "DNI dorso", "Selfie", "Licencia", "Seguro"; a large image placeholder of an ID card; zoom and rotate controls; and a warning-tinted bar on top of the viewer with an eye icon: "Este acceso queda registrado en la auditoría."
Under the viewer, for the optional documents, two buttons: "Marcar licencia verificada" (success outline) and "Rechazar comprobante" (danger outline).
Right column (40%): card with the applicant data: name, "DNI terminado en ···321", phone, vehicle "Moto · AB 123 CD", sign-up date, consents with dates. A card "Historial" with a vertical timeline: "Registrado", "Documentos enviados".
Sticky action bar at the bottom right: primary "Aprobar", outline "Rechazar", and a danger ghost "Suspender" (disabled because not approved yet).
```

**Variante A02-rechazar** (editar A02):

```prompt
Show a dialog "Rechazar a Diego S." with a required select "Motivo" (options: "Foto ilegible", "Datos no coinciden", "Documento vencido", "Otro"), a textarea "Mensaje para el postulante", and buttons "Rechazar" (danger) and "Cancelar". The rest of the page is dimmed.
```

## A03 — Comercios y pagos

```prompt
Screen: merchants and plans, page title "Comercios".
Summary chips at the top: "Piloto: 12", "Activos: 5", "Vencidos: 2".
Table columns: "Comercio", "Contacto", "Plan" (badges "Piloto" teal, "Activo" success, "Vencido" danger), "Pagado hasta", "Solicitudes (30 días)", and an action "Editar plan".
A right-side sheet is open for "Panadería La Espiga": select "Estado" (value "Activo"), date input "Pagado hasta" (value "30/11/2026"), textarea "Nota interna" (placeholder "Ej.: pagó en efectivo el 01/11"), a muted note "No se registran montos ni comprobantes de pago en cadeApp.", buttons "Guardar" and "Cancelar".
```

## A04 — Parámetros

```prompt
Screen: platform settings, page title "Parámetros".
A warning card at the top: "Los cambios aplican al instante para todos y quedan en la auditoría."
Form cards, each with a label, the current value, a helper text and its own "Guardar" button:
- "Oferta mínima" with "$" prefix and value "1.000", helper "Las ofertas por debajo se rechazan."
- "Vencimiento de solicitudes" value "30" with suffix "minutos".
- "Piloto activo" switch on, helper "Mientras esté activo, todos los comercios publican gratis."
- "Días de gracia del abono" value "0".
- "Versión de términos del piloto" value "1".
Side panel "Últimos cambios": a short list like "Oferta mínima: 800 → 1.000 · Lautaro · 12/10 18:20".
```

## A05 — Incidentes

```prompt
Screen: incidents, page title "Incidentes", tabs "Abiertos (2)", "Resueltos".
Table columns: "Fecha", "Envío" ("Centro → Barrio Norte"), "Reportó" ("Comercio" or "Repartidor"), "Tipo" (badges "No llegó", "Paquete dañado", "Cobro", "Otro"), "Estado", and a button "Ver".
A right-side sheet is open for one incident: the description text, the delivery timeline (published, accepted, picked up, delivered with times), the people involved with links to their profiles, a textarea "Resolución", and buttons "Marcar resuelto", "Suspender repartidor" (danger outline) and "Cerrar".
```

## A06 — Auditoría

```prompt
Screen: audit log, page title "Auditoría", read-only.
Filters in a row: select "Acción" (value "Todas"), select "Persona", date range "Desde / Hasta".
Table columns: "Fecha y hora", "Quién", "Acción" (badges "Vio documento", "Aprobó", "Rechazó", "Suspendió", "Cambió parámetro", "Cambió plan"), "Sobre" ("Diego S." or "Panadería La Espiga"), "Detalle" ("DNI frente", "Oferta mínima: 800 → 1.000").
Muted note at the top: "Este registro no se puede editar ni borrar." Pagination at the bottom.
```
