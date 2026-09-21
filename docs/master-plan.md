# cadeApp — Master plan del MVP

> Plan corregido por El Consejo. Revisión `revision-1`, 2026-09-17. **Estado final: CONDICIONAL.**
> Registro de la corrida: `.el-consejo/revision-1/` (dictámenes, réplica, fallo del Juez, checkpoint y evidencia).
> El cómo construirlo con agentes está en [`implementation-plan.md`](implementation-plan.md).

---

## 1. Qué es cadeApp

cadeApp es una PWA que conecta a comercios y emprendedores que necesitan hacer una entrega con repartidores independientes de la misma ciudad. El comercio publica una solicitud, los repartidores ofertan cuánto cobrarían y el comercio elige a uno. Desde ahí coordinan directamente.

cadeApp **no es una empresa de delivery**:
- no cobra ni custodia el dinero del envío,
- no emplea repartidores,
- no se hace cargo de la mercadería.

Su función es de intermediario tecnológico: da visibilidad, confianza y coordinación.

**Flujo:** el comercio publica → los repartidores habilitados ofertan (mínimo ARS 1.000) → el comercio elige → le avisa a su cliente cuánto sale el envío → el repartidor entrega y **cobra el envío a quien recibe**.

## 2. Decisiones cerradas (checkpoint humano, Lautaro, 2026-09-17)

| # | Tema | Decisión |
|---|---|---|
| D1 | BaaS | **Supabase** (Postgres, Auth, Storage, Realtime). Antes de cargar el primer DNI real hay que documentar el plan contratado, los backups/PITR y su costo. |
| D2 | Hallazgos críticos | Se corrigen los 6: aceptación atómica, piso validado en la base, máquina de estados en el servidor, chequeo de aprobación en cada oferta, y DNI/selfie en un bucket privado solo accesible por admin. |
| D3 | Datos del destinatario | Revelación progresiva: antes de aceptar se muestran solo barrio, distancia aproximada (calculada en el servidor) y tipo de paquete. Dirección exacta, nombre y teléfono los ve únicamente el repartidor elegido. |
| D4 | Solicitantes | **Solo comercios y emprendedores** en el MVP. Los particulares quedan para otra fase. |
| D5 | Piloto | **Gratis.** La duración la fijan ustedes en los términos del piloto (por ejemplo, 2 días) y lo cierran cuando vean que funciona. |
| D6 | Cobro del abono | Después del piloto, los comercios que se adhieran pagan en forma directa y el admin activa la suscripción a mano. Mercado Pago Suscripciones queda para el futuro. **No habrá facturación** (decisión humana; ver disenso X3). |
| D7 | Cercanía | **Lista única por ciudad**: todos los repartidores disponibles ven todas las solicitudes abiertas de Aguilares, sin ranking por cercanía ni GPS. |
| D8 | DNI y selfie | Se guardan **mientras el repartidor esté activo** y se borran **30 días después de la baja** (o del rechazo). **Quedan fuera del backup.** |
| D9 | Licencia y seguro | **Opcionales.** Quien sube más documentación verificada gana prioridad y visibilidad. |
| D10 | Pruebas | **E2E de todos los flujos** antes de pasar a producción. |
| D11 | Ambientes | local → `develop` → `staging` → `main` (producción) en GitHub. |
| D12 | Construcción | 3 personas con agy, cada una con su cuenta. Lautaro073 lidera, programa datos, servidor y arranque, y aprueba los PR de las otras dos, que operan agy en las zonas de pantallas y de admin, PWA y calidad. El plan de implementación para IA es parte del entregable. |
| D13 | Zona | Solo Aguilares, Tucumán, Argentina. |
| D14 | Pago del envío | **Lo paga siempre quien recibe** (el cliente del comercio). El comercio cobra su producto por su cuenta y le avisa al cliente cuánto sale el envío según la oferta aceptada. El repartidor cobra el envío al entregar. cadeApp no interviene en ese pago. (Lautaro, 2026-09-17, posterior al checkpoint). |
| D15 | Mapa, geolocalización y distancia | **Pins en mapa de Aguilares y distancia calculada en servidor** (Lautaro073, 2026-09-18). El comercio marca el pin del local al registrarse (editable) y el pin de entrega al crear la solicitud para resolver la falta de numeración catastral. **Privacidad estricta (D3 preservado):** antes de ofertar, el repartidor ve únicamente barrios y distancia aproximada calculada en el servidor (redondeada a 0,5 km); no recibe mapa ni coordenadas. Al aceptar la oferta (`matched`), ve el mapa con ambos puntos exactos, recorrido y botón "Abrir en Google Maps". D7 sigue 100% vigente (sin tracking en vivo ni GPS del repartidor). Proveedor: Google Maps Platform con `@vis.gl/react-google-maps` mediante import dinámico (cupo gratuito 10.000 cargas/mes en piloto = $0). Cálculo server-side con fórmula esférica Haversine × 1.30 en Postgres; centroides de `zones` como respaldo. El mapa nunca es la única vía: la dirección en texto y referencia siguen existiendo y la app funciona si el mapa no carga. |
| D16 | Sistema de diseño, tokens shadcn/ui y estrategia de logos | **Diseño finalizado, auditado y vinculado a shadcn/ui** (Lautaro073, 2026-09-18). Basado en las 36 vistas generadas en Stitch y auditadas por El Consejo. Se implementa en `src/ui/` con Tailwind CSS y variables HSL en `src/ui/tokens.css` (`--primary: #09BABD`, `--primary-foreground: #12182C` con ratio 6.93:1 WCAG AAA, `--background: #FDFCFB`, `--card: #FFFFFF`, `--border: #E4E7EC`, `--muted-foreground: #5B6475`, radio 10px). **Cláusula Anti-12px:** piso mínimo absoluto de 14px (`text-sm`) en móvil. **TopBar Marino:** unificado en 56px `#12182C` para toda la app móvil. **Logos de `assets/`:** insumos maestros en alta resolución; para producción se migran a `public/brand/` con vectores puros (< 5 KB) o WebP (< 15 KB) mediante el componente `<BrandLogo />` (`2.svg` para TopBar marino, `3.svg` para Admin blanco, `4.svg` para Hero/Splash, `1.svg` para tickets térmicos POS; PNGs rasterizados obligatorios para el manifest PWA). **Purga de 7 datos fantasma de Stitch:** sin estrellas/calificaciones (S4), sin precios sugeridos, sin CUIT en comercios, sin solapa "Liquidaciones" en Admin (D14), sin facturación ARBA/AFIP (D6), sin ciudades ajenas (D13). **Ajustes operativos:** mapa de entrega en C03 opcional (con centroide como fallback en hora pico) y selector rápido de billete al pedir cambio en efectivo ("Paga con: $ 2.000 / $ 5.000 / $ 10.000"). Las 6 carpetas de exportación cuentan con sus guías `README.md` vinculantes. |

Restricciones técnicas originales que siguen vigentes: Next.js con TypeScript strict, backend dentro del mismo Next.js, PWA y el nombre cadeApp. El diseño visual y los tokens están fijados y documentados en `docs/design/stitch/` y D16.

## 3. Actores y roles

| Actor | Rol técnico | Qué hace |
|---|---|---|
| Comercio o emprendedor | `merchant` | Publica solicitudes, ve ofertas, acepta, coordina, cancela y reporta incidentes. |
| Repartidor independiente | `courier` | Se registra, carga documentación, espera aprobación, se marca disponible, oferta, retira ofertas y ejecuta el envío. |
| Administrador | `admin` | Aprueba, rechaza y suspende repartidores; gestiona piloto, suscripciones y parámetros; atiende incidentes. Usa MFA obligatorio. |
| Destinatario | (no es usuario) | Figura con nombre y teléfono, visibles solo para el comercio dueño, el repartidor elegido y el admin. |

## 4. Alcance del MVP

**Entra:**
1. Registro e inicio de sesión de comercios (datos del negocio, dirección de retiro habitual y punto fijado en el mapa de Aguilares, editable).
2. Registro de repartidores con onboarding:
   - DNI (frente y dorso), selfie, foto de perfil y datos del vehículo;
   - licencia y seguro opcionales;
   - consentimientos.
3. Panel admin:
   - postulantes, visor de documentos auditado, aprobar, rechazar y suspender;
   - comercios, estado de piloto o suscripción;
   - parámetros de la plataforma, incidentes y bitácora de auditoría.
4. Crear solicitud: barrio y dirección de retiro (con pin precargado del comercio, editable), barrio y dirección de entrega con punto marcado en el mapa de Aguilares, cálculo server-side de distancia redondeada a 0,5 km, destinatario, tipo de paquete, indicaciones y **medio de pago del destinatario** (§6.6).
5. Lista única de solicitudes abiertas para repartidores disponibles (con barrios y distancia aproximada, sin mapa ni coordenadas; D3 y D15).
6. Ofertar, retirar la oferta mientras no haya sido aceptada y ver el estado de las ofertas propias.
7. Ver ofertas en tiempo real y aceptar una con una operación atómica.
8. Vista de viaje: coordinación, revelación progresiva, mapa interactivo con ambos puntos exactos y recorrido orientativo para el repartidor aceptado y el comercio, botón "Abrir en Google Maps" con enlace de navegación universal, botón de WhatsApp con mensaje prearmado, estados (retirado, entregado), cancelación, "el repartidor no llegó" y republicar.
9. Expiración automática de solicitudes sin aceptar.
10. Reporte de incidentes desde un viaje activo.
11. PWA instalable con onboarding de instalación en iOS, notificaciones push best-effort y respaldo en tiempo real con refresco al volver a la app.
12. Insignias de documentación verificada y prioridad por documentación (D9).
13. Estrategia de pruebas completa y tres ambientes con CI/CD.

**Queda fuera (fase posterior):** particulares, cobro integrado (Mercado Pago), facturación, ranking por cercanía y tracking en vivo del repartidor (D7 vigente), calificaciones (supuesto S4), link público de seguimiento para el destinatario (supuesto S5), app nativa y otras ciudades.

## 5. Máquina de estados (fuente de verdad en el servidor)

### 5.1 Solicitud (`delivery_requests.status`)

```
draft ──publish──▶ published ──accept_offer──▶ matched ──picked_up──▶ in_transit ──delivered──▶ delivered
                     │   ▲                      │  │
                     │   └──────republish───────┘  │ (repartidor cancela / "no llegó")
                     │                             │
              cancel │ expire                      │ cancel (comercio, con motivo)
                     ▼   ▼                         ▼
                 cancelled expired             cancelled
```

| Transición | Actor | Precondiciones (validadas en la RPC) |
|---|---|---|
| `draft → published` | merchant dueño | Comercio en piloto o con suscripción activa (`paid_until >= hoy`). Campos obligatorios completos. `expires_at = now() + request_ttl_minutes`. |
| `published → matched` | merchant dueño | Ver §6.1. |
| `published → cancelled` | merchant dueño | Sin penalidad. Las ofertas `pending` pasan a `expired`. |
| `published → expired` | sistema | `now() > expires_at`. La expiración es **perezosa**: toda lectura y toda RPC trata como expirada una solicitud vencida, y un barrido periódico la persiste y avisa. Así la corrección no depende del cron. |
| `matched → in_transit` | courier asignado | Marca "retirado". |
| `matched → published` (republicar) | merchant ("no llegó", con motivo `no_show`) o courier (cancela, con motivo) | Se registra el motivo y se cuenta para el admin. La oferta aceptada pasa a `cancelled`. Hay un nuevo `expires_at`. |
| `matched → cancelled` | merchant dueño | Motivo obligatorio. Se notifica al repartidor. |
| `in_transit → delivered` | courier asignado | Durante 24 h el comercio puede reportar un incidente. |
| `in_transit → cancelled` | admin | Solo por incidente. |

### 5.2 Oferta (`offers.status`)

`pending → accepted | rejected | withdrawn | expired | cancelled`

- `withdrawn`: el repartidor la retira mientras está `pending`.
- `rejected`: se aceptó otra oferta de la misma solicitud.
- `expired`: la solicitud expiró o se canceló estando `published`.
- `cancelled`: la oferta aceptada se cayó (republicación o cancelación).
- Solo puede haber **una oferta activa** (`pending` o `accepted`) por repartidor y solicitud, y **una sola `accepted`** por solicitud (índice único parcial).

## 6. Reglas críticas

### 6.1 Aceptación atómica
Aceptar es la RPC `accept_offer(offer_id)`. Corre en una transacción que:
1. bloquea la fila de la solicitud (`SELECT … FOR UPDATE`);
2. verifica `status = 'published'`, que no esté vencida, que la oferta esté `pending` y que el repartidor siga `approved`;
3. marca la oferta `accepted` y el resto `rejected`;
4. deja la solicitud `matched` con `accepted_offer_id`.

Si la misma oferta ya estaba aceptada, devuelve éxito (idempotente). Cualquier otro intento devuelve `ALREADY_MATCHED`. El índice único parcial `offers(request_id) WHERE status='accepted'` es la segunda barrera.

### 6.2 Piso de oferta
- Los montos son **enteros en ARS**, sin decimales.
- El piso vive en `platform_settings.min_offer_ars` (valor inicial 1000) y se puede cambiar sin tocar código.
- `submit_offer` rechaza montos menores con `OFFER_BELOW_MINIMUM`.
- Un `CHECK (amount_ars >= 1)` protege la columna.
- El cliente solo muestra el piso; nunca es quien lo valida.

### 6.3 Autorización al ofertar
`submit_offer` verifica, **en cada llamada**, que el repartidor esté `approved`, no esté `suspended` y esté `available`. Una suspensión hecha por el admin tiene efecto inmediato:
- sus ofertas `pending` pasan a `withdrawn`;
- no puede ser aceptado, porque `accept_offer` vuelve a verificar su estado.

### 6.4 Prioridad por documentación (D9)
- `doc_level` = cantidad de documentos opcionales verificados por el admin (licencia, seguro). Va de 0 a 2.
- Las insignias ("Licencia verificada", "Seguro verificado") aparecen **solo** cuando el admin revisó el comprobante. Nunca se muestra "verificado" por una declaración.
- En la vista de ofertas del comercio, el orden por defecto es `doc_level` descendente y después la hora de la oferta. El comercio puede ordenar por precio y elige libremente.
- Lo que declara el repartidor sin comprobante (vehículo, tenencia de licencia) se muestra como "declarado".

### 6.5 Revelación progresiva (D3 y D15)
- Los datos sensibles están en una tabla aparte con RLS estricta, `delivery_request_contacts`: dirección exacta de entrega, nombre y teléfono del destinatario, y coordenadas exactas de retiro (`pickup_lat`, `pickup_lng`) y entrega (`dropoff_lat`, `dropoff_lng`). Su RLS solo deja leer al comercio dueño, al repartidor de la oferta `accepted` y al admin.
- El feed de solicitudes abiertas del repartidor muestra barrio de retiro, barrio de entrega, distancia aproximada (ej: "≈ 2,0 km"), tipo de paquete y medio de pago del destinatario. No incluye mapa ni coordenadas.
- La distancia se calcula en el servidor mediante la RPC `calculate_route_distance(p1, p2)` usando la fórmula esférica de Haversine entre los puntos exactos, multiplicada por el factor de trama urbana de Aguilares (1.30) y redondeada a múltiplos de 0,5 km (500 m). Si la solicitud se creó sin coordenadas (por fallback o mapa no disponible), se calcula entre los centroides de la tabla `zones`.
- La dirección exacta de retiro y su pin en el mapa también se revelan al repartidor recién al ser aceptado (`matched`), protegiendo a emprendedores que operan desde su domicilio particular. Al aceptar, el repartidor ve el mapa interactivo con ambos puntos, la ruta orientativa y el botón "Abrir en Google Maps".

### 6.6 Pago del envío (D14)
- **Siempre lo paga el destinatario**, al recibir. No hay un campo "quién paga": es una regla de la plataforma y va escrita en los términos.
- Al crear la solicitud, el comercio indica el **medio de pago del destinatario**: efectivo (y si necesita cambio), transferencia o "a coordinar". Es obligatorio porque evita discusiones en la puerta (Persona, UX/UI). Se le muestra al repartidor antes de ofertar.
- Al aceptar una oferta, el comercio tiene un botón **"Avisar a mi cliente"** que arma un mensaje de WhatsApp con el costo del envío, el nombre del repartidor y el medio de pago, listo para reenviar.
- cadeApp no procesa, no registra ni garantiza ese pago.

## 7. Modelo de datos (Supabase / Postgres)

| Tabla | Campos clave | Notas |
|---|---|---|
| `profiles` | `id = auth.users.id`, `role` (merchant/courier/admin), `display_name`, `phone`, `created_at` | Se crea con un trigger al registrarse. `role` solo lo cambia el admin. |
| `merchants` | `profile_id`, `business_name`, `default_pickup_zone_id`, `default_pickup_address`, `default_pickup_lat`, `default_pickup_lng`, `subscription_status` (pilot/active/expired/cancelled), `paid_until`, `notes` | Puede publicar si `pilot_active` o si `paid_until >= hoy`. Coordenadas validadas en el bounding box de Aguilares. |
| `couriers` | `profile_id`, `status` (pending/approved/rejected/suspended), `vehicle_type` (walk/bike/moto/car), `vehicle_plate`, `license_status`, `insurance_status` (none/submitted/verified/rejected), `doc_level` (generado), `available`, `dni_hmac` (único), `decided_at`, `decided_by`, `deactivated_at` | `dni_hmac` = HMAC-SHA256 del número de DNI con un secreto de servidor. Sirve para detectar reingresos de rechazados o suspendidos. |
| `courier_documents` | `id`, `courier_id`, `kind` (dni_front/dni_back/selfie/avatar/license/insurance), `storage_path`, `status`, `uploaded_at`, `purge_after`, `purged_at` | `purge_after` = baja o rechazo + 30 días. |
| `zones` | `id`, `name`, `centroid_lat`, `centroid_lng`, `active` | Barrios de Aguilares. Centroides sirven de respaldo si no hay coordenadas. |
| `delivery_requests` | `id`, `merchant_id`, `status`, `pickup_zone_id`, `dropoff_zone_id`, `package_type`, `notes`, `recipient_payment_method` (cash/transfer/to_agree), `needs_change`, `approx_distance_m`, `route_distance_m`, `expires_at`, `accepted_offer_id`, `cancel_reason`, timestamps | No contiene coordenadas exactas ni datos sensibles. `route_distance_m` es la distancia redondeada calculada en el servidor. |
| `delivery_request_contacts` | `request_id`, `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_address`, `dropoff_lat`, `dropoff_lng`, `recipient_name`, `recipient_phone`, `recipient_consent_declared` | RLS estricta (§6.5, D15). Coordenadas validadas dentro del bounding box de Aguilares. |
| `offers` | `id`, `request_id`, `courier_id`, `amount_ars int`, `eta_minutes`, `message`, `status`, timestamps | Índices únicos parciales (§5.2, §6.1). |
| `incidents` | `id`, `request_id`, `reporter_id`, `kind`, `description`, `status`, `resolution`, timestamps | |
| `push_subscriptions` | `id`, `user_id`, `endpoint` (único), `p256dh`, `auth`, `platform`, `created_at`, `last_seen_at` | Fallo del Juez §1. |
| `consents` | `profile_id`, `document` (tos/privacy/courier_contract/pilot_terms), `version`, `accepted_at` | |
| `audit_log` | `id`, `actor_id`, `action`, `target_type`, `target_id`, `before`, `after`, `created_at` | Aprobaciones, suspensiones, accesos a documentos, cambios de suscripción y parámetros. Solo inserción. |
| `platform_settings` | `key`, `value` | `min_offer_ars=1000`, `request_ttl_minutes=30`, `pilot_active=true`, `pilot_terms_version`, `subscription_grace_days=0`. |
| `rate_limits` | `subject`, `action`, `window_start`, `count` | Contadores para limitar abuso. |

**Operaciones críticas: solo por RPC** (`security definer` con chequeo explícito de `auth.uid()` y rol): `publish_request`, `cancel_request`, `submit_offer`, `withdraw_offer`, `accept_offer`, `mark_picked_up`, `mark_delivered`, `report_no_show`, `courier_cancel_match`, `republish_request`, `report_incident`, `set_availability`, `calculate_route_distance`, `admin_decide_courier`, `admin_suspend_courier`, `admin_verify_document`, `admin_set_subscription`, `admin_update_setting`. La RLS **niega** `insert`/`update` directos sobre `status`, `offers`, `couriers.status` y `merchants.subscription_*`. Los puntos fuera de Aguilares (lat: -27.4550 a -27.4100, lng: -65.6400 a -65.5950) son rechazados por validación en Postgres.

## 8. Arquitectura

- **Next.js** (App Router) con TypeScript `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`. El backend está en el mismo proyecto:
  - Server Actions para las mutaciones de UI;
  - Route Handlers para cron, push y endpoints técnicos.
- **Supabase:** Postgres (reglas atómicas en RPC), Auth (email con OTP o contraseña, MFA TOTP para admin), Storage (buckets privados) y Realtime (nuevas solicitudes para repartidores y nuevas ofertas para el comercio). Se usa `@supabase/ssr` para las sesiones en el servidor.
- **Validación:** Zod en todas las fronteras (formularios, acciones, handlers). Tipos generados con `supabase gen types`.
- **Dominio puro** (`src/domain`): máquinas de estado, códigos de error y reglas, sin IO y con tests unitarios.
- **Tiempo real con respaldo:** suscripción Realtime mientras la app está en primer plano y refetch en `focus`, `visibilitychange` y reconexión, más polling liviano (30 s) en las pantallas activas. El push nunca es la fuente de verdad.
- **Notificaciones push** (fallo del Juez):
  - tabla `push_subscriptions` con emisor server-side en un Route Handler de Next.js (runtime Node) usando Web Push estándar con VAPID, detrás de una interfaz `sendNotification(userIds, event)`;
  - se envían después del commit; si el envío falla, no se revierte la transición;
  - las suscripciones rechazadas (404/410) se borran;
  - el payload lleva solo el tipo de evento y el id, nunca datos personales;
  - eventos: solicitud publicada (a repartidores disponibles), nueva oferta (al comercio), oferta aceptada o rechazada, cancelación, "no llegó" y expiración.
- **Tareas programadas:** un Route Handler `/api/cron/sweep`, protegido con `CRON_SECRET` e invocado por el cron del hosting, se encarga de:
  - persistir expiraciones y avisar;
  - purgar documentos con `purge_after` vencido (borra el objeto de Storage, marca `purged_at` y registra en auditoría);
  - marcar suscripciones vencidas.
  La frecuencia depende del plan de hosting (S2); gracias a la expiración perezosa, la corrección no depende de ella.
- **PWA:**
  - manifest, íconos (192/512 maskable) y `theme_color`;
  - service worker con shell offline y caché de lectura; no hay escrituras offline, salvo el reintento de carga de documentos;
  - onboarding de instalación en iOS (Safari, "Agregar a inicio"), requisito para recibir push en iOS;
  - el pedido de permiso de notificaciones parte de un gesto del usuario.
- **Imágenes:** compresión en el cliente antes de subir (lado mayor ≤ 1600 px, JPEG ≈ 0,8), subida con barra de progreso y reintento, y validación de tipo y tamaño en el servidor.
- **Accesibilidad base:** WCAG 2.2 AA (contraste ≥ 4,5:1), objetivos táctiles ≥ 48×48 px, `inputmode="numeric"` para montos, confirmación en dos pasos para acciones irreversibles y foco y etiquetas correctos. El diseño visual se define después, pero sobre esta base y con tokens semánticos.
- **WhatsApp:** después de aceptar hay dos mensajes prearmados con `wa.me`:
  - comercio ↔ repartidor: código del envío, barrios, monto acordado y medio de pago del destinatario;
  - "Avisar a mi cliente" (comercio → destinatario): costo del envío, nombre del repartidor y medio de pago.

## 9. Seguridad y privacidad

1. **RLS por tabla y rol:** matriz explícita en `supabase/tests` con pruebas pgTAP. Resumen:
   - el comercio ve solo sus solicitudes, sus contactos y las ofertas que recibió;
   - el repartidor ve solicitudes `published` no vencidas (sin contactos), sus ofertas y los contactos del viaje donde es el aceptado;
   - el admin ve todo, y el acceso a documentos queda auditado.
2. **La service role key nunca llega al cliente.** Solo se usa en `src/server/admin-client.ts`, para cron, purga y acciones de admin que lo requieran.
3. **Admin:** MFA TOTP obligatorio (sin factor verificado, las RPC `admin_*` rechazan), rol asignado solo por SQL o migración y bitácora `audit_log` de solo inserción.
4. **Documentos:**
   - bucket privado `courier-docs` con ruta `courier/{uid}/{kind}/{uuid}.jpg`;
   - el repartidor puede subir sus propios archivos pero no leerlos después;
   - el admin los ve mediante URL firmada de 60 s generada en el servidor, y cada generación queda en `audit_log`;
   - se retienen mientras el repartidor esté activo y se purgan 30 días después de la baja o el rechazo;
   - el bucket **no entra en ningún backup propio** (D8). Verificar que el backup de base de Supabase no copie los objetos de Storage (S3).
5. **Foto de perfil separada:** el comercio ve el `avatar` y el nombre del repartidor asignado (el admin verifica que coincida con la selfie). La selfie de verificación nunca se muestra fuera del panel admin.
6. **Antiabuso:**
   - límites por usuario: solicitudes por hora, ofertas por minuto, retiros de oferta por hora;
   - límites de Supabase Auth para registros;
   - `dni_hmac` único para bloquear reingresos;
   - el feed se entrega sin contactos.
7. **Datos del destinatario:** al crear la solicitud, el comercio declara que tiene autorización del destinatario. Se le prohíbe al repartidor usarlos fuera del envío.
8. **Seguridad física:**
   - antes del encuentro se muestran foto de perfil, nombre, vehículo y patente del repartidor;
   - botón "Reportar incidente" en el viaje activo;
   - procedimiento del admin: suspensión cautelar, contacto con las partes y registro.
9. **Secretos:** por ambiente, en GitHub Environments y en el hosting. Nunca en el repositorio.
10. **Seguridad y privacidad de coordenadas (D15):**
    - Las coordenadas exactas de retiro y entrega viven únicamente en `delivery_request_contacts` bajo RLS estricta. Nunca se transmiten en el feed público de solicitudes abiertas ni en `delivery_requests`.
    - Prohibición absoluta de registrar coordenadas o parámetros de geolocalización en logs estructurados (Sentry), payloads de notificaciones push, webhooks o URLs de analítica.
    - Los enlaces de navegación de Google Maps (`https://www.google.com/maps/dir/?api=1&origin=...&destination=...`) se construyen exclusivamente en el cliente del repartidor asignado una vez que la solicitud alcanza el estado `matched` o `in_transit`.
    - Las API Keys públicas de Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) se configuran obligatoriamente con restricción por HTTP Referrer (`*.cadeapp.com`, `localhost:*`) y restricción de API limitándola a Maps JavaScript API en Google Cloud Console.

## 10. Marco legal (condicionado a verificación profesional)

Legal (sin acceso a fuentes durante la revisión) dejó estos puntos. **Antes de abrir producción a usuarios reales, un abogado de Tucumán tiene que revisarlos.**

1. **Términos y Condiciones:**
   - cadeApp es intermediario tecnológico y no custodia ni la carga ni el dinero;
   - lista de mercaderías prohibidas (armas, estupefacientes, dinero, sustancias peligrosas, etc.);
   - protocolo ante siniestros o ilícitos;
   - reglas del piloto y baja del servicio.
2. **Contrato marco de prestador independiente:** libertad de horario, derecho a rechazar sin penalidad y a trabajar en otras plataformas, y aclaración de que el piso de ARS 1.000 es una referencia de la plataforma. Mitiga la presunción laboral (Ley 20.744, art. 23), que Legal marcó como riesgo por la admisión manual, el precio mínimo y la prioridad por documentación.
3. **Política de privacidad** (Ley 25.326):
   - consentimiento explícito antes de subir documentos;
   - finalidad y plazo de retención (D8);
   - derechos de acceso, rectificación y supresión;
   - evaluar la inscripción de la base ante la AAIP.
4. **Destinatarios:** declaración de autorización por parte del comercio y minimización de datos (§6.5).
5. **Licencia y seguro:** opcionales por decisión humana (D9). Legal mantiene el disenso X2.
6. **Defensa del Consumidor (Ley 24.240):** cuando haya cobro, tiene que haber un botón de baja y términos de adhesión claros.

## 11. Monetización

- **Piloto (D5):** `platform_settings.pilot_active = true`. Todos los comercios con `subscription_status = pilot` publican gratis. La duración y las condiciones se publican en los términos del piloto (`pilot_terms_version`) y el admin lo cierra desde el panel.
- **Después del piloto (D6):** el comercio que se adhiere paga en forma directa. El admin registra el pago y fija `paid_until`. Con `paid_until < hoy` (gracia `subscription_grace_days`, 0 por defecto, S6) el comercio no puede publicar solicitudes nuevas, pero las que están en curso siguen.
- **Precio del abono:** sin definir. Es un parámetro que se decide antes del primer cobro (S7).
- **Futuro:** integrar Mercado Pago Suscripciones con webhook firmado e idempotente. Legal y Finanzas lo condicionan a términos de adhesión, botón de baja y encuadre fiscal.
- **Costos de operación** (Finanzas; son supuestos, no datos verificados):
  - Supabase y hosting se facturan en USD con tarjeta argentina, con impuestos y percepciones;
  - el plan gratuito de Supabase puede no alcanzar para tres ambientes ni para PITR;
  - hay que estimar antes de la primera carga real (tarea T-007).
  - **Google Maps Platform (D15):** Desde marzo de 2025 rige el modelo por SKU mensual con 10.000 cargas gratuitas al mes de Dynamic Maps (Essentials). Para el piloto de Aguilares (~20 comercios, ~30 envíos/día = ~1.820 cargas/mes), el consumo representa ~18% del cupo gratuito, garantizando **costo $0 USD/mes**. Se exige fijar un Quota Cap estricto de 300 cargas diarias / 9.000 mensuales en Google Cloud y una alerta de presupuesto a $1 USD para blindar el costo en cero.
- **Piso configurable:** `min_offer_ars` se ajusta por inflación sin deploy.

## 12. Ambientes, entrega y operación

| Ambiente | Rama | Base | Deploy | Uso |
|---|---|---|---|---|
| local | `feat/*` | Proyecto Supabase `cadeapp-staging` (Free Tier) | `next dev` | Desarrollo con agy. |
| develop | `develop` | Proyecto Supabase `cadeapp-staging` (Free Tier) | Preview/dev en el hosting | Integración diaria y pruebas de PR. |
| staging | `staging` | Proyecto Supabase `cadeapp-staging` (Free Tier) | Ambiente staging | Suite E2E completa y prueba de restauración. |
| producción | `main` | Proyecto Supabase `cadeapp-prod` (Free Tier) | Producción | Usuarios reales en Aguilares. |

> **Nota de infraestructura:** Supabase limita a 2 proyectos activos gratuitos por cuenta (S3 confirmado). Se aprovechan para `staging`/`develop` (comparten `cadeapp-staging`) y `producción` (`cadeapp-prod`). Se prescinde de Supabase CLI local (Docker) para que el equipo y los operadores de agy no dependan de Docker Desktop en sus máquinas, garantizando costo $0.

- **Flujo:** `feat/T-xxx-*` → PR a `develop` → PR de release `develop → staging` → PR `staging → main`, solo con la suite E2E verde en staging.
- **Protección de ramas** en `develop`, `staging` y `main`:
  - PR obligatorio y aprobación de otra persona del equipo;
  - checks obligatorios; sin push directo ni force push.
- **CI** (GitHub Actions) en cada PR:
  - `typecheck`, `lint` (incluye reglas de límites entre módulos), unitarias y pruebas de base (pgTAP y RPC contra Supabase local);
  - `build` y generación de tipos sin diff.
- **Migraciones:**
  - versionadas en `supabase/migrations`;
  - se aplican automáticamente al ambiente de la rama cuando se mergea;
  - una migración ya mergeada nunca se edita (se corrige con otra).
- **Rollback:**
  - app: volver al deploy anterior del hosting;
  - base: migración correctiva hacia adelante;
  - cada release a producción lleva una nota de rollback.
- **Backups:**
  - backups diarios de la base de producción y PITR si el plan lo habilita (D1);
  - el bucket de documentos queda excluido (D8);
  - antes de aprobar al primer repartidor real se hace **un simulacro de restauración** en staging.
- **Observabilidad:**
  - captura de errores (Sentry o equivalente) en cliente y servidor, sin datos personales;
  - chequeo de disponibilidad de `/api/health`;
  - alerta al admin por email si fallan la publicación, las ofertas, la aceptación o el cron.
- **Cuentas de servicio:** GitHub, hosting y Supabase con 2FA en todas.
- **Producción** (checkpoint revision-2): solo Lautaro073 administra los secretos de producción, aprueba el environment `production` y el PR `staging → main`. Ninguna laptop tiene credenciales de staging ni de producción. El detalle operativo está en `implementation-plan.md` §2, §3 y §6.

## 13. Estrategia de pruebas (D10)

1. **Unitarias** (Vitest): máquinas de estado, validaciones Zod, reglas de piso y prioridad, armado del link de WhatsApp, compresión de imágenes, fórmula esférica de Haversine con factor 1.30 y redondeo a 0,5 km, y validación de bounding box de Aguilares (-27.4550 a -27.4100 lat, -65.6400 a -65.5950 lng).
2. **Base de datos** (pgTAP y tests de RPC contra Supabase local):
   - matriz RLS por rol;
   - verificación de que un repartidor no aceptado recibe NULL o error al intentar leer coordenadas de `delivery_request_contacts`;
   - `accept_offer` con N llamadas concurrentes (exactamente una gana);
   - `submit_offer` con 999, 1000 y 1001 y con piso modificado;
   - repartidor pending, rejected o suspended;
   - expiración perezosa, transiciones inválidas por actor y estado, y purga de documentos;
   - suscripción vencida bloquea `publish_request`;
   - RPC `calculate_route_distance` con factor 1.30, redondeo a múltiplos de 500 m y fallback a centroides si lat/lng son nulos.
3. **E2E** (Playwright en staging, **todos los flujos**; ver §16 e `implementation-plan.md`):
   - registro de comercio con pin en mapa de Aguilares y fallback a texto;
   - onboarding de repartidor y aprobación del admin con MFA;
   - publicar con pin de entrega en mapa de Aguilares, ofertar viendo solo distancia redondeada (sin mapa ni coordenadas), retirar, aceptar y aceptación concurrente en dos pestañas;
   - revelación progresiva: tras la aceptación, el repartidor ve el mapa con recorrido y botón "Abrir en Google Maps";
   - retirado y entregado;
   - cancelaciones por actor y estado; "no llegó" y republicar; expiración;
   - suspensión con ofertas activas;
   - piloto encendido y apagado, suscripción vencida;
   - incidente;
   - push concedido y denegado, respaldo en tiempo real, reconexión offline y degradación si el mapa no carga;
   - carga de documentos con red lenta;
   - chequeos de accesibilidad con axe.
   > **Nota de pruebas de mapa:** Las pruebas de Playwright en CI mockean las respuestas de Google Maps Platform (sin consumo de cuota ni dependencia de red externa).
4. **Gate:** no se mergea a `main` sin la suite E2E completa verde en staging (incluido el registro de comercio, T-313, y mapas, T-314) y sin la aprobación de Lautaro073.

## 14. Lanzamiento en Aguilares

1. **Siembra de repartidores primero:** reclutar en persona entre 10 y 15 repartidores, aprobarlos y hacer una prueba corta con ellos.
2. **Comercios ancla:** entre 5 y 8 comercios de alta rotación, concentrados en almuerzo y cena.
3. **Piloto:** gratis, con la duración que fijen en los términos (D5). Medir antes de cerrarlo.
4. **Canales de bajo costo:** adhesivos "Enviamos con cadeApp" y el mensaje de WhatsApp con marca.
5. **Métricas del piloto:**
   - % de solicitudes con al menos una oferta a los 10 minutos y tiempo a la primera oferta;
   - % aceptadas, % entregadas, cancelaciones y "no llegó";
   - repartidores disponibles por franja;
   - comercios que se adhieren al terminar el piloto.

## 15. Riesgos abiertos y disensos preservados

| # | Disenso o riesgo | Quién lo sostiene | Estado |
|---|---|---|---|
| X1 | Un piloto corto (por ejemplo, 2 días) puede no alcanzar para medir liquidez de dos lados. Marketing proponía 10 envíos bonificados o 14 días para comercios ancla. | marketing | Decisión humana D5 vigente. Revisar con las métricas del §14. |
| X2 | Licencia y seguro de responsabilidad civil deberían ser obligatorios para vehículos a motor (Ley 24.449, art. 68). Si son opcionales, la plataforma queda más expuesta ante un siniestro con terceros. | legal | Decisión humana D9 vigente. La prioridad por documentación mitiga parcialmente. |
| X3 | Operar y cobrar el abono sin inscripción fiscal ni facturación expone a sanciones (ARCA y Rentas de Tucumán). Los cobros por transferencia o Mercado Pago dejan rastro. Además complica la futura integración con Mercado Pago y los reclamos de consumidores. | finance, legal | Decisión humana D6 vigente. Es un riesgo abierto que conviene revisar antes del primer cobro. |
| X4 | Retener DNI y selfie mientras el repartidor esté activo supera la retención mínima que proponía Seguridad (borrar a N días de la aprobación). | security | Decisión humana D8 vigente, mitigada con bucket privado, auditoría, purga y exclusión del backup. |
| X5 | La admisión manual, el precio mínimo y la prioridad por documentación son indicios que un juez laboral podría leer como subordinación. | legal | Mitigar con el contrato de prestador independiente (§10.2). |
| X6 | Backend no confirmó explícitamente que es dueño del desglose de push; mover el emisor a Edge Functions requiere confirmación humana. | judge | El emisor se queda en un Route Handler de Next.js. |
| X7 | Las citas legales y fiscales no se verificaron contra textos vigentes. | legal, finance | Condición para salir a producción. |
| X8 | Finanzas no argumentó en la réplica (0 entradas). | — | Declarado en la evidencia. |

## 16. Matriz requisito → tarea → prueba

Las tareas están en [`implementation-plan.md`](implementation-plan.md).

| Requisito | Tarea | Prueba |
|---|---|---|
| El plan corregido permite construir y lanzar el MVP de cadeApp en Aguilares con el flujo solicitud → ofertas (mínimo ARS 1.000) → elección → coordinación directa, con repartidores aprobados manualmente, suscripción para comercios, sin custodiar el dinero del envío y con la elección de BaaS justificada. | Fases 0 a 3 completas (T-000 a T-314) y release a `main` | La suite E2E completa pasa en staging (T-301 a T-309, T-313 y T-314) y el checklist de release (T-312) queda aprobado por Lautaro073. |
| Una sola oferta aceptada por solicitud | T-102 `accept_offer` | Test de concurrencia de base (N llamadas, 1 ganadora) y E2E con aceptación en dos pestañas (T-303). |
| Piso ARS 1.000 validado en el servidor y configurable | T-101 `submit_offer`, T-123 parámetros | Tests de base con 999, 1000 y 1001 y con piso cambiado; E2E de oferta bajo el piso rechazada. |
| Solo repartidores aprobados y no suspendidos ofertan o son aceptados | T-101, T-102, T-122 | Tests de base pending/rejected/suspended; E2E de suspensión con ofertas activas (T-305). |
| Máquina de estados server-side con expiración | T-006, T-103, T-104 | Unitarias de transiciones; tests de base de transiciones inválidas y expiración perezosa; E2E de expiración y cancelaciones (T-304). |
| Revelación progresiva del destinatario | T-004, T-005, T-115 | Matriz RLS pgTAP (el repartidor no aceptado no lee contactos); E2E de revelación (T-303). |
| Selección de pin en mapa de Aguilares, distancia calculada en servidor y recorrido post-aceptación (D15) | T-106 (migración, RLS y RPC distancia), T-116 (mapa y selector), T-117 (recorrido y botón Google Maps), T-314 (E2E) | pgTAP de RLS de coordenadas (courier no aceptado recibe NULL); unitarias de bounding box de Aguilares y Haversine x 1.30; E2E T-314 con mock de Google Maps validando que en solicitudes abiertas no viajan coordenadas y que tras matched aparece el recorrido y el botón externo; degradación graceful a texto. |
| Aprobación manual con documentos protegidos | T-121, T-122 | Test de base de lectura de bucket denegada; E2E de onboarding y aprobación con MFA (T-302); URL firmada auditada. |
| Retención de DNI/selfie: activo + 30 días, fuera del backup | T-104, T-310 | Test de purga con `purge_after` vencido; verificación documentada de exclusión del backup (ADR). |
| Solo comercios; piloto gratis; suscripción manual | T-111, T-123 | Tests de base de `publish_request` con piloto encendido/apagado y `paid_until` vencido; E2E (T-306). |
| Sin custodiar el dinero del envío; lo paga quien recibe | T-112 (medio de pago), T-115 ("Avisar a mi cliente"), T-311 (TyC) | Revisión de que no exista ningún flujo de pago del envío; E2E: el medio de pago es visible para el repartidor y el mensaje al cliente incluye el monto aceptado. |
| Elección de BaaS justificada | T-007 ADR-0001 | Revisión del ADR: relacional/ACID, RLS, push manual, backup/PITR y costo documentados. |
| Lista única por ciudad con prioridad por documentación | T-114, T-122 | Unitarias del orden por `doc_level`; E2E de feed y orden de ofertas (T-303). |
| Notificaciones best-effort con respaldo | T-201, T-202, T-203, T-204 | Tests del emisor (payload sin datos personales, borrado ante 410); E2E con push denegado y reconexión (T-307). |
| PWA instalable y usable en gama baja | T-201, T-205 | Chequeo de instalabilidad y E2E offline; axe AA; revisión manual en iOS y Android. |
| Ambientes develop/staging/producción con CI/CD | T-002, T-003 | El pipeline bloquea un PR con typecheck roto; develop y staging vinculados a cadeApp-staging en nube sin Docker local. |
| Backups y restauración probados | T-310 | Acta del simulacro de restauración en staging. |
| Seguridad física e incidentes | T-124 | E2E de reporte y suspensión cautelar (T-308). |
| Marco legal mínimo | T-311 | Páginas de TyC, privacidad, contrato y términos del piloto publicadas, con consentimiento versionado; revisión de abogado registrada. |
| Sistema de diseño, tokens shadcn/ui y estrategia de logos (D16) | T-008 (tokens, primitivas y logos), T-111 a T-115, T-121 a T-124 | Revisión de tokens CSS HSL (contraste WCAG AAA 6.93:1 en botón primario); verificación de piso de 14px (Anti-12px); verificación de optimización de logos en public/brand/ (< 5 KB) y PNGs de PWA; ausencia de datos fantasma de Stitch en E2E y tests unitarios. |

## 17. Supuestos del ensamblado (reversibles, a confirmar)

| # | Supuesto |
|---|---|
| S1 | El hosting es Vercel, como recomendó DevOps ("Vercel u otro equivalente"). El plan Hobby no admite uso comercial, así que hay que verificar costo y plan. |
| S2 | La frecuencia del cron depende del plan de hosting. La expiración perezosa garantiza la corrección aunque el cron corra poco. |
| S3 | **Actualizado (Lautaro, 2026-09-21):** Supabase limita a 2 proyectos activos gratuitos por cuenta. Se usan para staging/develop (comparten el proyecto remoto `cadeapp-staging`) y producción (`cadeapp-prod`). Se descarta Supabase CLI local con Docker para simplificar el onboarding de los operadores de agy y CI, manteniendo el costo en $0 sin requerir Docker Desktop. |
| S4 | Las calificaciones quedan fuera del MVP porque ningún rol las exigió. Se reevalúan después del piloto. |
| S5 | El link público de seguimiento para el destinatario (propuesto por Persona) queda fuera del MVP: suma superficie de datos personales. |
| S6 | Gracia de suscripción de 0 días, parametrizable. |
| S7 | El precio del abono se define antes del primer cobro y no afecta la construcción. |
| S8 | **Cerrado con D15 (Lautaro073, 2026-09-18):** La distancia se calcula en el servidor con fórmula Haversine × 1.30 (redondeada a 0,5 km) en Postgres a partir de los puntos fijados en el mapa de Aguilares. Los centroides de `zones` quedan como respaldo si faltan coordenadas o la carga del mapa falla. |
| S9 | TTL de solicitud: 30 minutos por defecto (PM). UX sugería 15. Es un parámetro. |
| S10 | Las rutas de reglas, skills y hooks de agy (`AGENTS.md`, `.agents/rules`, `.agents/skills`, `.agents/hooks.json`) se tomaron de la documentación integrada de la CLI instalada (agy 1.2.4). Verificar si cambian con una actualización. |

## 18. Cambios respecto del plan original

1. Se cerraron las 10 preguntas abiertas con decisiones humanas (§2) o técnicas (§5 a §13).
2. Se agregó una máquina de estados completa, con actores y precondiciones.
3. Se agregaron la aceptación atómica, el piso validado en la base y configurable, y la autorización en cada oferta.
4. Los particulares salen del MVP; el piloto es gratis y el cobro es manual después.
5. "Primero los más cercanos" se reemplaza por una lista única por ciudad con prioridad por documentación.
6. Se agregaron la revelación progresiva, el medio de pago del destinatario (el envío lo paga siempre quien recibe, D14) y los mensajes de WhatsApp.
7. Se definieron seguridad (RLS, MFA de admin, auditoría, antiabuso), retención de documentos y seguridad física.
8. Se agregaron marco legal mínimo, ambientes, CI/CD, backups, observabilidad y rollback.
9. Se agregó una estrategia de pruebas con E2E de todos los flujos.
10. Se agregó el plan de lanzamiento con métricas.
11. Se agregó el plan de implementación para 3 personas con agy (alcance agregado en el checkpoint, **no revisado por el Consejo**).
12. **Geolocalización, mapas y distancia server-side (D15, 2026-09-18):** Se agrega selección de pin en mapa de Aguilares para comercio (retiro) y solicitud (entrega), cálculo server-side de distancia con Haversine × 1.30 (0,5 km), visualización de recorrido post-aceptación con botón "Abrir en Google Maps", preservando D3 (privacidad progresiva sin coordenadas previas a la oferta) y D7 (sin tracking en vivo).
13. **Sistema de diseño, tokens shadcn/ui y estrategia de logos (D16, 2026-09-18):** Se aprueba la auditoría de las 36 vistas generadas en Stitch. Se ratifica la arquitectura shadcn/ui + Tailwind en `src/ui/` con variables HSL, piso de 14px (Anti-12px), TopBar marino unificado (`#12182C`), optimización de logos de `assets/` a `public/brand/` (< 5 KB), erradicación de los 7 datos fantasma de Stitch, mapa opcional en C03 con centroide como fallback y selector de billete para cambio en efectivo. Se dejan carpetas con README vinculantes en `docs/design/stitch/exports/`.


