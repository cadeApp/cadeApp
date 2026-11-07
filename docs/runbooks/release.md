# Runbook — Release `staging → main` (producción)

> T-312. Checklist que se completa en cada release a producción. La aprueba y la ejecuta **solo Lautaro073**, desde
> las consolas web con 2FA (plan §2 y §6, regla 50). Nunca pegues claves, tokens, contraseñas, códigos TOTP ni URLs de
> base en el repo, issues, PR, bitácoras o chats: en este documento solo van **nombres** de variables y evidencia sin
> secretos (links a runs, SHAs, fechas).

## 0. Cómo se usa

1. Se copia la sección 8 («Registro de la release») al cuerpo de la PR `staging → main` y se completa ahí.
2. La PR se abre en **Draft**. No sale del Draft hasta que todas las casillas de las secciones 1 a 5 están marcadas
   con su evidencia.
3. El día de la release se sigue la sección 6 en orden; si un paso falla, se para y se aplica la sección 7.

Qué pasa al mergear (`.github/workflows/migrate.yml` y `deploy.yml`):

| Orden | Workflow / job | Qué hace | Condición |
|---|---|---|---|
| 1 | `migrate` → `migrate-production` | `supabase link` + `supabase db push --yes` contra `cadeapp-prod` | push a `main` hecho por **Lautaro073** (`GITHUB_ACTOR`), aprobación del environment `production`, `SUPABASE_PRODUCTION_PROJECT_REF` distinto del ref de staging |
| 2 | `deploy` → `deploy-production` | `vercel pull/build/deploy --prod` en el proyecto de producción y `GET $PRODUCTION_APP_URL/api/health` | `migrate` en `success`, mismo actor, aprobación del environment `production` |
| 3 | `health-cron` → `health-cron-production` | `/api/cron/health` cada 10 minutos | existe la variable `PRODUCTION_APP_URL` |

Consecuencias:
- Las migraciones se aplican **antes** que el código. Si `deploy-production` falla, la base queda adelante de la app:
  cada migración tiene que ser compatible con la versión anterior de la app (checklist de esquema de las fichas).
- Si mergea otra persona, `migrate-production` falla en el primer paso y no toca la base. Se vuelve a correr cuando
  Lautaro073 lo dispare (re-run del workflow o un commit suyo en `main`).
- `supabase/seed.sql` **no** se aplica en producción: los barrios (`20261003130000_t326_aguilares_zones.sql`), los
  buckets y `platform_settings` vienen en las migraciones.

## 1. Código y calidad (gate técnico)

- [ ] `staging` está en el SHA que se va a promover y la PR `staging → main` apunta a ese SHA.
- [ ] En ese SHA de `staging` están en verde:
  - `CI` (`typecheck`, `lint`, `unit`, `db-tests`, `build`, `audit`, `bundle-budget`);
  - `migrate-staging`, que además verifica que `src/types/database.types.ts` no tiene drift contra staging;
  - `deploy` (`deploy-staging` con `/api/health` y `e2e-staging`, la suite E2E completa contra staging).
- [ ] `main` es ancestro de `staging` (sin conflictos). Si no lo es, se para: un hotfix sin back-merge (§6 del plan).
- [ ] Migraciones nuevas desde la release anterior: listadas en la PR, cada una con su ficha o CC y su nota de
      compatibilidad con la app anterior.
- [ ] Issues abiertos con etiqueta `bug` o `alto-riesgo` revisados: cada uno es «bloquea» o «no bloquea, con motivo».

## 2. Producción configurada (lo hace Lautaro073 desde las consolas)

### 2.1 GitHub — environment `production`
- [ ] Required reviewer: Lautaro073.
- [ ] Secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`,
      `CRON_SECRET`.
- [ ] Variables: `SUPABASE_PRODUCTION_PROJECT_REF` (ref de `cadeapp-prod`), `SUPABASE_PROJECT_REF` (ref de staging,
      que el job usa para comprobar que no son el mismo) y `PRODUCTION_APP_URL` (sin `/` final).

### 2.2 Supabase — proyecto `cadeapp-prod`
- [ ] Proyecto propio, distinto de `cadeapp-staging`, en la misma región.
- [ ] Auth:
  - Site URL = `PRODUCTION_APP_URL`; redirect URLs solo del dominio de producción;
  - confirmación de email y plantillas en español;
  - MFA TOTP habilitado (las rutas y RPC `admin_*` exigen `aal2`);
  - SMTP propio si el volumen de emails lo exige (el SMTP de Supabase tiene límite bajo).
- [ ] Backups según `docs/runbooks/backups-and-disaster-recovery.md` (plan, retención y, si aplica, PITR).
- [ ] Nadie más que Lautaro073 tiene acceso de owner; la service role y la contraseña de la base no salen de las
      consolas y del environment.

### 2.3 Vercel — proyecto de producción
Variables de entorno de **Production**, con los mismos nombres que `.env.example` y valores propios de producción:
- [ ] `NEXT_PUBLIC_APP_URL` = `PRODUCTION_APP_URL`.
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: de `cadeapp-prod`.
- [ ] `DNI_HMAC_SECRET`: **nuevo**, generado para producción y guardado fuera del repo. No se reutiliza el de
      staging. Si se pierde, la deduplicación de DNI deja de reconocer a los repartidores ya registrados.
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: par **nuevo** de producción.
- [ ] `CRON_SECRET`: el mismo valor que el secret del environment `production` (lo usan el cron de Vercel y
      `health-cron`).
- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (y `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` si se usa): restringida por referrer al
      dominio de producción, solo «Maps JavaScript API» y con cuota diaria.
- [ ] `DISCORD_ERROR_WEBHOOK_URL`: canal de alertas de producción.
- [ ] `CADEAPP_SUPPORT_WHATSAPP_NUMBER`: número real de soporte.
- [ ] `RPC_ADAPTER=real`, `NEXT_PUBLIC_ENABLE_MOCK_MAPS=false`, `COURIER_DOCS_ORPHAN_PURGE_MODE=dry-run` (se pasa a
      `enforce` recién después de revisar un dry-run en producción, CC-030).
- [ ] Sentry opcional: `NEXT_PUBLIC_SENTRY_DSN` y `SENTRY_ENVIRONMENT=production`, o vacíos.
- [ ] Dominio de producción asignado y con HTTPS; el cron de `vercel.json` (`/api/cron/sweep`, diario) aparece en
      el proyecto.

## 3. Seguridad

- [ ] Revisión de seguridad **independiente** de `supabase/migrations/**` y `src/server/**` sobre el diff acumulado
      desde la release anterior (en la primera release, todo), con el rol security de El Consejo. El informe va
      enlazado en la PR y no tiene bloqueantes abiertos.
- [ ] `pnpm audit --audit-level=high` sin hallazgos en el SHA (job `audit`).
- [ ] La service role solo aparece en `src/server/supabase/admin.ts` (`import 'server-only'`); ninguna variable
      `NEXT_PUBLIC_*` lleva un secreto.

## 4. Operación

- [ ] Simulacro de restauración hecho y con acta firmada (`docs/runbooks/acta-simulacro-restauracion-staging.md`,
      T-310), con fecha de los últimos 90 días.
- [ ] Alerta de prueba recibida en el canal de Discord de producción.
- [ ] `health-cron-production` habilitado (existe `PRODUCTION_APP_URL`) y su primera corrida en verde después del
      deploy.
- [ ] Quién está de guardia las primeras 48 h y cómo se lo contacta.

## 5. Legal y producto

- [ ] Términos, privacidad y términos del piloto (T-311) publicados y revisados contra la normativa vigente, con la
      fecha de la revisión.
- [ ] Versiones de consentimiento de producción definidas (la de `pilot_terms_version` y la de cada documento).
- [ ] Valores iniciales de `platform_settings` decididos: `min_offer_ars`, `request_ttl_minutes`, `pilot_active`,
      días de gracia, `pilot_terms_version`, máximo de entregas y parámetros de créditos.

## 6. Día de la release (en orden)

1. Verificar que las secciones 1 a 5 están completas en la PR y que `staging` no se movió desde la última
   comprobación.
2. Lautaro073 saca la PR del Draft, la aprueba y la mergea **con merge commit** (sin squash ni rebase).
3. Aprobar el environment `production` para `migrate-production` y seguir el log hasta el final. Registrar el link
   del run y la cantidad de migraciones aplicadas.
4. Aprobar el environment `production` para `deploy-production`. Registrar la URL del deployment y el `/api/health`
   en verde.
5. Crear el admin de producción siguiendo `docs/runbooks/admin-bootstrap.md` **contra el proyecto de producción**
   (el runbook está escrito para staging: se cambian el proyecto y las variables públicas, nunca se usa la service
   role).
6. Ajustar `platform_settings` desde `/admin/settings` con los valores de la sección 5 (queda en la auditoría).
7. Smoke manual en producción, con cuentas reales del equipo:
   - registro de comercio y de repartidor, con consentimientos;
   - aprobación del repartidor desde el admin (con MFA) y vista auditada de un documento;
   - publicación de una solicitud, oferta, aceptación, retiro y entrega;
   - push recibido en un dispositivo y aviso visible en la app;
   - incidente reportado y visible en `/admin/incidents`;
   - cron: `/api/cron/sweep` aparece en Vercel y `health-cron-production` en verde.
8. Avisar en el canal del equipo que la release está hecha, con el SHA y la nota de rollback.

## 7. Rollback

- **App:** en Vercel, «Instant Rollback» al deployment anterior de producción. En la **primera** release no hay
  anterior: se saca el dominio del deployment o se activa la protección del proyecto mientras se corrige.
- **Base:** nunca se revierte a mano ni se borra una migración aplicada. Se corrige con una migración nueva hacia
  adelante, que entra por `develop → staging → main` (o como hotfix según §6 del plan). Restaurar un backup solo ante
  pérdida o corrupción de datos, siguiendo `backups-and-disaster-recovery.md`.
- **Configuración:** un valor de `platform_settings` se vuelve atrás desde `/admin/settings`; una variable de Vercel,
  redeployando el deployment vigente después de corregirla.
- Cada release completa su **nota de rollback** en la sección 8: qué deployment es el anterior, qué migraciones
  entraron y si alguna no es compatible con la app anterior.

## 8. Registro de la release (copiar a la PR)

```text
Release: <fecha> · staging@<sha> → main
PR: #<n> · Aprobada y mergeada por: Lautaro073

1. Código y calidad
   - CI: <run> · migrate-staging: <run> · deploy + e2e-staging: <run>
   - Migraciones nuevas: <lista o «ninguna»>
   - Issues bug/alto-riesgo: <lista con bloquea / no bloquea>
2. Producción configurada: GitHub env ✅/❌ · Supabase ✅/❌ · Vercel ✅/❌ (fecha y quién verificó)
3. Seguridad: informe <link> · audit ✅/❌
4. Operación: simulacro <fecha del acta> · alerta Discord ✅/❌ · guardia <quién>
5. Legal y producto: textos <fecha de revisión> · settings iniciales <valores>
6. Ejecución: migrate-production <run> (<n> migraciones) · deploy-production <run> · /api/health ✅/❌ · smoke ✅/❌
7. Nota de rollback: deployment anterior <id o «ninguno, primera release»> · migraciones no compatibles hacia atrás: <lista o «ninguna»>
```
