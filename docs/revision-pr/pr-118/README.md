# Revisión independiente — PR #118 · T-206

- **PR:** #118 · `feat/T-206-cableado-push` → `develop`
- **Ronda actual:** 3
- **SHA de producto revisado:** `6980fb095b3605663ad658e8c885ed2b7906df3b`
- **develop actual:** `c91ec4e304de0d983cd31be3c77acecf374304bf`
- **Estado:** **CON BLOQUEANTES**
- **Decisiones:** D01 = 1-A · D02 = 2-A.
- **Aprobación/merge:** no realizados.

## Cerrados por inspección + CI

- H04: builders de query semánticos + predicados exactos implementados.
- H06: `getUser()` y purga están dentro del best-effort; `signOut()` queda afuera.
- R01: `.select('request_id, courier_id')` es directo e incondicional.
- M01: db-tests correctamente distinguidos de ejecución local.

## Abiertos

- **H05:** batería RED incompleta; faltan mutaciones mínimas pedidas y el RED “sin decided_at” registrado cae primero por aserción estructural, no por histórico extra.
- **H07 (parcial):** errores `{ error }` están cubiertos, pero `cancel_request` no falla cerrado si un lookup crítico devuelve `data:null,error:null`.
- **M02:** body de PR desfasado; CI del SHA revisado dio 93/93 files y 1275/1275 tests.
- **Sincronización:** rama 1 commit detrás de develop; debe mergear `origin/develop` antes de la siguiente ronda.

## Alcance aceptado

**PR118-A01 — aceptado.** `src/app/api/cron/sweep/route.test.ts` estaba fuera de la ficha/lista cerrada. Lautaro073 decidió D02=2-A: conservar el cambio test-only que adapta el mock al select obligatorio. No habilita otros desvíos.

## CI

Run `36461968118`: success.
- unit: 93/93 files · 1275/1275 tests
- verify-workflows: 22
- verify-adr: 6
- db-tests: 12 files · 1601 tests · PASS
- typecheck/lint/build/audit/bundle-budget: success
