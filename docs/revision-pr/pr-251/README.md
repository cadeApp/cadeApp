# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 5 · CON BLOQUEANTES (3) · H07/H08 cerrados

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA revisado | `1b23706d743664851fe7bf44e7a4c81d67577e55` |
| `develop` actual | `865a82fbaeb2249e41f9ba22e4ec66a78b9b6f57` |
| Sincronización | 16 ahead / 4 behind |
| CI | `37375915213` · GREEN |
| e2e-preview | `37376151360` · cancelado antes de Playwright |
| approval-policy | `37375911376` · GREEN |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01 — cobertura completa de `(merchant)`.
- ✅ H02 — doble error test/cleanup.
- ✅ H03 — checklist/evidencia coherentes.
- ❌ H04 — falta baseline GREEN + probe D02-A + revert + GREEN final.
- 🟠 H05 — arreglo parcial: sigue existiendo carrera/ventana de cleanup.
- 🟠 H06 — aserción agregada, pero RED comportamental no demostrado.
- ✅ H07 — bitácora ya no presenta SMTP como causa confirmada.
- ✅ H08 — body ya sigue la plantilla obligatoria.

## Condiciones externas

- Sincronizar los 4 commits nuevos de `develop` antes del cierre final.
- Visto bueno explícito P3 aún pendiente.

No apruebo ni mergeo.
