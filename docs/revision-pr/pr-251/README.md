# PR #251 — T-313 · E2E de registro de comercio y consentimientos

> ❌ Ronda 12 · CON BLOQUEANTES (2): H04 + H10 · P3 pendiente

| Campo | Valor |
|---|---|
| PR | #251 · `feat/T-313-merchant-registration-e2e` → `develop` |
| Tarea | T-313 |
| Autor | KiraK72 |
| SHA revisado | `39ceff9890da8906d5d19457587ec33718d73814` |
| develop | `cd023e3453ead76983d54982df1548cb97aa57eb` |
| Sincronización | 46 ahead / 0 behind |
| CI | `37703591192` · GREEN |
| approval-policy | `37703586790` · GREEN (formato/aprobación histórica, no certifica E2E) |
| Vercel | GREEN |
| trusted e2e-preview | `37703693643` · **45 passed / 1 failed** |
| P3 | Visto bueno explícito pendiente |

## Rondas recientes

- [Ronda 11](revisiones/ronda-11.md): H11 corregido y D04-A aprobado.
- [Ronda 12](revisiones/ronda-12.md): T-348 incorporada y migrada a Develop; nuevo Preview real; H04/H10 aún abiertos.

## Estado por hallazgo

- ✅ H01–H03.
- ❌ H04: el alta UI registra consents y merchant correctamente pero no alcanza /merchant/dashboard. `revalidatePath` agregado en el HEAD no resuelve el E2E. Falta baseline GREEN, después un RED seguro y GREEN final.
- ✅ H05–H09.
- ❌ H10: body anterior a T-348, cita Preview histórico fallido por UPSERT y una migration como si siguiera en #251; debe citar el nuevo Preview real. La bitácora atribuye el 307 a caché sin prueba de causa raíz.
- ✅ H11: UPDATE de merchant + tests revalidado, y policy + pgTAP entregados por PR #302/T-348, aplicada en Develop.

## D03-A / D04-A

La action y unit tests de H11 permanecen en #251. T-348/#302 ya mergeó migración y pgTAP; `migrate-develop` `37693700041` pasó. **No hay diff propio de `supabase/migrations/**` ni `supabase/tests/**` en #251.**

## H04 — próximo paso

No mutar `guards.ts` ni desplegar una barrera de seguridad desactivada. T-347 `e2e-mutation` admite solo `target=develop`, no PR abierta.

Diagnosticar la redirección posterior al onboarding con evidencia controlada/sin secretos: distinguir 307 del middleware vs dashboard vs conflicto de navegación cliente `router.push()/router.refresh()`; conservar todas las aserciones del E2E. No declarar causa de caché probada sin señal discriminante.

## Cierre

**CON BLOQUEANTES (2) + P3 pendiente.** No apruebo ni mergeo.
