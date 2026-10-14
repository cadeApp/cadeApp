# PR #251 · T-313 — Ronda 11

- **SHA revisado:** `9d0556ab56f581f95850fbbd319d0908f88d97e1`
- **Fecha:** 2026-10-07
- **Resultado:** CON BLOQUEANTES (2) + P3 pendiente
- **Hallazgos nuevos:** 0
- **Hallazgos cerrados:** H11
- **Decisión nueva:** D04-A

## 1. Sincronización y alcance

La rama está sincronizada con develop:

```text
develop = 284683b65e25e10b94e9286a03b4fc85a2cfada3
HEAD    = 9d0556ab56f581f95850fbbd319d0908f88d97e1
ahead   = 42
behind  = 0
mergeable = true
```

Los cambios manuales propios de T-313 siguen dentro del alcance autorizado por D03-A:
- `docs/tasks/T-313.md`
- `docs/tasks/log/T-313.md`
- `e2e/specs/merchant-registration.spec.ts`
- `src/features/merchants/actions.ts`
- `src/features/merchants/actions.test.ts`
- `supabase/migrations/20261007081131_t313_merchant_onboarding_update_policy.sql`
- `supabase/tests/rls_matrix.sql`
- `docs/revision-pr/pr-251/**`

Los archivos T-347 visibles en el historial/diff intermedio llegaron desde `develop`, no son edición manual de T-313.

## 2. H11 — corregido y verificado

### Action

`merchantOnboardingAction` ya no usa UPSERT para `merchants`.

El write actual:
- usa UPDATE;
- filtra por `profile_id = user.id`;
- selecciona `profile_id`;
- usa `maybeSingle()`;
- devuelve `INTERNAL_ERROR` ante error o cero filas.

El payload incluye solo:
- `business_name`
- `default_pickup_address`
- `default_pickup_lat`
- `default_pickup_lng`
- `default_pickup_zone_id`
- `notes`

No incluye:
- `profile_id`
- `subscription_status`
- `paid_until`

No usa service role/admin para persistir `merchants`.

### RLS

La migration nueva recrea `merchants_update_self`:
- ownership: `profile_id = auth.uid()`;
- actor operativo activo;
- conserva congelados `subscription_status` y `paid_until`;
- elimina únicamente la congelación de `notes`;
- no crea policy INSERT.

### RED previo

CI `37591045310` sobre `ced6acd` demostró:
- unit RED porque producción todavía llamaba `.upsert()`;
- pgTAP RED en `merchant can update business_name and notes` con SQLSTATE 42501.

### GREEN actual

CI `37668929864` sobre el HEAD actual:
- unit ✅
- db-tests ✅
- typecheck ✅
- lint ✅
- build ✅
- audit ✅
- bundle-budget ✅

Unit:
```text
src/features/merchants/actions.test.ts · 13 tests passed
123 test files passed
1942 tests passed
```

pgTAP:
- `select plan(65)`;
- `db-tests` termina `Result: PASS`;
- migration `20261007081131_t313_merchant_onboarding_update_policy.sql` se aplica en la base local del job.

H11 queda **arreglado-verificado** en `9d0556a`.

## 3. H04 — bloqueado por el diseño del Preview

Vercel del HEAD está GREEN, pero el trusted Preview `37669080365` no ejecutó Playwright.

`resolve-preview` imprime:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

y el job `e2e-preview` queda skipped.

Esto es comportamiento deliberado de `.github/workflows/e2e-preview-target.mjs`: cualquier PR con un archivo bajo `supabase/migrations/**` queda bloqueada porque Supabase Develop es compartido y la migration de una feature no se aplica allí.

Por lo tanto no existe un camino válido para cerrar H04 mientras #251 conserve su migration.

## 4. Decisión D04-A — Lautaro073

Lautaro073 elige la opción A:

> Separar únicamente la migration RLS de H11 y su cobertura pgTAP en una PR previa.

### PR previa

Debe partir de la punta actual de `develop`, no de #251.

Contenido funcional:
- `supabase/migrations/20261007081131_t313_merchant_onboarding_update_policy.sql`
- cambio T-313/H11 de `supabase/tests/rls_matrix.sql`

Puede incluir únicamente la ficha/bitácora necesaria para documentar ese subalcance.

No debe incluir:
- `src/features/merchants/actions.ts`
- `src/features/merchants/actions.test.ts`
- `e2e/specs/merchant-registration.spec.ts`
- ningún archivo productivo ajeno.

La evidencia RED/GREEN ya obtenida para la policy debe preservarse en la bitácora; no se fabrica otra prueba.

### Después del merge de la PR previa

1. esperar `migrate-develop` GREEN;
2. #251 hace merge normal de `origin/develop`;
3. migration + cambio pgTAP quedan incorporados por develop y desaparecen del diff de #251;
4. #251 conserva action + unit tests + E2E;
5. esperar Vercel + trusted `e2e-preview`;
6. exigir los 3 casos T-313 GREEN.

No hacer rebase ni force-push.

## 5. H04 después del split

Solo con baseline normal GREEN se continúa la demostración RED pendiente.

La autorización D02-A previa sigue registrada, pero debe revalidarse operativamente contra el mecanismo vigente antes de ejecutar cualquier mutación. No se toca `src/features/auth/guards.ts` mientras el baseline no esté GREEN.

## 6. H10

El body mejoró:
- CI actual GREEN;
- explica H11;
- rollback ya reconoce la migration.

Pero no puede cerrarse todavía porque:
- sigue citando un Preview histórico rojo;
- no existe baseline E2E posterior a H11;
- debe actualizarse al split D04-A y luego a los runs finales.

## 7. P3

El comentario `5999858656` es una solicitud, no un visto bueno.

No hay review/comentario explícito de P3 sobre la versión final del spec.

## 8. e2e-mutation heredado de T-347

Los runs automáticos con nombre `.github/workflows/e2e-mutation.yml` que aparecen como failure en pushes de esta rama no corresponden a código propio de T-313.

El workflow mergeado en develop solo declara `repository_dispatch`; estos runs sin jobs no se usan como evidencia ni como bloqueante de #251.

## Veredicto

**CON BLOQUEANTES (2): H04 + H10.**

Además, P3 sigue pendiente.

No apruebo ni mergeo.
