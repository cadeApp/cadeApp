# ADR-0001 — Elección de Supabase como BaaS (modelo relacional/ACID, RLS, push manual, backups/PITR y costos USD por ambiente)

- **Estado:** Aceptado
- **Fecha:** 2026-09-22
- **Tarea / Issue:** `T-007` · Issue #8
- **Autores / Revisores:** `Lautaro073` (P1 — Base, Auth, Admin), `persona2` (P2 — Comercio), `persona3` (P3 — Repartidor y PWA)
- **Referencias:** `docs/master-plan.md` (§2, §6, §7, §8, §9, §11, §12, §16), `AGENTS.md` (§2 Invariantes del producto)

---

## 1. Contexto y problema

**cadeApp** es una PWA construida con Next.js App Router y TypeScript estricto que conecta comercios de Aguilares (Tucumán) con repartidores independientes mediante un mercado de ofertas por envío. El sistema debe garantizar cuatro invariantes críticos desde el primer día del piloto:

1. **Integridad transaccional bajo concurrencia:** Varios repartidores pueden ofertar simultáneamente sobre una misma solicitud (`open`), pero **exactamente una oferta** puede pasar a `accepted` y mover la solicitud a `matched`, rechazando atómicamente el resto sin condiciones de carrera (race conditions).
2. **Revelación progresiva de datos personales (D3 y D15):** Los datos sensibles del destinatario (`recipient_name`, `recipient_phone`, `dropoff_address`, `pickup_address`, `pickup_lat/lng`, `dropoff_lat/lng`, `notes`) jamás deben viajar al navegador antes del emparejamiento (`matched`), y luego solo deben ser visibles para el comercio dueño, el repartidor asignado y el administrador.
3. **Custodia y purga verificable de legajos (D8):** Las fotos de DNI y selfie de los repartidores deben almacenarse en privado (`courier-docs`), leerse únicamente mediante URLs firmadas efímeras con registro en `audit_log`, retenerse solo mientras el repartidor esté activo más 30 días tras baja o rechazo (`purge_after`), y **excluirse de cualquier backup** para evitar retención indefinida de datos biométricos/identificatorios.
4. **Presupuesto austero de lanzamiento:** El equipo de 3 personas necesita validar el piloto en Aguilares dentro de las capas gratuitas disponibles sin sacrificar seguridad ni trazabilidad, conociendo de antemano el costo exacto en USD al escalar a planes pagos.

---

## 2. Alternativas evaluadas

| Criterio | Opción A: Supabase (PostgreSQL + Auth + RLS + Storage + Realtime) | Opción B: Firebase (Firestore + Auth + Cloud Storage + FCM) | Opción C: Backend propio (Node/Fastify + Postgres administrado + S3 + Auth propio) |
|---|---|---|---|
| **Transacciones y modelo de datos** | **PostgreSQL nativo con ACID**, `SELECT ... FOR UPDATE`, índices únicos parciales, `CHECK` constraints y RPCs `SECURITY DEFINER`. | Modelo documental NoSQL; transacciones limitadas a lecturas previas sin `JOIN` ni índices únicos parciales nativos. | PostgreSQL nativo, pero exige mantener capa de API, migraciones y servidor separado. |
| **Seguridad por fila y columna (D3)** | **Row Level Security (RLS)** declarativa en el motor SQL; separación física en `delivery_request_contacts` verificable con pgTAP. | Security Rules propietarias; difícil auditar cruces relacionales complejos (ej. comerciante + oferta aceptada + estado de solicitud). | Autorización manual en cada endpoint; mayor superficie de error humano entre 3 desarrolladores. |
| **Custodia de archivos (D8)** | **Supabase Storage** con buckets privados integrados a políticas RLS de `storage.objects` y URLs firmadas server-side. | Cloud Storage con reglas separadas de la base relacional. | S3 + IAM + generación manual de presigned URLs. |
| **Pruebas automatizadas de contratos** | **Supabase CLI + pgTAP** corriendo en contenedor local en CI (`pnpm supabase test db`). | Emulador local sin garantías SQL ni tipos generados desde esquema relacional. | Requiere armar infraestructura de test containers e integración desde cero. |
| **Generación de tipos TypeScript** | Nativa vía `supabase gen types typescript` (`src/types/database.types.ts`). | Sin esquema estricto en el motor; depende de validadores en aplicación. | Requiere ORM (prohibido por regla 25) o codegen externo. |

**Decisión:** Se elige **Opción A (Supabase)** como Backend-as-a-Service (BaaS) único para base de datos relacional, autenticación, almacenamiento de archivos y canales Realtime.

---

## 3. Justificación técnica detallada

### 3.1. Modelo relacional e invariantes ACID en servidor

En cadeApp, la UI solo refleja el estado; toda regla de negocio se valida dentro de PostgreSQL (`AGENTS.md` §2):

- **Piso dinámico en ARS enteros:** El monto mínimo de solicitud y de oferta (`amount_ars`) no se hardcodea (`1000`); las funciones RPC consultan en tiempo de ejecución `platform_settings.min_offer_ars` (`integer`, en pesos argentinos enteros).
- **Aceptación atómica (`accept_offer`):** La transición `open` $\to$ `matched` se ejecuta dentro de una función RPC `SECURITY DEFINER` con `SET search_path = public, pg_temp` que:
  1. Bloquea la fila de `delivery_requests` mediante `SELECT ... FOR UPDATE`.
  2. Verifica que `status = 'open'` y que la solicitud no haya vencido (`expires_at > now()`).
  3. Verifica que el comercio (`merchants.status = 'active'`, suscripción al día) sea dueño de la solicitud y que el repartidor de la oferta siga `active`.
  4. Actualiza la oferta elegida a `status = 'accepted'`, respaldada por el **índice único parcial** `CREATE UNIQUE INDEX idx_offers_one_accepted_per_request ON public.offers(request_id) WHERE status = 'accepted'`, lo que hace físicamente imposible que existan dos ofertas aceptadas para un mismo pedido aún bajo concurrencia extrema.
  5. Rechaza el resto de ofertas `pending` del mismo pedido, asigna `matched_courier_id` y `final_amount_ars`, y escribe el evento en `request_events` en la misma transacción ACID.

### 3.2. Row Level Security (RLS) y revelación progresiva (`D3`, `D8`, `D15`)

Todas las tablas del esquema `public` tienen `ENABLE ROW LEVEL SECURITY` activo y las escrituras de negocio están cerradas o acotadas por políticas explícitas verificadas con **pgTAP** (`supabase/tests/rls_and_invariants.test.sql`):

- **Separación de datos personales (`delivery_request_contacts`):**
  - La tabla `delivery_requests` solo contiene referencias públicas de zona/barrio (`pickup_label`, `dropoff_label`, `zone_id`, `offered_amount_ars`, `distance_meters`) para que los repartidores puedan cotizar en la bolsa sin conocer la identidad ni el domicilio exacto del destinatario (**D3** y **D15**).
  - La tabla `delivery_request_contacts` almacena `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_address`, `dropoff_lat`, `dropoff_lng`, `recipient_name`, `recipient_phone` y `notes`.
  - Su política `SELECT` (`contacts_select_authorized`) permite lectura **únicamente** a:
    1. El comercio dueño de la solicitud (`merchant_user_id = auth.uid()`).
    2. El administrador (`is_admin()`).
    3. El repartidor asignado (`matched_courier_id = auth.uid()`), **solo cuando** `delivery_requests.status IN ('matched', 'in_transit', 'delivered')`. Si el pedido se cancela (`canceled`) o sigue `open`, el repartidor tiene acceso **cero** a nivel motor SQL.
- **Bucket privado `courier-docs` (`D8`):**
  - Los archivos de DNI (frente/dorso) y selfie se suben al bucket privado `courier-docs` (`public = false`).
  - Ningún cliente navegador (`anon` o `authenticated`) tiene política de lectura directa permanente sobre legajos ajenos.
  - Cuando un administrador revisa un legajo en `/admin/couriers/[id]`, una Server Action verifica el rol `admin`, invoca al cliente administrativo (`src/server/supabase/admin.ts`, protegido con `import 'server-only'`) para emitir una **URL firmada de 60 segundos de validez**, e inserta obligatoriamente un registro en `public.audit_log` (`action = 'view_courier_doc'`).

### 3.3. Notificaciones Web Push manuales vs Supabase Edge Functions (Disenso `X6`)

Se evaluó disparar las notificaciones push mediante Database Webhooks + Supabase Edge Functions (Deno) o Firebase Cloud Messaging (FCM), y se decidió descartarlo en favor de **Web Push estándar (VAPID) disparado desde Next.js (Node.js runtime)**:

1. **Almacenamiento en Postgres (`push_subscriptions`):** Cada dispositivo del comercio o repartidor registra su `endpoint`, `p256dh` y `auth_key` en `public.push_subscriptions` (con RLS dueño-solo).
2. **Emisión post-commit desde Route Handler / Server Action:** Una vez que la RPC de Postgres confirma la transacción (`COMMIT`), la capa de servidor de Next.js invoca el emisor push utilizando la librería estándar `web-push` con claves VAPID (`VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`).
3. **Higiene y privacidad del payload:**
   - **Cero PII en el payload (`AGENTS.md` §2):** El mensaje push solo transporta metadatos genéricos (ej. *"Recibiste una oferta por $1.500"* o *"Tenés un envío asignado"* y la ruta interna `/merchant/requests/[id]`), jamás nombres, direcciones ni teléfonos de `delivery_request_contacts`.
   - **Best-effort y limpieza automática:** Si el envío push falla, la operación de negocio **no se revierte** (la pantalla siempre se entera por Supabase Realtime o refetch al volver al foco). Si el servicio push responde HTTP `404` o `410` (suscripción revocada o vencida), el servidor elimina automáticamente la fila en `push_subscriptions`.
   - **Por qué no Edge Functions:** Evita mantener un segundo runtime (Deno), evita cold starts adicionales y elimina el consumo de la cuota de invocaciones de Edge Functions, manteniendo toda la lógica de servidor unificada y tipada en `src/server/`.

---

## 4. Estrategia de ambientes, Backups, PITR y exclusión de `courier-docs`

### 4.1. Distribución de los 4 ambientes frente al límite del plan gratuito (`D1`)

Supabase impone un límite estricto de **2 proyectos activos gratuitos por organización/cuenta** (**`[DATO]`**). Para operar los 4 ambientes del flujo de ingeniería (`local`, `develop`, `staging`, `producción`) sin costo durante el desarrollo y el piloto:

| Ambiente | Infraestructura de Supabase | Cómo se ejecuta y valida | Proyecto remoto en Supabase Cloud |
|---|---|---|---|
| **`local`** | Contenedor local vía `pnpm supabase start` (Supabase CLI `2.116.0`) | Desarrollo diario, migraciones y `pnpm supabase test db` (pgTAP). | Ninguno (`0` proyectos consumidos) **`[DATO]`** |
| **`develop` (CI)** | Contenedor efímero en GitHub Actions (`ubuntu-latest`) | En cada PR a `develop`, el job `db-tests` levanta `supabase start`, aplica todas las migraciones desde cero, corre las pruebas pgTAP y verifica que `pnpm db:types --local` no tenga drift contra `src/types/database.types.ts`. | Ninguno (`0` proyectos consumidos) **`[DATO]`** |
| **`staging`** | Proyecto nube **#1**: `cadeapp-staging` | Al mergear a la rama `staging`, el workflow `migrate.yml` ejecuta `supabase db push` y valida tipos contra la base remota. Usado para QA en celulares reales y simulacros. | **Proyecto Gratuito 1 de 2** **`[DATO]`** |
| **`producción`** | Proyecto nube **#2**: `cadeapp-prod` | Al promover a `main`, `migrate.yml` aplica migraciones sobre producción tras verificación previa en `staging`. | **Proyecto Gratuito 2 de 2** **`[DATO]`** |

### 4.2. Backups, Point-in-Time Recovery (PITR) y simulacro de restauración (`T-310`)

- **En etapa Piloto (Supabase Free Tier):**
  - El plan gratuito **no incluye backups automáticos descargables ni PITR**, y pausa los proyectos tras **7 días de inactividad** (**`[DATO]`**).
  - Para mitigar ambos riesgos en el piloto:
    1. El barrido programado (`/api/cron/sweep`, documentado en `ADR-0002`) genera actividad periódica de base de datos, evitando el pausado por inactividad (**`[SUPUESTO]`**).
    2. Se establece un respaldo lógico periódico de las tablas del esquema `public` (`pg_dump --schema=public`) y el **simulacro obligatorio de restauración en `staging` antes de salir a producción** (tarea `T-310`).
- **En etapa Escala Comercial (Supabase Pro + PITR):**
  - Al pasar el proyecto `cadeapp-prod` al **Plan Pro ($25 USD/mes)** (**`[DATO]`**), Supabase habilita **backups automáticos diarios con retención de 7 días** (**`[DATO]`**).
  - Cuando el volumen de pedidos exija un RPO (Recovery Point Objective) de minutos en lugar de 24 horas, se activa el add-on de **Point-in-Time Recovery (PITR)** mediante archivado continuo de WAL, cuyo costo base en Supabase es de **$100 USD/mes** (con 7 días de ventana de recuperación) (**`[DATO]`**).

### 4.3. Exclusión explícita del bucket `courier-docs` de los backups (`D8`)

Por política de privacidad y minimización de datos sensibles (`docs/master-plan.md` §9 y decisión **D8**):

1. **Ciclo de vida acotado (`purge_after`):** Todo archivo subido al bucket `courier-docs` tiene una fila asociada en `public.courier_documents` con `status`, `purge_after` y `purged_at`. Cuando un repartidor es rechazado o dado de baja, se fija `purge_after = now() + interval '30 days'`. Cumplido ese plazo, `/api/cron/sweep` elimina físicamente el objeto binario de Supabase Storage, marca `purged_at = now()` y registra la purga en `audit_log`.
2. **Exclusión de `courier-docs` de cualquier backup:**
   - En la arquitectura de Supabase, los backups de PostgreSQL (tanto `pg_dump` como los backups diarios del Plan Pro y el WAL de PITR) respaldan **únicamente las tablas de la base de datos** (incluyendo los metadatos en `storage.objects` y la trazabilidad en `public.courier_documents` / `public.audit_log`), pero **no copian ni retienen los archivos binarios del bucket S3 (`courier-docs`)** (**`[DATO]`**).
   - Queda **estrictamente prohibido** configurar tareas de sincronización (`rclone`, copias de bucket S3 o snapshots secundarios) que repliquen el contenido binario del bucket `courier-docs`. De esta manera, cuando `purge_after` vence y el objeto se elimina de Storage, **no queda ninguna copia fantasma del DNI ni de la selfie en backups históricos**.

---

## 5. Análisis de costos por ambiente en USD (`[DATO]` vs `[SUPUESTO]`)

Cada concepto de costo se clasifica explícitamente como **`[DATO]`** (precio o cuota oficial vigente del proveedor) o **`[SUPUESTO]`** (estimación de consumo operativo o carga impositiva/financiera).

### 5.1. Costos de Supabase por ambiente y etapa

| Ambiente | Etapa Piloto (Aguilares: ~10–15 comercios, ~10–15 repartidores, 50–150 envíos/día `[SUPUESTO]`) | Etapa Escala Comercial (Operación consolidada con SLA comercial y RPO diario/continuo) | Clasificación y detalle |
|---|---|---|---|
| **`local`** (Máquinas de las 3 personas) | **$0,00 USD / mes** | **$0,00 USD / mes** | **`[DATO]`** — Ejecución local mediante Supabase CLI (`2.116.0`). |
| **`develop`** (GitHub Actions CI) | **$0,00 USD / mes** | **$0,00 USD / mes** | **`[DATO]`** — Corre en contenedores efímeros dentro de los minutos incluidos de GitHub Actions (2.000 min/mes gratis en repositorios privados Free / ilimitados en públicos **`[DATO]`**). |
| **`staging`** (`cadeapp-staging`) | **$0,00 USD / mes** | **$0,00 USD / mes** (se mantiene en Free Tier) o **$25,00 USD / mes** (si se migra a Pro) | **`[DATO]`** — Usa el **Proyecto Gratuito #1 de 2** de Supabase (incluye 500 MB de base Postgres, 1 GB de Storage, 5 GB de egress y 50.000 MAUs de Auth **`[DATO]`**). El consumo de QA representa < 5% de la cuota **`[SUPUESTO]`**. |
| **`producción`** (`cadeapp-prod` — Base + Auth + Storage + Realtime) | **$0,00 USD / mes** (Free Tier) | **$25,00 USD / mes** (Supabase Pro base, incluye backups diarios 7 días y 8 GB DB / 100 GB Storage) | **`[DATO]`** — Precio oficial de Supabase Pro ($25 USD/mes por proyecto **`[DATO]`**). En el piloto (4.500 envíos/mes $\approx$ 15–25 MB de filas SQL y < 50 MB en `courier-docs` con purga a 30 días **`[SUPUESTO]`**), entra holgadamente en los 500 MB / 1 GB del Free Tier. |
| **`producción`** (`cadeapp-prod` — Add-on PITR opcional) | **$0,00 USD / mes** (No activado en piloto; se usa `pg_dump` + simulacro `T-310`) | **$100,00 USD / mes** (Opcional: Point-in-Time Recovery con retención WAL de 7 días; requiere Compute Small incluido o desde $15 USD/mes) | **`[DATO]`** — Tarifa oficial del add-on PITR de Supabase ($100 USD/mes **`[DATO]`**). Su activación depende de que la facturación por suscripciones de comercios supere el umbral de escala (**`[SUPUESTO]`**, ver S3 en Master Plan §16). |
| **Notificaciones Web Push (VAPID)** | **$0,00 USD / mes** | **$0,00 USD / mes** | **`[DATO]`** — Protocolo estándar RFC 8030 / VAPID directo contra los servicios push de los navegadores (FCM Web / Mozilla Autopush / Apple Web Push) sin intermediarios pagos. |
| **Servicio complementario: Google Maps Platform (`D15`)** | **$0,00 USD / mes** (con Quota Cap duro en 300 cargas/día) | **$0,00 USD / mes** hasta 10.000 cargas/mes; luego **$7,00 USD por cada 1.000 cargas adicionales** | **`[DATO]`** — Desde marzo de 2025, Google Maps Platform otorga **10.000 eventos gratuitos/mes** en el SKU Dynamic Maps (Essentials) y $7 USD/1.000 excedentes **`[DATO]`**. Con la optimización **D15** (el mapa solo se instancia tras `matched` o al fijar pin), el piloto consume ~1.820 cargas/mes ($\approx$ 18% de la cuota gratuita) = **$0,00 USD/mes** **`[SUPUESTO]`**. |
| **Impuestos y percepciones sobre pagos en USD desde Argentina** | **$0,00 USD / mes** (mientras el gasto facturado sea $0) | **+21% a +60% sobre el monto en USD** (según medio de pago / régimen de IVA servicios digitales y percepciones vigentes en Argentina al momento del débito) | **`[SUPUESTO]`** — Carga tributaria local variable en Argentina aplicable al pagar servicios cloud en moneda extranjera (supuesto S3 del Master Plan §16). |

### 5.2. Resumen consolidado de costos de BaaS y servicios de datos (USD/mes)

| Escenario | Costo mensual neto en proveedor (USD) | Clasificación |
|---|---|---|
| **Escenario 1 — Piloto en Aguilares** (`local` + `develop` + `cadeapp-staging` Free + `cadeapp-prod` Free + Maps dentro de cuota D15) | **$0,00 USD / mes** | **`[DATO]`** (precios de planes Free) + **`[SUPUESTO]`** (volumen dentro de cuotas: < 500 MB DB, < 1 GB Storage, < 10.000 cargas de mapa/mes). |
| **Escenario 2 — Producción Comercial Inicial** (`cadeapp-staging` Free + `cadeapp-prod` en **Supabase Pro** con backups diarios automáticos) | **$25,00 USD / mes** | **`[DATO]`** (tarifa mensual de Supabase Pro para 1 proyecto productivo). |
| **Escenario 3 — Producción Comercial con Alta Disponibilidad / PITR** (`cadeapp-prod` en Supabase Pro + Add-on PITR 7 días) | **$125,00 a $140,00 USD / mes** | **`[DATO]`** ($25 Pro + $100 PITR + $0–$15 Compute) + **`[SUPUESTO]`** (activación sujeta a escala comercial fuera del piloto). |

---

## 6. Consecuencias, riesgos y mitigaciones

### Ventajas
- **Cero condiciones de carrera en ofertas:** El motor PostgreSQL garantiza que dos aceptaciones concurrentes nunca produzcan doble asignación.
- **Privacidad verificable por diseño:** La separación entre `delivery_requests` y `delivery_request_contacts`, sumada a las políticas RLS probadas en CI con pgTAP (`T-005`), impide filtraciones accidentales desde el frontend.
- **Cumplimiento estricto de custodia documental (`D8`):** La exclusión de `courier-docs` de los backups garantiza que la purga a los 30 días sea real e irreversible.

### Riesgos y mitigaciones
- **Riesgo 1 — Pausado automático de proyectos gratuitos tras 7 días sin actividad (`[DATO]`):**
  - *Mitigación:* El job programado `/api/cron/sweep` (`ADR-0002`) realiza consultas periódicas contra la base de datos, manteniendo vivo el proyecto `cadeapp-prod` y `cadeapp-staging` sin intervención manual (**`[SUPUESTO]`**).
- **Riesgo 2 — Ausencia de backups automáticos en el Free Tier durante el piloto (`[DATO]`):**
  - *Mitigación:* Ejecución de `pg_dump` del esquema `public` y realización obligatoria del simulacro de restauración en `staging` antes del lanzamiento (`T-310`).
- **Riesgo 3 — Exceso de consumo en Google Maps si se cargara el mapa en la bolsa pública:**
  - *Mitigación:* Prohibición por arquitectura (`D15` y RLS `T-005`) de exponer coordenadas antes de `matched`; el componente de mapa solo se monta en las pantallas de pin inicial y de seguimiento post-aceptación, más un Quota Cap duro de 300 cargas/día en Google Cloud Console.

---

## 7. Revisión y conformidad del equipo (DoD `T-007`)

De acuerdo con el DoD de `T-007`, este registro cuenta con la estructura de revisión de las 3 personas responsables del proyecto:

| Persona | Rol / Zona | Estado de revisión | Observaciones / Conformidad |
|---|---|---|---|
| **`Lautaro073`** | **P1** (Base, Auth, Admin y Contratos) | Aprobado (Autor / Tech Lead) | Modelo relacional, RLS, RPCs `SECURITY DEFINER`, exclusión de `courier-docs` del backup y costos `[DATO]`/`[SUPUESTO]` alineados con `docs/master-plan.md` y migraciones `T-004`/`T-005`. |
| **`persona2`** | **P2** (Flujo Comercio y Ofertas) | Revisado / En conformidad con contrato P2 | Flujo transaccional de `publish_request` y `accept_offer`, piso dinámico `min_offer_ars` y revelación progresiva de `delivery_request_contacts` verificados para pantallas de comercio. |
| **`persona3`** | **P3** (Flujo Repartidor, Bolsa y PWA) | Revisado / En conformidad con contrato P3 | Suscripciones Web Push (`push_subscriptions`) best-effort sin PII, custodia temporal de `courier-docs` (`purge_after`) y carga diferida de mapas (`D15`) verificados para experiencia móvil del repartidor. |
