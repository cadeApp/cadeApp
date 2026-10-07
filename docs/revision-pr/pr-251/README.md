# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 11 · CON BLOQUEANTES (3) · H04 + H10 + H11

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA revisado | `ced6acd316398707f626de0cc30db3ed1e34da79` |
| Commit previo de revisión | `be7aa1839483ad6c0b72148535076006c692d211` |
| `develop` actual | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| Sincronización | 35 ahead / 0 behind |
| CI | `37591045310` · RED esperado |
| approval-policy | `37591041573` · GREEN |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01–H03.
- ❌ H04 — espera H11 GREEN + baseline E2E GREEN + D02-A RED + revert + GREEN final.
- ✅ H05–H09.
- ❌ H10 — body final todavía pendiente.
- ❌ H11 — fase RED verificada; falta implementar action + migration y llevar unit/db-tests/Preview a GREEN.

## Fase RED H11 — verificada

CI `37591045310` falla exactamente en las dos barreras esperadas:

- **unit** `112692332103`: 2 tests de `actions.test.ts` fallan porque producción todavía llama `.upsert()`; los nuevos fakes solo exponen el contrato UPDATE.
- **db-tests** `112692332530`: pgTAP falla únicamente en `merchant can update business_name and notes` con `42501 new row violates row-level security policy`.

Typecheck, lint, build, audit y bundle-budget pasan.

No se tocaron `actions.ts` ni migraciones todavía. No se ejecutó D02-A.

## Veredicto

La fase RED es válida. Se autoriza avanzar a la fase GREEN de D03-A.

No apruebo ni mergeo.
