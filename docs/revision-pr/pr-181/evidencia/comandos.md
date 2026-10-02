# Evidencia — PR #181 / CC-015 / Ronda 1

## Preflight

```text
SHA funcional: da5f02c0238271c7e41b6e0aba9671bdda098189
develop actual: 298a365184adfe95ac33b3549302695af6b61f91
merge-base: 1457072a7cac1ae9e2a8a92abe9253d45b745082
ahead: 5
behind: 32
comentarios/reviews/threads: 0
```

Archivos funcionales del PR:

```text
docs/contracts/CC-015.md
src/domain/domain.test.ts
src/domain/rpc-contracts.ts
src/domain/states/index.ts
src/domain/testing/rpc-fake.ts
supabase/migrations/20260924010124_rpc_requests_v1.sql
supabase/migrations/20260925170000_cc007_consent_enforcement.sql
supabase/tests/rpc_requests.sql
```

## Deployability de migraciones

El PR modifica dos archivos de migración ya versionados y no agrega una migración CC-015 nueva.

```text
20260924010124_rpc_requests_v1.sql: gate CC-015 agregado en L131
20260925170000_cc007_consent_enforcement.sql: gate CC-015 agregado en L801
nueva migración CC-015: ausente
```

Resultado de análisis: una base nueva ejecutaría el gate; una base que ya registró esas versiones no las reejecutaría. Por eso la corrección debe ser append-only con una migración nueva.

## Trazabilidad

```text
CC-015 issue: no existe
PR: #181
docs/contracts/CC-015.md L3: usa #181 como "Issue / PR"
docs/contracts/CC-015.md L5: T-304 (#153, PR #179)
T-304 real: issue #36
#153: T-319
#36 labels actuales: P2, fase-3, en-curso
```

## Contradicción de error

```text
docs/contracts/CC-015.md L42:
merchant y courier -> INVALID_STATE_TRANSITION

supabase/tests/rpc_requests.sql L482:
courier -> UNAUTHORIZED_ACTOR
```

La prueba refleja la precedencia canónica: courier ni siquiera es rol permitido para cancel_request.

## Evidencia RED ausente

```text
primer commit: 84cda507 feat(contracts): admin cancel in_transit requires registered incident
incluye implementación y tests en el mismo commit
body: sin run RED, mutación, test caído ni salida reproducible
```

## Runtime de esta revisión

No se ejecutó Docker/Supabase local y no se consultó CI porque la ronda ya tiene bloqueantes. La validación de DB debe hacerse en el job `db-tests` tras aplicar la migración nueva.

## Mutaciones obligatorias para la corrección

1. Sin la migración nueva CC-015, pgTAP “admin sin incidente” debe fallar contra el comportamiento anterior.
2. Con la migración nueva, debe quedar GREEN.
3. Quitar temporalmente el `NOT EXISTS(public.incidents...)` de la migración nueva: el test sin incidente debe ponerse rojo.
4. Quitar temporalmente el gate del fake/dominio: los unitarios deben ponerse rojos.
5. Restaurar todas las mutaciones y correr suite final.
