# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 4 · CON BLOQUEANTES (5) · 3 cerrados · 5 abiertos

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA revisado | `c175443f2b7eb76f99a1185a4a1f28f0ea703808` |
| Base `develop` | `f1ae16106e61bbb6707b4adf17f7572bafbbd23b` |
| Sincronización | 14 ahead / 0 behind |
| Preview | run `37365402672`: 33 passed / 1 failed |
| CI | run `37365268821`: failure; lint/audit green, otros jobs cancelados |
| P3 | visto bueno pendiente |

## Rondas

| Ronda | Resultado |
|---|---|
| 1 | ❌ 4 bloqueantes |
| 2 | ❌ H04 abierto |
| 3 | ❌ H04 abierto |
| 4 | ❌ H04 + H05-H08 |

## Estado

- ✅ H01 — cobertura de `(merchant)`.
- ✅ H02 — doble error test/cleanup.
- ✅ H03 — checklist/evidencia coherentes.
- ❌ H04 — falta baseline GREEN + probe D02-A + revert + GREEN final.
- ❌ H05 — ventana de usuario E2E sin registrar para cleanup.
- ❌ H06 — el caso sin consentimiento no prueba que el perfil sea merchant.
- ❌ H07 — la bitácora presenta SMTP como causa sin evidencia de causa raíz.
- ❌ H08 — el body no sigue la plantilla obligatoria del repo.

No apruebo ni mergeo.
