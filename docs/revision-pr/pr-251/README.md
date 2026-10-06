# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 7 · CON BLOQUEANTES (2) · H04 + H09

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA funcional revalidado | `bce333fede77737a66d3afae8b43a19ce6dc8747` |
| Commit previo de revisión | `e0ae45c9306813461b86d17381fd10b791b2de23` |
| `develop` actual | `5c7febf6c2a4cba97d29148cc797e373103bd838` |
| Sincronización | 23 ahead / 34 behind |
| e2e-preview | `37433304282` attempt 2 · 35 passed / 1 failed |
| P3 | visto bueno pendiente |

## Estado

- ✅ H01 — cobertura completa de `(merchant)`.
- ✅ H02 — doble error test/cleanup.
- ✅ H03 — checklist/evidencia coherentes.
- ❌ H04 — falta baseline GREEN + D02-A RED + revert + GREEN final.
- ✅ H05 — cleanup robusto del alta.
- ✅ H06 — rol merchant demostrado con RED/revert.
- ✅ H07 — causa SMTP no sobreatribuida.
- ✅ H08 — body con template.
- ❌ H09 — selector global `getByRole('alert')` captura el route announcer de Next.js.

## Cambio de diagnóstico

Desactivar **Confirm Email** en Supabase Develop sí permitió completar el alta: el artifact del attempt 2 muestra la pantalla **“Revisá tu email”**. El único `role=alert` restante es `#__next-route-announcer__` de Next.js, no un error de cadeApp.

No hace falta tocar más Supabase por este fallo.

No apruebo ni mergeo.
