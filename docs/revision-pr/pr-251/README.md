# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 10 · CON BLOQUEANTES (3) · H04 + H10 + H11

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA funcional base | `4f3dacd01dc350c36f937a629ddfd6bf1f2a9f78` |
| Commit de revisión ronda 9 | `8746eba32d4519ed828c5190bad03ede3d84f7db` |
| `develop` actual | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| Sincronización antes de esta revisión | 31 ahead / 1 behind |
| CI | `37576126221` · GREEN |
| approval-policy | `37576188205` · GREEN |
| e2e-preview funcional | `37575010421` sobre `9cd4bdb` · 45 passed / 1 failed |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01–H03.
- ❌ H04 — falta baseline GREEN + D02-A RED + revert + GREEN final.
- ✅ H05–H09.
- ❌ H10 — body aún tiene contradicción `pnpm test`/informe y rollback desactualizado.
- ❌ H11 — incompatibilidad productiva action/RLS en merchant onboarding.

## Decisión vigente

**D03-A — corregir H11 dentro de PR #251.**

Corrección autorizada:
- action pasa de UPSERT a UPDATE autenticado sobre la fila `merchants` precreada;
- no se agrega INSERT self;
- no se usa admin/service role para saltar RLS;
- `notes` se habilita para el dueño;
- `subscription_status` y `paid_until` siguen protegidos;
- unit + pgTAP prueban la regresión.

## Aclaración operativa de ronda 10

`migrate.yml` aplica migraciones a Supabase Develop **solo después del merge a `develop`**. Una feature branch no puede ni debe aplicar su migración al proyecto Develop compartido.

Por lo tanto:
- la migración RLS se valida pre-merge con `db-tests` contra la base local de CI;
- el trusted Preview pre-merge valida el flujo normal con la action corregida;
- no se exige que el E2E pre-merge escriba `notes` no vacías, porque esa parte de la policy nueva todavía no existe en Develop hasta el merge;
- está prohibido aplicar manualmente la migración de la feature a Supabase Develop para “hacer pasar” el Preview.

No apruebo ni mergeo.
