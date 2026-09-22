# ADR-0002 — Hosting de Next.js en Vercel y estrategia de Cron con expiración perezosa (`/api/cron/sweep`)

- **Estado:** Aceptado
- **Fecha:** 2026-09-22
- **Tarea / Issue:** `T-007` · Issue #8
- **Autores / Revisores:** `Lautaro073` (P1 — Base, Auth, Admin), `persona2` (P2 — Comercio), `persona3` (P3 — Repartidor y PWA)
- **Referencias:** `docs/master-plan.md` (§5.1, §8, §11, §12, §16 — supuestos `S1` y `S2`), `ADR-0001`

---

## 1. Contexto y problema

**cadeApp** se construye como un monolito modular en **Next.js 14 App Router** que sirve tanto la interfaz PWA (Comercio, Repartidor y Admin) como las Server Actions y los Route Handlers de servidor (`/api/cron/sweep`, emisión de Web Push con `web-push`, generación de URLs firmadas para `courier-docs`).

El diseño de infraestructura de hosting y tareas programadas debe resolver tres desafíos:

1. **Despliegue continuo por ambiente sin fricción operativa:** Las 3 personas del equipo necesitan Preview Deployments automáticos por Pull Request, un entorno estable de `staging` para pruebas en celulares reales y un entorno de `producción` con rollback instantáneo.
2. **Restricciones del plan gratuito de Vercel frente a la operación comercial (`S1`):** Los términos de servicio del plan **Vercel Hobby ($0 USD/mes)** prohíben el uso comercial directo (**`[DATO]`**), mientras que el plan **Vercel Pro cuesta $20 USD/mes por miembro de equipo** (**`[DATO]`**).
3. **Límite de frecuencia de Cron Jobs en planes gratuitos (`S2`):** En Vercel Hobby, los Cron Jobs están limitados a **1 ejecución por día** (con ventana de disparo de hasta 1 hora) (**`[DATO]`**), mientras que las solicitudes de envío en Aguilares expiran en ventanas cortas (`default_expiry_minutes = 15` minutos en `platform_settings`). Si la validez de un pedido dependiera de que el cron corra cada minuto, el sistema fallaría en el plan gratuito o ante cualquier demora del planificador.

---

## 2. Alternativas de Hosting evaluadas

| Criterio | Opción A: Vercel (Nativo para Next.js App Router) | Opción B: Cloudflare Pages / Workers (`@opennextjs/cloudflare`) | Opción C: Contenedor Docker en VPS / Railway / Fly.io |
|---|---|---|---|
| **Compatibilidad con Next.js 14 + Node.js Runtime** | **100% nativa** (Server Actions, Route Handlers con `node:crypto` y librería `web-push` sin adaptadores). | Requiere adaptador OpenNext y compatibilidad parcial con módulos nativos de Node.js (`web-push`). | 100% compatible, pero exige administrar Dockerfile, proxy inverso, TLS y escalado. |
| **Integración con flujo de 3 personas (`develop` $\to$ `staging` $\to$ `main`)** | **Preview Deployments automáticos** por PR y promoción por rama sin configuración manual. | Soportado, pero con mayor latencia de build y depuración más compleja. | Requiere configurar pipelines de despliegue y registros de imágenes propios. |
| **Cron Jobs integrados** | Declarativos en `vercel.json` invocando `/api/cron/sweep` con cabecera `Authorization: Bearer <CRON_SECRET>`. | Cron Triggers en Workers (requiere Worker separado o configuración custom). | Crontab del sistema o contenedor adicional. |
| **Costo mensual (Staging vs Comercial)** | **$0 USD/mes** en Hobby (solo validación técnica no comercial) / **$20 USD/mes por asiento** en Pro (**`[DATO]`**). | $0 USD/mes (Free) / $5 USD/mes (Workers Paid) (**`[DATO]`**). | Desde **$5 a $10 USD/mes** fijos desde el día 1 (**`[DATO]`**). |

**Decisión:** Se elige **Opción A (Vercel)** como plataforma de hosting principal para `staging` y `producción`, manteniendo la arquitectura 100% estándar de Next.js App Router (de modo que pueda portarse a un contenedor Node.js estándar en Railway/Fly.io si en el futuro se decidiera migrar por costos de asientos).

---

## 3. Arquitectura de Tareas Programadas (`/api/cron/sweep`) y Expiración Perezosa

### 3.1. Responsabilidades del endpoint `/api/cron/sweep`

Se define un único Route Handler de mantenimiento en `src/app/api/cron/sweep/route.ts` (ejecutado en el runtime `nodejs`), protegido obligatoriamente mediante la verificación de la cabecera HTTP:

```http
Authorization: Bearer <CRON_SECRET>
```

La variable `CRON_SECRET` se valida en el arranque del servidor con Zod (`src/lib/env.ts`) y solo existe en el entorno de servidor (`server-only`). Cualquier petición sin el token exacto recibe `401 Unauthorized`.

En cada ejecución, `/api/cron/sweep` realiza tres tareas idempotentes:

1. **Consolidación de solicitudes vencidas (`delivery_requests`):**
   - Busca solicitudes con `status = 'open'` y `expires_at <= now()`.
   - Actualiza su columna `status = 'expired'`, rechaza las ofertas `pending` asociadas, registra el evento en `request_events` y dispara el aviso push best-effort al comercio dueño informando que el pedido venció sin repartidor asignado.
2. **Purga física de legajos vencidos en `courier-docs` (`D8`):**
   - Busca registros en `public.courier_documents` donde `purge_after < now()` y `purged_at IS NULL` (documentos de DNI/selfie correspondientes a repartidores dados de baja o rechazados hace más de 30 días).
   - Elimina físicamente los archivos binarios del bucket privado `courier-docs` en Supabase Storage usando `src/server/supabase/admin.ts`.
   - Marca `purged_at = now()` en `public.courier_documents` e inserta una fila inmutable en `public.audit_log` (`action = 'purge_courier_doc'`).
3. **Actualización de estado de suscripciones comerciales (`merchants`):**
   - Verifica comercios cuyo `paid_until + (platform_settings.subscription_grace_days || ' days')::interval < now()` para reflejar el vencimiento de la suscripción manual y bloquear la publicación de nuevos pedidos hasta que el administrador registre el pago (`ADR-0001`).

### 3.2. Diseño de Expiración Perezosa (`lazy expiration` — Supuesto `S2`)

Para que la corrección del negocio **jamás dependa de la frecuencia ni de la puntualidad del cron**, cadeApp implementa **expiración perezosa (lazy expiration)** directamente en la capa de base de datos PostgreSQL:

```mermaid
flowchart LR
  subgraph Lectura y Escritura en Tiempo Real ["Operación en Vivo (RPCs y Consultas SQL)"]
    A["Solicitud status = 'open'"] --> B{"¿expires_at <= now()?"}
    B -- "Sí (Vencida)" --> C["Rechazo inmediato en RPC (submit_offer / accept_offer)\ny ocultamiento en bolsa de repartidores"]
    B -- "No (Vigente)" --> D["Permite ofertar y aceptar con lock FOR UPDATE"]
  end
  subgraph Barrido Diferido ["Barrido Asíncrono (/api/cron/sweep)"]
    C -. "Más tarde (cada 1 min, 15 min o 24 h)" .-> E["Materializa status = 'expired',\nregistra request_events y limpia courier-docs"]
  end
```

1. **Efecto en tiempo real (`expires_at <= now()`):**
   - La consulta de la bolsa de repartidores filtra estrictamente `status = 'open' AND expires_at > now()`. En el segundo exacto en que se cumple `expires_at <= now()`, el pedido desaparece de la bolsa sin esperar a que corra ningún cron.
   - Las funciones RPC `submit_offer` y `accept_offer` validan `expires_at > now()` dentro de la transacción `SELECT ... FOR UPDATE`. Si un repartidor o comercio intenta operar sobre una solicitud cuyo `expires_at <= now()`, la RPC rechaza la operación (y puede marcar `status = 'expired'` en el acto).
2. **Consecuencia arquitectónica clave (`S2`):**
   - En **Vercel Hobby** (donde el cron nativo de `vercel.json` solo puede ejecutarse **1 vez al día** **`[DATO]`**), **ningún pedido vencido puede ser ofertado ni aceptado**, y la purga de documentos (`purge_after` a 30 días) junto con el vencimiento de suscripciones (`paid_until` + días de gracia) tienen granularidad diaria, para lo cual **1 ejecución cada 24 horas es funcionalmente suficiente** (**`[DATO]`**).
   - Adicionalmente, dado que `/api/cron/sweep` es un endpoint HTTP estándar autenticado por `CRON_SECRET`, durante la validación técnica se puede invocar cada 10–15 minutos desde un workflow programado de GitHub Actions (`on: schedule`) o un planificador HTTP externo sin costo adicional (**`[SUPUESTO]`**), y en **Vercel Pro** se configura en `vercel.json` con frecuencia de 1 a 5 minutos (`*/5 * * * *`) (**`[DATO]`**).

---

## 4. Análisis de costos de Hosting y Cron por ambiente en USD (`[DATO]` vs `[SUPUESTO]`)

Siguiendo la regla de trazabilidad del DoD de `T-007`, cada costo se etiqueta como **`[DATO]`** (tarifa o límite oficial vigente del proveedor) o **`[SUPUESTO]`** (hipótesis operativa o regulatoria).

### 4.1. Costos de Vercel y ejecución de Cron por ambiente

| Ambiente | Etapa Validación Técnica / Pre-Comercial (Sin cobro de suscripción a comercios) | Etapa Piloto Comercial / Escala en Aguilares (Con cobro comercial activo — `S1`) | Clasificación y detalle |
|---|---|---|---|
| **`local`** (`pnpm dev` / `pnpm build`) | **$0,00 USD / mes** | **$0,00 USD / mes** | **`[DATO]`** — Servidor local de Next.js en las máquinas del equipo. |
| **`develop`** (Checks de CI en GitHub Actions + Preview Deployments) | **$0,00 USD / mes** | **$0,00 USD / mes** (incluido en el plan del proyecto en Vercel y minutos gratuitos de GitHub Actions) | **`[DATO]`** — Los Preview Deployments no tienen costo adicional por despliegue en Vercel (**`[DATO]`**). |
| **`staging`** (`staging.cadeapp...` en Vercel) | **$0,00 USD / mes** (Vercel Hobby) | **$0,00 USD / mes** (incluido dentro de la misma cuenta/proyecto de Vercel o subdominio de rama `staging`) | **`[DATO]`** — Un mismo proyecto en Vercel sirve `main` (producción) y la rama `staging` sin costo extra por dominio de preproducción (**`[DATO]`**). |
| **`producción`** (Hosting Next.js en Vercel — `S1`) | **$0,00 USD / mes** (Vercel Hobby — **exclusivamente para validación técnica sin fines de lucro**) | **$20,00 USD / mes** (Vercel Pro con **1 asiento** de despliegue administrado por el Tech Lead `Lautaro073`) o **$60,00 USD / mes** (si se habilitan 3 asientos en Vercel Team) | **`[DATO]`** — Precio oficial de Vercel Pro: **$20 USD/mes por asiento** (incluye 1 TB de Fast Data Transfer y 100 GB-h de Serverless Function Execution **`[DATO]`**). La política de uso aceptable de Vercel exige el plan Pro para actividad comercial (**`[DATO]`**, supuesto `S1` **`[SUPUESTO]`**). Centralizar la cuenta de despliegue de producción en 1 asiento (`Lautaro073`) mientras el código colabora en GitHub mantiene el costo en **$20 USD/mes** (**`[SUPUESTO]`**). |
| **Ejecución de `/api/cron/sweep`** | **$0,00 USD / mes** (1 cron diario en Vercel Hobby **`[DATO]`** + disparo opcional vía GitHub Actions `schedule` **`[SUPUESTO]`**) | **$0,00 USD / mes** (Incluido en Vercel Pro: soporta hasta 40 cron jobs por proyecto con frecuencia de hasta **1 vez por minuto** **`[DATO]`**) | **`[DATO]`** — Los Cron Jobs están incluidos sin recargo en Vercel (1/día en Hobby, hasta 1/minuto en Pro **`[DATO]`**). El tiempo de cómputo de `/api/cron/sweep` (< 500 ms cada 5 min $\approx$ 1,2 horas-invocación/mes) consume < 2% de la cuota mensual de funciones **`[SUPUESTO]`**. |
| **Dominio `.com.ar` (NIC Argentina) o `.app`** | **$0,00 a $1,20 USD / mes** (prorrateado anual) | **~$1,00 a $1,50 USD / mes** (prorrateado anual: ~$8.500 ARS/año en NIC.ar o ~$14 USD/año `.app`) | **`[SUPUESTO]`** — Arancel anual de registro de dominio prorrateado mensualmente. |
| **Impuestos argentinos sobre pagos en tarjeta (USD)** | **$0,00 USD / mes** (en etapa $0) | **+21% a +60% sobre la factura de Vercel Pro** (IVA servicios digitales + percepciones locales vigentes) | **`[SUPUESTO]`** — Sobrecosto impositivo local en Argentina para pagos internacionales con tarjeta (`S3`). |

---

### 4.2. Presupuesto total consolidado de infraestructura (ADR-0001 + ADR-0002)

Integrando las decisiones de **ADR-0001 (Supabase + Maps)** y **ADR-0002 (Vercel + Cron)**, el costo operativo mensual de cadeApp en USD por etapa es el siguiente:

| Etapa operativa | Supabase (`ADR-0001`) | Google Maps (`ADR-0001` `D15`) | Hosting y Cron (`ADR-0002`) | **Total mensual en proveedor (USD)** | Punto de equilibrio en comercios suscriptos (a ~$15.000 ARS / ~$12 USD por comercio/mes `[SUPUESTO]`) |
|---|---|---|---|---|---|
| **Fase A — Desarrollo, QA y Validación Técnica No Comercial** (`local` + `develop` + `staging` + demo cerrada) | **$0,00 USD** (`[DATO]`: 2 proyectos Free) | **$0,00 USD** (`[DATO]`/`[SUPUESTO]`: < 10k cargas/mes) | **$0,00 USD** (`[DATO]`: Vercel Hobby no comercial + expiración perezosa `S2`) | **$0,00 USD / mes** | **0 comercios** (`[DATO]`) |
| **Fase B — Piloto Comercial en Aguilares** (Vercel Pro 1 asiento + Supabase Free dentro de cuotas + Maps dentro de cuota D15) | **$0,00 USD** (`[DATO]`/`[SUPUESTO]`: < 500 MB DB, < 1 GB Storage) | **$0,00 USD** (`[SUPUESTO]`: ~1.820 cargas/mes con cap 300/día) | **$20,00 USD** (`[DATO]`: Vercel Pro 1 asiento comercial `S1`) | **$20,00 USD / mes** (+ impuestos locales `[SUPUESTO]`) | **2 comercios pagos** cubren el 100% del hosting (`[SUPUESTO]`) |
| **Fase C — Operación Comercial Consolidada** (Vercel Pro 1 asiento + Supabase Pro con backups diarios automáticos) | **$25,00 USD** (`[DATO]`: Supabase Pro en `cadeapp-prod`) | **$0,00 USD** (`[SUPUESTO]`: hasta ~500 envíos/día entra en cuota gratis) | **$20,00 USD** (`[DATO]`: Vercel Pro 1 asiento) | **$45,00 USD / mes** (+ impuestos locales `[SUPUESTO]`) | **4 a 5 comercios pagos** cubren toda la infraestructura Pro (`[SUPUESTO]`) |
| **Fase D — Escala Regional con PITR y Equipo Ampliado** (Vercel Pro 3 asientos + Supabase Pro + PITR) | **$125,00 USD** (`[DATO]`: $25 Pro + $100 PITR) | **$0,00 a $15,00 USD** (`[SUPUESTO]`: si supera 10k cargas/mes) | **$60,00 USD** (`[DATO]`: Vercel Pro 3 asientos) | **$185,00 a $200,00 USD / mes** | **16 a 18 comercios pagos** (`[SUPUESTO]`) |

---

## 5. Consecuencias, riesgos y mitigaciones

### Ventajas
- **Resiliencia total ante demoras del cron (`S2`):** Gracias a la expiración perezosa (`expires_at <= now()`), ni un atraso del cron en Vercel ni la limitación de 1 ejecución diaria en Hobby pueden causar que un repartidor tome un pedido vencido.
- **Seguridad de mantenimiento centralizada:** Todas las tareas de limpieza (pedidos vencidos, purga legal de DNI/selfie en `courier-docs` tras `purge_after`, y vencimiento de suscripciones con `subscription_grace_days`) residen en un único Route Handler `/api/cron/sweep` auditable y protegido por `CRON_SECRET`.
- **Viabilidad económica inmediata en Aguilares:** El piloto comercial puede operar legalmente desde **$20 USD/mes** (Vercel Pro 1 asiento + Supabase Free), alcanzando el punto de equilibrio de infraestructura con apenas **2 comercios suscriptos** (**`[SUPUESTO]`**).

### Riesgos y mitigaciones
- **Riesgo 1 — Uso accidental de Vercel Hobby en explotación comercial (`S1`):**
  - *Mitigación:* Antes de habilitar el cobro de suscripciones a los primeros comercios de Aguilares, el proyecto de producción debe activarse en **Vercel Pro** ($20 USD/mes por el asiento administrador de `Lautaro073`) o desplegarse en contenedor Node.js comercial.
- **Riesgo 2 — Exposición o invocación no autorizada de `/api/cron/sweep`:**
  - *Mitigación:* Validación obligatoria en tiempo constante de `Authorization: Bearer <CRON_SECRET>` y diseño 100% idempotente del barrido (ejecutarlo múltiples veces seguidas no altera pedidos vigentes ni borra documentos cuyo `purge_after` sea futuro).

---

## 6. Revisión y conformidad del equipo (DoD `T-007`)

De acuerdo con el DoD de `T-007`, este registro cuenta con la estructura de revisión de las 3 personas responsables del proyecto:

| Persona | Rol / Zona | Estado de revisión | Observaciones / Conformidad |
|---|---|---|---|
| **`Lautaro073`** | **P1** (Base, Auth, Admin y Contratos) | Aprobado (Autor / Tech Lead) | Arquitectura de `/api/cron/sweep`, protección con `CRON_SECRET`, purga de `courier-docs` (`purge_after`), vencimiento con `subscription_grace_days` y costos `[DATO]`/`[SUPUESTO]` validados. |
| **`persona2`** | **P2** (Flujo Comercio y Ofertas) | Revisado / En conformidad con contrato P2 | Desacoplamiento por expiración perezosa (`expires_at <= now()`) confirmado para las pantallas y acciones de comercio (`publish_request`, `accept_offer`). |
| **`persona3`** | **P3** (Flujo Repartidor, Bolsa y PWA) | Revisado / En conformidad con contrato P3 | Filtrado en tiempo real de pedidos vencidos en la bolsa del repartidor y compatibilidad de Web Push / PWA en Vercel verificados. |
