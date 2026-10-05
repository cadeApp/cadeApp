# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 3 · CON BLOQUEANTES (1) · 3 de 4 hallazgos cerrados

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 · Issue #45 |
| Autor | KiraK72 |
| SHA revisado | `362dd4e1d44de99b49241a4941e2c1e93f367305` |
| `develop` actual | `f1ae16106e61bbb6707b4adf17f7572bafbbd23b` |
| Sincronización | 11 ahead / 1 behind |
| CI | `37359359931` · GREEN |
| e2e-preview | `37359531243` · RED: 30 passed / 1 failed |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `afdb326` | ❌ 4 bloqueantes |
| 2 | `604d028` | ❌ 1 bloqueante |
| 3 | `362dd4e` | ❌ 1 bloqueante · sin hallazgos nuevos |

## Estado de hallazgos

- ✅ **PR251-H01** — cobertura completa de `(merchant)`.
- ✅ **PR251-H02** — cleanup preserva ambos errores.
- ✅ **PR251-H03** — evidencia/checklist coherentes y CI integrado verde.
- ❌ **PR251-H04** — el baseline de Preview sigue rojo por el alta de Auth en Supabase Develop.

## Qué cambió desde ronda 2

Kira:
- mergeó `develop` con T-336;
- reejecutó checks;
- dejó intacto el spec;
- frenó correctamente antes del probe D02-A al no tener baseline GREEN.

Resultado del Preview actual:
- DoD courier → ✅ GREEN;
- DoD sin consentimiento → ✅ GREEN;
- DoD alta completa → ❌ falla en `merchant-registration.spec.ts:145` porque la UI muestra alert de registro;
- resumen Chromium: **30 passed / 1 failed**.

## Condiciones pendientes

1. **Supabase Develop:** el alta de prueba debe funcionar sin depender de SMTP real (D01).
2. **Sincronización:** `develop` avanzó un commit con T-337, que modifica `e2e/pages/login.page.ts`, utilizado por T-313.
3. **H04:** baseline GREEN → probe D02-A → RED discriminante → `git revert` → GREEN final.
4. **P3:** visto bueno explícito del spec todavía no registrado.

## Estado

No apruebo ni mergeo.
