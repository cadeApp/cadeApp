# Runbook — Checklist y Procedimiento de Release `staging → main`

- **Servicio:** cadeApp — Plataforma de envíos locales en Aguilares, Tucumán
- **Responsables:** Todas las partes (P1 `@Lautaro073`, P2, P3). **Aprobación final obligatoria y exclusiva:** `@Lautaro073`
- **Tarea asociada:** T-312 (Fase 3 — Calidad, operación y salida)
- **Issue:** #44
- **Ambientes involucrados:** `cadeapp-staging` (staging en Vercel y Supabase) → `cadeapp-prod` (producción en Vercel y Supabase)
- **Contratos y gobernanza:** `docs/master-plan.md`, `docs/implementation-plan.md` §6, `AGENTS.md`, `.agents/rules/**`

---

## 1. Propósito y Alcance

Este runbook estandariza el procedimiento operativo y el checklist exhaustivo de verificación previa para realizar la promoción de versión desde la rama `staging` a la rama de producción `main`.

El release a producción representa la salida en vivo del MVP de cadeApp en Aguilares. Para garantizar la estabilidad del servicio, la protección estricta de los datos de contacto y legajos biométricos, y la compatibilidad sin interrupciones, la promoción exige el cumplimiento estricto y sin excepciones de los 8 hitos de calidad (DoD) definidos en `docs/tasks/T-312.md`.

---

## 2. Los 8 Gates de Calidad Previos al Release (DoD de T-312)

Antes de fusionar el Pull Request de release `staging → main`, el capitán de release y el equipo deben verificar y documentar el estado de cada uno de los siguientes hitos:

```
[ Gate 1: E2E Completo Verde ] ───► [ Gate 2: Migraciones DB ] ───► [ Gate 3: Variables Producción ]
                                                                             │
[ Gate 6: Simulacro Backups  ] ◄─── [ Gate 5: Textos Legales  ] ◄─── [ Gate 4: Nota de Rollback   ]
              │
              ▼
[ Gate 7: Revisión Seguridad ] ───► [ Gate 8: Aprobación Lautaro073 ] ───► MERGE A MAIN
```

---

### Gate 1: Suite E2E Completa Verde en Staging (`T-301…T-314`)

- **Objetivo:** Asegurar que todos los flujos críticos de usuario, roles, seguridad y resiliencia funcionan de punta a punta en el entorno integrado de staging (`cadeapp-staging`).
- **Cobertura obligatoria:**
  1. `T-301`: Arnés E2E, fixtures canónicas y page objects base.
  2. `T-302`: Onboarding completo del cadete, verificación con MFA TOTP (`aal2`), rechazo de legajo y detección de DNI duplicado.
  3. `T-303`: Flujo comercial principal (alta de solicitud → recepción de ofertas ≥ $1.000 ARS → elección de cadete → matching).
  4. `T-304`: Máquina de estados de la solicitud, cancelaciones y expiración.
  5. `T-305`: Aislamiento estricto de autorización por rol (`merchant`, `courier`, `admin`, anon) y barreras de rutas protegidas.
  6. `T-306`: Suscripciones de comercios y reglas de operación bajo modo piloto (`pilot_active`).
  7. `T-307`: Notificaciones Web Push y resiliencia operativa ante reconexiones de red.
  8. `T-308`: Reporte y gestión de incidentes en viaje.
  9. `T-309`: Subida de documentos con red degradada (throttling), feedback visual y auditoría de accesibilidad WCAG AA (`@axe-core/playwright`).
  10. `T-313`: Registro integral de comercios y aceptación de consentimientos legales.
  11. `T-314`: Renderizado de mapas, geolocalización, privacidad de coordenadas (D3/D15: no exposición de ubicación exacta antes del match) y degradación graceful ante indisponibilidad del servicio de mapas.
- **Evidencia requerida:** Run del workflow `e2e-staging.yml` finalizado con estado exitoso (100% checks verdes) sobre el SHA exacto promovido a staging.

---

### Gate 2: Migraciones de Base de Datos Aplicadas y Validadas

- **Objetivo:** Comprobar la integridad del esquema de base de datos en PostgreSQL, la ausencia de drift y la idempotencia de los cambios.
- **Verificaciones obligatorias:**
  1. `pnpm db:types` ejecutado en limpio: `src/types/database.types.ts` no debe presentar diff contra el esquema migrado.
  2. Las migraciones en `supabase/migrations/` deben ser estrictamente hacia adelante, compatibles con zero-downtime (sin eliminar columnas en uso por la aplicación vigente).
  3. `test:db` (pgTAP): Todas las pruebas de estructura, RLS y funciones de base de datos pasando en verde.
  4. Concurrencia controlada: El workflow `migrate.yml` en GitHub Actions asegura serialización mediante `concurrency: migrate-production` (`cancel-in-progress: false`).

---

### Gate 3: Variables de Entorno de Producción (`production`)

- **Objetivo:** Garantizar que todas las credenciales, URLs de servicio y secretos de entorno estén debidamente configurados en el proyecto productivo de Vercel y Supabase, validados contra el esquema Zod de `src/server/env.ts`.
- **Inventario de variables requeridas en Vercel (Environment: Production):**

| Variable | Tipo | Descripción y Restricciones |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto Supabase productivo (`https://<prod-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pública | Clave publishable/anon de Supabase para clientes browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Secreto servidor | Clave con privilegios elevados. **Confinada exclusivamente a `src/server/supabase/admin.ts`** con `import 'server-only'`. Jamás accesible en browser. |
| `PRODUCTION_APP_URL` | Servidor / CI | URL canónica de la aplicación desplegada en producción (ej. `https://cadeapp.vercel.app` o dominio propio). Requerida por `deploy.yml`. |
| `CRON_SECRET` | Secreto servidor | Clave de alta entropía para autenticar ejecuciones de `/api/cron/sweep` y `/api/cron/health` vía Header `Bearer`. |
| `DISCORD_ERROR_WEBHOOK_URL` | Secreto servidor | URL del Webhook de Discord para el despacho de alertas críticas sanitizadas de observabilidad. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Pública | API key de Google Maps con restricción HTTP Referrer exclusiva para el dominio de producción. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Pública | Clave pública para subscripción a notificaciones Web Push en browsers clientes. |
| `VAPID_PRIVATE_KEY` | Secreto servidor | Clave privada para firma de cargas Web Push en el servidor. |
| `VAPID_SUBJECT` | Servidor | Contacto mailto para identificación VAPID ante los servicios push (ej. `mailto:soporte@cadeapp.com.ar`). |

- **Restricción de seguridad:** Ningún secreto ni credencial real debe comitearse al repositorio, bitácoras, issues o PRs.

---

### Gate 4: Nota y Procedimiento de Rollback

- **Objetivo:** Tener definido, ensayado y documentado el plan de contingencia inmediata ante incidentes imprevistos tras el despliegue.
- **Directivas fundamentales:**
  1. **Rollback de Aplicación Web (Frontend / Server Actions):** Se realiza de manera instantánea revirtiendo al deployment inmediato anterior desde la consola de Vercel (o mediante `vercel rollback`). Tiempo estimado: < 2 minutos.
  2. **Rollback de Base de Datos (PostgreSQL):** La base de datos no soporta downgrade destructivo automático. Si una migración introduce un problema operativo, la corrección se efectúa **hacia adelante** mediante una nueva migración correctiva en una rama `fix/T-xxx` aprobada por `@Lautaro073`.
  3. **Nota de Rollback explícita:** Toda apertura de PR `staging → main` debe incluir en su cuerpo la sección obligatoria `### Rollback` detallando las acciones específicas a ejecutar si la nueva versión falla.

---

### Gate 5: Textos Legales y Consentimientos Publicados (`T-311`)

- **Objetivo:** Verificar que la versión pública de los documentos legales cumple la normativa argentina y que los consentimientos versionados están sincronizados con la base de datos.
- **Marco normativo contrastado:**
  1. **Protección de Datos Personales:** Ley 25.326 y Decreto 1558/2001 (art. 6 deber de información, art. 11 cesión justificada de datos de entrega, art. 14 y 16 plazos ARCO: 10 días corridos para acceso, 5 días hábiles para rectificación/supresión; tutela ante AAIP).
  2. **Defensa del Consumidor:** Ley 24.240 y Disposición 377/2026.
  3. **Firma Digital y Documentos Electrónicos:** Ley 25.506 y Decreto 182/2019.
  4. **Relación Operativa:** Ley 27.802 / art. 23 LCT (aclaración expresa de independencia del servicio de cadetería).
  5. **Normativa Tributaria:** Resoluciones Generales ARCA (ex AFIP) RG 5866/2026 y RG 5893/2026.
- **Verificaciones técnicas:**
  - Rutas públicas activas y legibles: `/terminos`, `/privacidad`, `/terminos-piloto`.
  - Configuración en `platform_settings`: La clave `pilot_terms_version` debe reflejar la versión canónica publicada (ej. `1.0`), previniendo mismatch en las Server Actions de registro y onboarding.

---

### Gate 6: Simulacro de Restauración de Backups Aprobado (`T-310`)

- **Objetivo:** Disponer de evidencia empírica irrefutable de que la plataforma puede recuperarse ante desastres sin violar la privacidad ni resucitar legajos eliminados.
- **Requisitos de aprobación:**
  1. El acta formal `docs/runbooks/acta-simulacro-restauracion-staging.md` debe estar actualizada con el veredicto **APROBADO / EXITOSO**.
  2. `@Lautaro073` debe registrar la evidencia empírica en staging:
     - Hash SHA-256 del archivo `pg_dump` exportado.
     - Logs limpios de ejecución de `pg_restore --clean --if-exists`.
     - Medición cronometrada de RTO real (< 30 minutos).
     - **Verificación de Aislamiento de Storage (`D8`):** Comprobación de que binarios de prueba previamente purgados en `courier-docs` retornan HTTP 404 tras restaurar la base de datos PostgreSQL, demostrando la imposibilidad de copias fantasma.
     - Confirmación de recepción de alerta de prueba en Discord.
     - Respuesta HTTP 200 en `/api/health`.

---

### Gate 7: Revisión de Seguridad Independiente (`supabase/` y `src/server/`)

- **Objetivo:** Realizar una auditoría técnica especializada sobre el diff acumulado entre `main` y `staging` para descartar vulnerabilidades antes de la apertura pública.
- **Focos obligatorios de la revisión:**
  1. **Políticas RLS en PostgreSQL:** Verificación exhaustiva de que ninguna tabla carece de RLS (`supabase/tests/rls_enabled.sql`), no existen policies permisivas sin filtro de rol/uid, y la tabla de contactos sensibles (`delivery_request_contacts`, `delivery_request_drop_contacts`) solo es accesible tras la aceptación formal de la oferta (`matched`).
  2. **Funciones `SECURITY DEFINER`:** Chequeo de que todas poseen `SET search_path = public`, grants mínimos y validación explícita de `auth.uid()`.
  3. **Confinamiento de Claves:** Confirmación de que `SUPABASE_SERVICE_ROLE_KEY` solo se importa en `src/server/supabase/admin.ts` y que ningún componente cliente o endpoint público filtra datos privilegiados.
  4. **Sanitización de Observabilidad:** Inspección del módulo `src/server/observability/scrubber.ts` confirmando la redacción garantizada de emails, teléfonos, DNI, tokens JWT y coordenadas geográficas sensibles en logs y alertas de Discord.
  5. **Informe de Seguridad:** Documentar el informe de hallazgos (con clasificación de severidad y mitigaciones) en `docs/revision-pr/` o adjunto en el PR de release.

---

### Gate 8: Aprobación Formal y Exclusiva de `@Lautaro073`

- **Objetivo:** Respetar el esquema de gobernanza y responsabilidad del proyecto definido en `AGENTS.md` §2 y `implementation-plan.md` §2.
- **Condición excluyente:**
  - El PR de release `staging → main` **solo puede ser aprobado y fusionado por `@Lautaro073`**.
  - Los workflows de CI/CD (`migrate.yml` y `deploy.yml`) requieren la intervención manual y aprobación del environment `production` por el actor autorizado `Lautaro073`. Cualquier intento de disparo por otro actor aborta automáticamente con código de error.

---

## 3. Procedimiento Operativo Paso a Paso (La Ejecución del Release)

### Paso 1: Congelamiento de Cambios y Verificación de Staging
1. Anunciar en el canal del equipo el inicio de la ventana de release.
2. Confirmar que no hay PRs en vuelo hacia `staging` o `develop`.
3. Validar localmente que la rama `staging` remota esté limpia y al día con `develop`.

```bash
git fetch origin
git log origin/staging..origin/develop --oneline
```
*(Si hay commits en develop no integrados a staging, debe cerrarse previamente la promoción semanal `develop → staging`)*.

---

### Paso 2: Ejecución Local de Comprobación de Calidad
Desde una copia limpia y actualizada de `origin/staging`:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```
*Los tres comandos deben finalizar con código de salida 0 sin advertencias ni omisiones.*

---

### Paso 3: Apertura del Pull Request `staging → main`
1. Abrir el PR de release desde GitHub CLI o la interfaz web:

```bash
gh pr create \
  --base main \
  --head staging \
  --title "[RELEASE] v1.0.0 — Promoción staging a producción" \
  --body-file docs/runbooks/release-pr-body.md
```

2. El cuerpo del PR debe estructurarse conforme a la plantilla oficial de `.github/pull_request_template.md` conteniendo:
   - Resumen del alcance y versiones de contratos.
   - Estado de los 8 gates del DoD.
   - Enlace al run verde de `e2e-staging`.
   - Evidencia de checks locales y de CI.
   - Informe de seguridad independiente adjunto.
   - Nota y procedimiento explícito de rollback.

---

### Paso 4: Monitoreo de Gates Automáticos en GitHub Actions
1. **Verificación de CI (`ci.yml`):** Esperar a que finalicen en verde los jobs paralelos (`typecheck`, `lint`, `unit`, `db-tests`, `build`).
2. **Verificación de E2E Staging (`e2e-staging.yml`):** Comprobar que la suite Chromium completa pasa en staging.

---

### Paso 5: Aprobación Humana y Fusión a `main`
1. `@Lautaro073` revisa el checklist del PR y el diff consolidado.
2. `@Lautaro073` emite la aprobación formal del Pull Request en GitHub.
3. Se realiza la fusión (`Merge pull request`) hacia la rama `main`.

---

### Paso 6: Despliegue de Base de Datos y Aplicación en Producción
Tras el merge a `main`, GitHub Actions orquesta el despliegue automático:

1. **Migraciones (`migrate.yml`):**
   - El job `migrate-production` solicita la aprobación del reviewer en el environment `production`.
   - `@Lautaro073` aprueba la ejecución en la interfaz de GitHub Actions.
   - El workflow aplica `supabase db push` contra el proyecto Supabase de producción.
2. **Despliegue a Vercel (`deploy.yml`):**
   - Tras el éxito de `migrate-production`, se dispara el job `production` en `deploy.yml`.
   - Se valida la guarda de actor: `RUN_ACTOR == 'Lautaro073'`.
   - Se ejecuta:
     ```bash
     pnpm dlx vercel@61.0.0 pull --yes --environment=production
     pnpm dlx vercel@61.0.0 build --prod
     pnpm dlx vercel@61.0.0 deploy --prebuilt --prod
     ```
   - Se ejecuta el Health Check post-deploy:
     ```bash
     curl --fail --retry 6 --retry-delay 10 --retry-all-errors "$PRODUCTION_APP_URL/api/health"
     ```

---

### Paso 7: Smoke Testing y Verificación Post-Release
Una vez que el despliegue responde exitosamente:

1. **Comprobación de Rutas Críticas:**
   - Acceso a página de inicio `/` (landing pública).
   - Acceso a `/login` y `/register`.
   - Acceso y renderizado correcto de `/terminos`, `/privacidad`, `/terminos-piloto`.
   - Endpoint `/api/health` respondiendo `{ "status": "ok" }` con latencia normal.
2. **Comprobación del Cron:**
   - Confirmar en el panel de Vercel la programación activa de `/api/cron/sweep` y `/api/cron/health`.
3. **Monitoreo de Observabilidad:**
   - Monitorear el canal de Discord (`DISCORD_ERROR_WEBHOOK_URL`) durante al menos 60 minutos posteriores a la salida para constatar ausencia de alertas de excepción no controladas (`publish_request`, `submit_offer`, `accept_offer`, transiciones de estado).

---

## 4. Plan de Contingencia y Rollback de Emergencia

Si se detecta un fallo crítico tras el despliegue (ej. errores HTTP 500 generalizados, brecha de seguridad, bloqueo masivo en la autenticación o incapacidad operativa de publicar solicitudes):

### 4.1. Rollback Inmediato de Aplicación (Vercel)
1. Ingresar a la consola de Vercel → Proyecto `cadeapp` → Pestaña **Deployments**.
2. Ubicar el deployment inmediatamente anterior que funcionaba de forma estable.
3. Hacer clic en los tres puntos (`...`) y seleccionar **Instant Rollback** (o **Promote to Production**).
4. El tráfico de producción se redirige de inmediato a la versión anterior (< 60 segundos).

### 4.2. Corrección de Base de Datos
- Las migraciones previas no deben revertirse con comandos manuales descontrolados en la base de datos de producción.
- Si una columna o función introdujo un bloqueo:
  1. Abrir de inmediato una rama de hotfix: `fix/T-xxx-slug` desde `main`.
  2. Escribir una migración compensatoria hacia adelante que resuelva el defecto.
  3. Ejecutar pruebas locales y abrir PR urgente con visto bueno de `@Lautaro073`.
  4. Mergear a `main` y back-mergear de inmediato a `staging` y `develop` el mismo día (regla de hotfix de `implementation-plan.md` §6).

### 4.3. Notificación del Incidente
- Registrar el incidente en `docs/tasks/log/` y notificar al equipo en el canal oficial para análisis post-mortem.
