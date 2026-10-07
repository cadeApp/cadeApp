# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 9 · CON BLOQUEANTES (3) · H04 + H10 + H11

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA funcional revisado | `4f3dacd01dc350c36f937a629ddfd6bf1f2a9f78` |
| Commit previo de revisión | `b0e0821f9c1f0d62698c1cd97180795e764c385b` |
| `develop` actual | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| Sincronización | 31 ahead / 1 behind |
| CI | `37576126221` · GREEN |
| approval-policy | `37576188205` · GREEN |
| e2e-preview funcional | `37575010421` sobre `9cd4bdb` · 45 passed / 1 failed |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01 — cobertura completa de `(merchant)`.
- ✅ H02 — doble error test/cleanup.
- ✅ H03 — checklist/evidencia coherentes en la ronda que lo cerró.
- ❌ H04 — falta baseline GREEN + D02-A RED + revert + GREEN final.
- ✅ H05 — cleanup robusto del alta.
- ✅ H06 — rol merchant demostrado con RED/revert.
- ✅ H07 — causa SMTP no sobreatribuida.
- ✅ H08 — body con template.
- ✅ H09 — selector de alert acotado al formulario y revalidado.
- ❌ H10 — el body ya tiene evidencia nueva, pero el informe embebido aún declara `test ❌` pese a registrar 122 archivos/1940 tests pasados y el rollback todavía afirma que la PR no toca producción.
- ❌ H11 — el onboarding usa `upsert` sobre una fila `merchants` que ya crea el trigger, bajo RLS sin INSERT para merchant; además la policy congela `notes` aunque el formulario permite editarlas.

## Decisión de Lautaro073

**D03-A — corregir el bug productivo dentro de PR #251.**

Se amplía de forma explícita y mínima el alcance de T-313 para resolver la incompatibilidad action/RLS descubierta por el E2E. La corrección debe:
- usar UPDATE autenticado sobre la fila `merchants` preexistente;
- no agregar una policy INSERT para merchants;
- no usar service role/admin para saltar RLS;
- permitir que el dueño edite `notes`, porque forman parte del onboarding;
- conservar bloqueados `subscription_status` y `paid_until`;
- agregar unit + pgTAP + E2E que cubran la regresión.

No apruebo ni mergeo.
