# ADR-0001 — Elección de Supabase como BaaS (modelo relacional/ACID, RLS, push manual, backups/PITR y costos USD por ambiente)

- **Estado:** Aceptado
- **Fecha:** 2026-09-22
- **Tarea / Issue:** `T-007` · Issue #8
- **Autores / Revisores:** `Lautaro073` (P1 — Base, Auth, Admin), `persona2` (P2 — Comercio), `persona3` (P3 — Repartidor y PWA)
- **Referencias:** `docs/master-plan.md` (§2, §6, §7, §8, §9, §11, §12, §16, §17 — decisión `D1` y supuesto `S3`), `AGENTS.md` (§2 Invariantes del producto)

---

## 1. Contexto y problema

**cadeApp** es una PWA construida con Next.js App Router y TypeScript estricto que conecta comercios de Aguilares (Tucumán) con repartidores independientes mediante un mercado de ofertas por envío. En cumplimiento de la decisión **`D1`** (`docs/master-plan.md` §2 y §12), el sistema debe garantizar cuatro invariantes críticos desde el primer día del piloto:

1. **Integridad transaccional bajo concurrencia:** Varios repartidores aprobados (`couriers.status = 'approved'`) pueden ofertar simultáneamente sobre una misma solicitud publicada (`status = 'published'`), pero **exactamente una oferta** puede pasar a `accepted` y mover la solicitud a `matched`, rechazando atómicamente el resto sin condiciones de carrera (race conditions).
2. **Revelación progresiva de datos personales (`D3` y `D15`):** Los datos sensibles, las coordenadas exactas del retiro y la entrega y la nota de entrega hacia el cliente (`recipient_name`, `recipient_phone`, `dropoff_address`, `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng`, `recipient_consent_declared` y `notes` —cuyo traslado desde `public.delivery_requests` hacia `public.delivery_request_contacts` se ejecuta en **`T-006` (`H22`)** tras la decisión `H02` de `Lautaro073`—) se aíslan físicamente en `public.delivery_request_contacts` y jamás deben viajar al navegador antes del emparejamiento (`matched`), siendo visibles únicamente para el comercio dueño (`merchant_id`), el repartidor de la oferta aceptada (`accepted_offer_id`) y el administrador (`app_private.is_admin()`).
3. **Custodia y purga verificable de legajos (`D8`):** Las fotos de DNI y selfie de los repartidores deben almacenarse en privado (`courier-docs`), leerse únicamente mediante URLs firmadas efímeras con registro en `public.audit_log`, retenerse solo mientras el repartidor esté activo más 30 días tras baja o rechazo (`purge_after`), y **excluirse de cualquier backup propio** (con verificación en `T-310` de su no retención en backups de base del proveedor) para evitar retención indefinida de datos biométricos/identificatorios.
4. **Presupuesto austero de lanzamiento:** El equipo de 3 personas necesita validar el piloto en Aguilares dentro de las capas gratuitas disponibles (sujeto al límite `S3` de 2 proyectos gratuitos de Supabase en `docs/master-plan.md` §12 y §17) sin sacrificar seguridad ni trazabilidad, conociendo de antemano el costo exacto en USD al escalar a planes pagos.

---

## 2. Alternativas evaluadas

| Criterio | Opción A: Supabase (PostgreSQL + Auth + RLS + Storage + Realtime) | Opción B: Firebase (Firestore + Auth + Cloud Storage + FCM) | Opción C: Backend propio (Node/Fastify + Postgres administrado + S3 + Auth propio) |
|---|---|---|---|
| **Transacciones y modelo de datos** | **PostgreSQL nativo con ACID**, `SELECT ... FOR UPDATE`, índices únicos parciales (`offers_one_accepted_per_request_idx`), `CHECK` constraints y RPCs `SECURITY DEFINER`. | Modelo documental NoSQL; transacciones limitadas a lecturas previas sin `JOIN` ni índices únicos parciales nativos. | PostgreSQL nativo, pero exige mantener capa de API, migraciones y servidor separado. |
| **Seguridad por fila y columna (`D3`)** | **Row Level Security (RLS)** declarativa en el motor SQL; separación física en `delivery_request_contacts` verificable con pgTAP. | Security Rules propietarias; difícil auditar cruces relacionales complejos (ej. comerciante + oferta aceptada + estado de solicitud). | Autorización manual en cada endpoint; mayor superficie de error humano entre 3 desarrolladores. |
| **Custodia de archivos (`D8`)** | **Supabase Storage** con buckets privados integrados a políticas RLS de `storage.objects` y URLs firmadas server-side. | Cloud Storage con reglas separadas de la base relacional. | S3 + IAM + generación manual de presigned URLs. |
| **Pruebas automatizadas de contratos** | **Supabase CLI + pgTAP** corriendo en contenedor local en CI (`pnpm supabase test db`). | Emulador local sin garantías SQL ni tipos generados desde esquema relacional. | Requiere armar infraestructura de test containers e integración desde cero. |
| **Generación de tipos TypeScript** | Nativa vía `supabase gen types typescript` (`src/types/database.types.ts`). | Sin esquema estricto en el motor; depende de validadores en aplicación. | Requiere ORM (prohibido por regla 25) o codegen externo. |

**Decisión:** Se elige **Opción A (Supabase)** como Backend-as-a-Service (BaaS) único para base de datos relacional, autenticación, almacenamiento de archivos y canales Realtime.

---

## 3. Justificación técnica detallada

### 3.1. Modelo relacional e invariantes ACID en servidor

En cadeApp, la UI solo refleja el estado; toda regla de negocio se valida dentro de PostgreSQL (`AGENTS.md` §2):

- **Piso dinámico en ARS enteros:** El monto mínimo de una oferta (`offers.amount_ars`) no se hardcodea (`1000`); las funciones RPC consultan en tiempo de ejecución la tabla clave/valor `public.platform_settings` (`WHERE key = 'min_offer_ars'`, sembrado en `'1000'::jsonb` en `supabase/seed.sql:12`).
- **Aceptación atómica (`accept_offer`):** La transición `published` $\to$ `matched` se ejecuta dentro de una función RPC `SECURITY DEFINER` con `SET search_path = public, pg_temp` (a implementar en `T-102`) que:
  1. Bloquea la fila de `public.delivery_requests` mediante `SELECT ... FOR UPDATE`.
  2. Verifica que `status = 'published'` y que la solicitud no haya vencido (`expires_at IS NULL OR expires_at > now()`).
  3. Verifica que el comercio (`merchants.subscription_status IN ('pilot', 'active')`) sea dueño de la solicitud (`delivery_requests.merchant_id = auth.uid()`) y que el repartidor de la oferta mantenga `couriers.status = 'approved'`.
  4. Actualiza la oferta elegida a `status = 'accepted'` y `decided_at = now()`, respaldada por el **índice único parcial** `CREATE UNIQUE INDEX offers_one_accepted_per_request_idx ON public.offers (request_id) WHERE status = 'accepted'` (`supabase/migrations/20260922031435_schema_v1.sql:209`), lo que hace físicamente imposible que existan dos ofertas aceptadas para un mismo pedido aún bajo concurrencia extrema.
  5. Rechaza el resto de ofertas `pending` del mismo pedido (`status = 'rejected'`, `decided_at = now()`), vincula `delivery_requests.accepted_offer_id` (con lo cual el monto acordado queda determinado por `offers.amount_ars` y el repartidor asignado por `offers.courier_id`), sella `matched_at = now()` y registra la trazabilidad en `public.audit_log` en la misma transacción ACID.

### 3.2. Row Level Security (RLS) y revelación progresiva (`D3`, `D8`, `D15`)

Todas las tablas del esquema `public` tienen `ENABLE ROW LEVEL SECURITY` activo y las escrituras de negocio están cerradas o acotadas por políticas explícitas verificadas con **pgTAP** (`supabase/tests/rls_matrix.sql`, `supabase/tests/rls_enabled.sql` y `supabase/tests/structure.sql`):

- **Separación de datos personales (`delivery_request_contacts`):**
  - La tabla `public.delivery_requests` (`supabase/migrations/20260922031435_schema_v1.sql:83`) contiene los campos operativos públicos de la bolsa (`merchant_id`, `status`, `pickup_zone_id`, `dropoff_zone_id`, `package_type`, `recipient_payment_method`, `needs_change`, `cash_change_amount`, `approx_distance_m`, `route_distance_m`, `expires_at`, `accepted_offer_id`) para que los repartidores aprobados puedan cotizar conociendo las zonas (`public.zones`) y las distancias sin acceder a la identidad, al domicilio exacto ni a las instrucciones privadas del destinatario (**`D3`** y **`D15`**).
  - **Estado destino de `notes` (Decisión `H02` de `Lautaro073` del `2026-09-22` e implementación en `T-006` / `H22`):** Por decisión de `Lautaro073` (`H02`), la nota de entrega hacia el cliente (`notes` —distinta de la nota que el repartidor adjunta al ofertar en `offers.message`, `supabase/migrations/20260922031435_schema_v1.sql:136`—) es un dato sensible protegido hasta `matched` que **solo puede ver el comercio dueño (`merchant_id`), el repartidor al que se le aceptó la oferta (`accepted_offer_id`) y el administrador (`app_private.is_admin()`)**. En la migración inicial (`supabase/migrations/20260922031435_schema_v1.sql:90`), `notes` quedó ubicada en `public.delivery_requests`, donde la política de fila `delivery_requests_select_courier` (`supabase/migrations/20260922051650_rls_v1.sql:270`, sin `GRANT SELECT (...)` por columna — `PR56-H13`) la expone en la bolsa a cualquier repartidor aprobado. Para materializar el estado destino decidido en `H02`, el traslado de `notes` desde `public.delivery_requests` hacia `public.delivery_request_contacts` y su prueba de aislamiento por columna en `supabase/tests/rls_matrix.sql` se ejecutan en **`T-006` (`H22`)**.
  - La tabla `public.delivery_request_contacts` (`supabase/migrations/20260922031435_schema_v1.sql:111`) almacena `request_id`, `pickup_address`, `pickup_lat`, `pickup_lng`, `dropoff_address`, `dropoff_lat`, `dropoff_lng`, `recipient_name`, `recipient_phone`, `recipient_consent_declared` y —a partir de `T-006` (`H22`)— `notes`.
  - Sus **tres políticas `SELECT` separadas por actor** (`supabase/migrations/20260922051650_rls_v1.sql:319-329`, siguiendo el principio de separación de privilegios por rol) permiten lectura **únicamente** a:
    1. **`contacts_select_merchant`**: El comercio dueño de la solicitud (`app_private.is_request_merchant(request_id, auth.uid())`, que valida `delivery_requests.merchant_id = auth.uid()`).
    2. **`contacts_select_admin`**: El administrador (`app_private.is_admin()`).
    3. **`contacts_select_accepted_courier`**: El repartidor cuya oferta fue aceptada (`app_private.is_courier_assigned_to_request(request_id, auth.uid())`, que verifica en SQL que `delivery_requests.accepted_offer_id` apunte a una fila de `public.offers` con `courier_id = auth.uid()` y `status = 'accepted'`). Si el pedido sigue en `draft` o `published`, o si pasa a `cancelled` o `expired` sin oferta aceptada para ese repartidor, el acceso a `delivery_request_contacts` es **cero** a nivel motor SQL.
- **Bucket privado `courier-docs` (`D8`):**
  - Los archivos de DNI (frente/dorso) y selfie se suben al bucket privado `courier-docs` (`public = false`).
  - Ningún cliente navegador (`anon` o `authenticated`) tiene política de lectura directa permanente sobre legajos en `storage.objects`.
  - Cuando un administrador revisa un legajo en `/admin/couriers/[id]`, una Server Action verifica el rol `admin` (`app_private.is_admin()`), invoca al cliente administrativo (`src/server/supabase/admin.ts`, protegido con `import 'server-only'`) para emitir una **URL firmada de 60 segundos de validez**, e inserta obligatoriamente un registro en `public.audit_log` (`entity_type = 'courier_document'`).

### 3.3. Notificaciones Web Push manuales vs Supabase Edge Functions (Disenso `X6`)

Se evaluó disparar las notificaciones push mediante Database Webhooks + Supabase Edge Functions (Deno) o Firebase Cloud Messaging (FCM), y se decidió descartarlo en favor de **Web Push estándar (VAPID) disparado desde Next.js (Node.js runtime)**:

1. **Almacenamiento en Postgres (`push_subscriptions`):** Cada dispositivo del comercio o repartidor registra su `endpoint`, `p256dh` y `auth` en `public.push_subscriptions` (`supabase/migrations/20260922031435_schema_v1.sql:165`, con RLS dueño-solo `push_subscriptions_all_self`).
2. **Emisión post-commit desde Route Handler / Server Action:** Una vez que la RPC de Postgres confirma la transacción (`COMMIT`), la capa de servidor de Next.js invoca el emisor push utilizando la librería estándar `web-push` con claves VAPID (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` definidas en `.env.example:67-70`).
3. **Higiene y privacidad del payload:**
   - **Cero PII en el payload (`AGENTS.md` §2):** El mensaje push solo transporta metadatos genéricos (ej. *"Recibiste una oferta por \$1.500"* o *"Tenés un envío asignado"* y la ruta interna `/merchant/requests/[id]`), jamás nombres, direcciones ni teléfonos de `delivery_request_contacts`.
   - **Best-effort y limpieza automática:** Si el envío push falla, la operación de negocio **no se revierte** (la pantalla siempre se entera por Supabase Realtime o refetch al volver al foco). Si el servicio push responde HTTP `404` o `410` (suscripción revocada o vencida), el servidor elimina automáticamente la fila en `push_subscriptions`.
   - **Por qué no Edge Functions:** Evita mantener un segundo runtime (Deno), evita cold starts adicionales y elimina el consumo de la cuota de invocaciones de Edge Functions, manteniendo toda la lógica de servidor unificada y tipada en `src/server/`.

---

## 4. Estrategia de ambientes, Backups, PITR y exclusión de `courier-docs`

### 4.1. Distribución de los 4 ambientes frente al límite del plan gratuito (`S3`, §12 y §17) y decisión `D1`

En el marco de la decisión **`D1`** (`docs/master-plan.md` §2 y §12) y del supuesto **`S3`** (`docs/master-plan.md` §12 línea 281 y §17 línea 395, confirmado por `Lautaro073` el `2026-09-17`), Supabase impone un límite estricto de **2 proyectos activos gratuitos por organización/cuenta** (**`[DATO]`**). Para operar los 4 ambientes del flujo de ingeniería (`local`, `develop`, `staging`, `producción`) sin costo durante el desarrollo y el piloto:

| Ambiente | Infraestructura de Supabase | Cómo se ejecuta y valida | Proyecto remoto en Supabase Cloud |
|---|---|---|---|
| **`local`** | Contenedor local vía `pnpm supabase start` (Supabase CLI `2.116.0`) | Desarrollo diario, migraciones y `pnpm supabase test db` (pgTAP). | Ninguno (`0` proyectos consumidos) **`[DATO]`** |
| **`develop` (CI)** | Contenedor efímero en GitHub Actions (`ubuntu-latest`) | En cada PR a `develop`, el job `db-tests` levanta `supabase start`, aplica todas las migraciones desde cero, corre las pruebas pgTAP y verifica que `pnpm db:types --local` no tenga drift contra `src/types/database.types.ts`. | Ninguno (`0` proyectos consumidos) **`[DATO]`** |
| **`staging`** | Proyecto nube **#1**: `cadeapp-staging` | Al mergear a la rama `staging`, el workflow `.github/workflows/migrate.yml` ejecuta `supabase db push` y valida tipos contra la base remota. Usado para QA en celulares reales y simulacros. | **Proyecto Gratuito 1 de 2 (`S3`)** **`[DATO]`** |
| **`producción`** | Proyecto nube **#2**: `cadeapp-prod` | Al promover a `main`, `.github/workflows/migrate.yml` aplica migraciones sobre producción tras verificación previa en `staging`. | **Proyecto Gratuito 2 de 2 (`S3`)** **`[DATO]`** |

### 4.2. Backups, Point-in-Time Recovery (PITR) y simulacro de restauración (`T-310`)

- **En etapa Piloto (Supabase Free Tier):**
  - El plan gratuito **no incluye backups automáticos descargables ni PITR**, y pausa los proyectos tras **7 días de inactividad** (**`[DATO]`**).
  - Para mitigar ambos riesgos en el piloto:
    1. El barrido programado (`/api/cron/sweep`, documentado en `ADR-0002`) genera actividad periódica de base de datos, evitando el pausado por inactividad (**`[SUPUESTO]`**).
    2. Se establece un respaldo lógico periódico de las tablas del esquema `public` (`pg_dump --schema=public`) y el **simulacro obligatorio de restauración en `staging` antes de salir a producción** (tarea `T-310`).
- **En etapa Escala Comercial (Supabase Pro + PITR):**
  - Al pasar el proyecto `cadeapp-prod` al **Plan Supabase Pro (\$25 USD/mes)** (**`[DATO]`**), Supabase habilita **backups automáticos diarios con retención de 7 días** (**`[DATO]`**).
  - Cuando el volumen de pedidos exija un RPO (Recovery Point Objective) de minutos en lugar de 24 horas, se activa el add-on de **Point-in-Time Recovery (PITR)** mediante archivado continuo de WAL, cuyo costo base en Supabase es de **\$100 USD/mes** (con 7 días de ventana de recuperación) (**`[DATO]`**).

### 4.3. Exclusión explícita del bucket `courier-docs` de los backups (`D8`)

Por política de privacidad y minimización de datos sensibles (`docs/master-plan.md` §9.4 línea 221 y decisión **`D8`**):

1. **Ciclo de vida acotado (`purge_after`):** Todo archivo subido al bucket `courier-docs` tiene una fila asociada en `public.courier_documents` con `status`, `purge_after` y `purged_at`. Cuando un repartidor es rechazado o dado de baja, se fija `purge_after = now() + interval '30 days'`. Cumplido ese plazo, `/api/cron/sweep` elimina físicamente el objeto binario de Supabase Storage, marca `purged_at = now()` y registra la purga en `public.audit_log`.
2. **Exclusión de `courier-docs` de cualquier backup (`D8`):**
   - **Control propio del proyecto (garantizado por diseño):** El respaldo lógico propio (`pg_dump --schema=public`) exporta exclusivamente las tablas del esquema `public` y excluye objetos binarios; asimismo, queda **estrictamente prohibido** configurar tareas de sincronización (`rclone`, copias de bucket S3 o snapshots secundarios) que repliquen el contenido binario del bucket `courier-docs`.
   - **Comportamiento del proveedor (`[SUPUESTO]` sujeto a verificación empírica en `T-310`):** De acuerdo con la arquitectura documentada de Supabase (donde los backups de PostgreSQL y el WAL de PITR respaldan las tablas SQL —incluyendo metadatos en `storage.objects` y trazabilidad en `public.courier_documents` y `public.audit_log`— mientras los objetos binarios residen en almacenamiento S3 separado), se asume que los backups de base de Supabase **no copian ni retienen los archivos binarios del bucket `courier-docs`** (**`[SUPUESTO]`**). Tal como exige `docs/master-plan.md` §9.4 (línea 221), este comportamiento **debe verificarse empíricamente durante el simulacro de backup y restauración en `staging` (`T-310`)** antes de aprobar al primer repartidor real en producción, comprobando que tras eliminar un archivo de `courier-docs` y restaurar el backup de base no queden copias fantasma del DNI ni de la selfie.

---

## 5. Análisis de costos por ambiente en USD (`[DATO]` vs `[SUPUESTO]`)

Cada concepto de costo se clasifica explícitamente como **`[DATO]`** (precio o cuota oficial vigente del proveedor según §8 «Fuentes consultadas») o **`[SUPUESTO]`** (estimación de consumo operativo o carga impositiva/financiera propia).

### 5.1. Costos de Supabase por ambiente y etapa

| Ambiente | Etapa Piloto (Aguilares: ~10–15 comercios, ~10–15 repartidores, 50–150 envíos/día `[SUPUESTO]`) | Etapa Escala Comercial (Operación consolidada con SLA comercial y RPO diario/continuo) | Clasificación y detalle |
|---|---|---|---|
| **`local`** | **\$0,00 USD / mes** | **\$0,00 USD / mes** | **`[DATO]`** — Ejecución local mediante Supabase CLI (`2.116.0`) en las máquinas del equipo. |
| **`develop` (CI)** | **\$0,00 USD / mes** | **\$0,00 USD / mes** | **`[DATO]`** — Corre en contenedores efímeros dentro de los minutos incluidos de GitHub Actions (2.000 min/mes gratis en repositorios privados Free e ilimitados en públicos **`[DATO]`**). |
| **`staging`** (`cadeapp-staging`) | **\$0,00 USD / mes** | **\$0,00 USD / mes** (se mantiene en Free Tier) o **\$25,00 USD / mes** (si se migra a Supabase Pro) | **`[DATO]`** — Usa el **Proyecto Gratuito #1 de 2 (`S3`)** de Supabase (incluye 500 MB de base Postgres, 1 GB de Storage, 5 GB de egress y 50.000 MAUs de Auth **`[DATO]`**). El consumo de QA representa < 5% de la cuota **`[SUPUESTO]`**. |
| **`producción`** (`cadeapp-prod` — Base + Auth + Storage + Realtime) | **\$0,00 USD / mes** (Free Tier) | **\$25,00 USD / mes** (Supabase Pro base, incluye backups diarios 7 días y 8 GB DB / 100 GB Storage) | **`[DATO]`** — Precio oficial de Supabase Pro (\$25 USD/mes por proyecto **`[DATO]`**). En el piloto (4.500 envíos/mes $\approx$ 15–25 MB de filas SQL y < 50 MB en `courier-docs` con purga a 30 días **`[SUPUESTO]`**), entra holgadamente en los 500 MB / 1 GB del Free Tier. |
| **`producción`** (`cadeapp-prod` — Add-on PITR opcional) | **\$0,00 USD / mes** (No activado en piloto; se usa `pg_dump` + simulacro `T-310`) | **\$100,00 USD / mes** (Opcional: Point-in-Time Recovery con retención WAL de 7 días; requiere Compute Small incluido o desde \$15 USD/mes) | **`[DATO]`** — Tarifa oficial del add-on PITR de Supabase (\$100 USD/mes **`[DATO]`**). Su activación depende de que la facturación por suscripciones de comercios supere el umbral de escala comercial del proyecto (**`[SUPUESTO]`** — estimación financiera propia de este ADR en función de la decisión `D1` y `S7` de `docs/master-plan.md` §17). |
| **Notificaciones Web Push (VAPID)** | **\$0,00 USD / mes** | **\$0,00 USD / mes** | **`[DATO]`** — Protocolo estándar RFC 8030 / VAPID directo contra los servicios push de los navegadores (FCM Web / Mozilla Autopush / Apple Web Push) sin intermediarios pagos. |
| **Servicio complementario: Google Maps Platform (`D15`)** | **\$0,00 USD / mes** (con Quota Cap duro en 300 cargas/día) | **\$0,00 USD / mes** hasta 10.000 cargas/mes; luego **\$7,00 USD por cada 1.000 cargas adicionales** | **`[DATO]`** — Desde marzo de 2025, Google Maps Platform otorga **10.000 eventos gratuitos/mes** en el SKU Dynamic Maps (Essentials) y \$7 USD/1.000 excedentes **`[DATO]`**. Con la optimización **`D15`** (el mapa solo se instancia tras `matched` o al fijar pin), el piloto consume ~1.820 cargas/mes ($\approx$ 18% de la cuota gratuita) = **\$0,00 USD/mes** **`[SUPUESTO]`**. |
| **Impuestos y percepciones sobre pagos en USD desde Argentina** | **\$0,00 USD / mes** (mientras el gasto facturado sea \$0) | **+21% a +60% sobre el monto en USD** (según medio de pago / régimen de IVA servicios digitales y percepciones vigentes en Argentina al momento del débito) | **`[SUPUESTO]`** — Estimación fiscal propia de este ADR sobre el sobrecosto impositivo en Argentina para pagos internacionales en moneda extranjera (vinculada al riesgo fiscal `X3` de `docs/master-plan.md` §15; no atribuible a `S3`). |

### 5.2. Resumen consolidado de costos de BaaS y servicios de datos (USD/mes)

| Escenario | Costo mensual neto en proveedor (USD) | Clasificación |
|---|---|---|
| **Escenario 1 — Piloto en Aguilares** (`local` + `develop` + `cadeapp-staging` Free + `cadeapp-prod` Free + Maps dentro de cuota `D15`) | **\$0,00 USD / mes** | **`[DATO]`** (precios de planes Free y límite `S3`) + **`[SUPUESTO]`** (volumen dentro de cuotas: < 500 MB DB, < 1 GB Storage, < 10.000 cargas de mapa/mes). |
| **Escenario 2 — Producción Comercial Inicial** (`cadeapp-staging` Free + `cadeapp-prod` en **Supabase Pro** con backups diarios automáticos) | **\$25,00 USD / mes** | **`[DATO]`** (tarifa mensual de Supabase Pro para 1 proyecto productivo). |
| **Escenario 3 — Producción Comercial con Alta Disponibilidad / PITR** (`cadeapp-prod` en Supabase Pro + Add-on PITR 7 días) | **\$125,00 a \$140,00 USD / mes** | **`[DATO]`** (\$25 Supabase Pro + \$100 PITR + \$0–\$15 Compute) + **`[SUPUESTO]`** (activación sujeta a escala comercial fuera del piloto). |

---

## 6. Consecuencias, riesgos y mitigaciones

### Ventajas
- **Cero condiciones de carrera en ofertas:** El motor PostgreSQL y el índice `offers_one_accepted_per_request_idx` garantizan que dos aceptaciones concurrentes nunca produzcan doble asignación.
- **Privacidad verificable por diseño:** La separación entre `delivery_requests` y `delivery_request_contacts`, sumada a las tres políticas RLS (`contacts_select_merchant`, `contacts_select_accepted_courier`, `contacts_select_admin`) probadas en CI con pgTAP (`T-005`), impide filtraciones accidentales de coordenadas y datos del destinatario antes de `matched`.
- **Cumplimiento estricto de custodia documental (`D8`):** La prohibición de backups propios sobre `courier-docs` y la verificación empírica en `T-310` de su exclusión en los backups del proveedor garantizan que la purga a los 30 días (`purge_after`) sea real e irreversible.

### Riesgos y mitigaciones
- **Riesgo 1 — Pausado automático de proyectos gratuitos tras 7 días sin actividad (`[DATO]`):**
  - *Mitigación:* El job programado `/api/cron/sweep` (`ADR-0002`) realiza consultas periódicas contra la base de datos, manteniendo vivo el proyecto `cadeapp-prod` y `cadeapp-staging` sin intervención manual (**`[SUPUESTO]`**).
- **Riesgo 2 — Ausencia de backups automáticos en el Free Tier durante el piloto (`[DATO]`):**
  - *Mitigación:* Ejecución de `pg_dump --schema=public` y realización obligatoria del simulacro de restauración en `staging` antes del lanzamiento (`T-310`).
- **Riesgo 3 — Exposición de `notes` en la bolsa antes de `matched` por filtrado RLS a nivel fila (`H01` / `H02` / `H22`):**
  - *Mitigación:* Por decisión de `Lautaro073` (`2026-09-22`, `H02`), `notes` (nota de entrega hacia el cliente, distinta de `offers.message`) es un dato sensible protegido hasta `matched` que solo ven el comercio dueño (`merchant_id`), el repartidor de la oferta aceptada (`accepted_offer_id`) y el administrador (`app_private.is_admin()`). El traslado físico de `notes` desde `public.delivery_requests` hacia `public.delivery_request_contacts` y su aserción de columna en `supabase/tests/rls_matrix.sql` se ejecutan en **`T-006` (`H22`)**.

---

## 7. Revisión y conformidad del equipo (DoD `T-007`)

De acuerdo con el DoD de `T-007`, cada fila de la tabla de revisión utiliza el vocabulario cerrado de estados (`Aprobado` | `Revisado con observaciones` | `Pendiente`):

| Persona | Rol / Zona | Estado de revisión | Canal y fecha de evidencia | Observaciones / Conformidad |
|---|---|---|---|---|
| **`Lautaro073`** | **P1** (Base, Auth, Admin y Contratos) | Aprobado | Autoría y validación en PR #57 (`2026-09-22`) | Modelo relacional, RLS (`contacts_select_*`), RPCs `SECURITY DEFINER`, exclusión de `courier-docs` (`[SUPUESTO]` a verificar en `T-310`) y costos `[DATO]`/`[SUPUESTO]` alineados con `20260922031435_schema_v1.sql` y `20260922051650_rls_v1.sql`. |
| **`persona2`** | **P2** (Flujo Comercio y Ofertas) | Aprobado | Checkpoint funcional sincrónico con Tech Lead (`2026-09-22` — nota `H09`) | Flujo transaccional de `publish_request` y `accept_offer`, piso dinámico `min_offer_ars` y revelación progresiva de `delivery_request_contacts` revisados para pantallas de comercio. |
| **`persona3`** | **P3** (Flujo Repartidor, Bolsa y PWA) | Aprobado | Checkpoint funcional sincrónico con Tech Lead (`2026-09-22` — nota `H09`) | Suscripciones Web Push (`push_subscriptions`) best-effort sin PII, custodia temporal de `courier-docs` (`purge_after`) y carga diferida de mapas (`D15`) revisados para experiencia móvil del repartidor. |

> **Nota sobre la decisión abierta `H09` (`Lautaro073`):** Dado que `persona2` y `persona3` son perfiles funcionales que no emiten revisiones de código en GitHub (`.github/workflows/approval-policy.mjs`), su conformidad sobre los contratos de negocio se releva mediante checkpoint funcional con el Tech Lead y queda registrada en esta tabla y en la bitácora `docs/tasks/log/T-007.md`, quedando a disposición de `Lautaro073` cualquier ajuste sobre el mecanismo de constancia (`H09`).

---

## 8. Fuentes consultadas

Todas las cifras tarifarias, cuotas del Free Tier y límites técnicos etiquetados como **`[DATO]`** en este documento fueron relevados de la documentación oficial vigente de los proveedores con fecha de consulta **`2026-09-22`**:

1. **Supabase Pricing & Free / Pro Tier Quotas (\$0 Free, \$25/mes Supabase Pro, límite `S3` de 2 proyectos gratuitos activos, 500 MB DB, 1 GB Storage, 5 GB Egress, 50.000 MAU y pausado tras 7 días de inactividad):**
   - URL: https://supabase.com/pricing (consultado el `2026-09-22`).
2. **Supabase Database Backups & Point-in-Time Recovery (add-on PITR \$100/mes por 7 días de retención WAL, backups diarios en Plan Pro y arquitectura de backups de base de datos frente a objetos de Storage sujeta a verificación en `T-310`):**
   - URL: https://supabase.com/docs/guides/platform/backups (consultado el `2026-09-22`).
3. **Google Maps Platform Pricing & Dynamic Maps Essentials Quota (`D15` — 10.000 eventos gratuitos/mes desde marzo de 2025 y \$7,00 USD por cada 1.000 cargas adicionales):**
   - URL: https://developers.google.com/maps/billing-and-pricing/pricing (consultado el `2026-09-22`).
4. **GitHub Actions Billing & Runner Quotas (2.000 minutos/mes incluidos en cuentas Free privadas e ilimitados en repositorios públicos):**
   - URL: https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions (consultado el `2026-09-22`).
5. **Web Push Protocol (RFC 8030) & Voluntary Application Server Identification — VAPID (RFC 8292):**
   - URL: https://datatracker.ietf.org/doc/html/rfc8030 y https://datatracker.ietf.org/doc/html/rfc8292 (consultado el `2026-09-22`).
