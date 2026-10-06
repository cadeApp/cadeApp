# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 6 · CON BLOQUEANTES (1) · H05/H06 cerrados

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA revisado | `bce333fede77737a66d3afae8b43a19ce6dc8747` |
| `develop` actual | `3a1de345eaf71ab1aeff060ead097d9d6442ac81` |
| Sincronización | 22 ahead / 33 behind |
| CI | `37433113069` · GREEN |
| e2e-preview | `37433304282` · 35 passed / 1 failed |
| approval-policy | `37433110341` · GREEN |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01 — cobertura completa de `(merchant)`.
- ✅ H02 — doble error test/cleanup.
- ✅ H03 — checklist/evidencia coherentes.
- ❌ H04 — falta baseline GREEN + probe D02-A + revert + GREEN final.
- ✅ H05 — teardown reconcilia el usuario por email exacto antes de limpiar.
- ✅ H06 — rol merchant probado con RED discriminante y revert GREEN.
- ✅ H07 — SMTP queda como hipótesis, no causa confirmada.
- ✅ H08 — body sigue la plantilla obligatoria.

## Condiciones de cierre

- Sincronizar los 33 commits nuevos de `develop` (solo T-308/incidents + documentación; no cambian runtime T-313).
- Actualizar el body con la evidencia actual del HEAD.
- Obtener visto bueno explícito P3.
- Resolver manualmente el entorno Supabase Develop para que el alta E2E no dependa de correo real.

No apruebo ni mergeo.
