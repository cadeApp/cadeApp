# Informe de revisión — PR #273 / T-342 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/273  
**Head SHA revisado:** `49b87b158be4089eb9b6258cafce9982dedb6d66`  
**Base:** `develop` @ `888c1148eecdce74e851ae48e3de2b19bba20392`  
**Fecha:** 2026-10-05

## Resultado

**SIN BLOQUEANTES de revisión.**

No hubo cambios de código funcional desde la ronda 1; esta ronda cierra los dos puntos de proceso.

## PR273-A01 — ACEPTADO

Lautaro073 confirmó directamente que **él aprobó** la ampliación de alcance de T-342 para:

- `e2e/pages/courier.page.ts`
- `e2e/specs/main-flow.spec.ts`

La afirmación del body deja de ser solo dato no confiable para la revisión: existe ahora instrucción directa del responsable. Se registra como `aceptado`, no como `arreglado-verificado`, porque no hubo un arreglo técnico que verificar.

## PR273-H02 — ARREGLADO Y VERIFICADO

Se corrigió el body de #273 reemplazando el resumen de autorrevisión por la sección exacta que consume `.github/workflows/approval-policy.mjs`:

- `### Informe de revisión de agy ...`
- `Informe revisar-pr — T-342`
- `Resultado: SIN BLOQUEANTES`
- `Checks locales:`
- `BLOQUEANTES:`
- `MEJORAS:`
- `No revisado / dudas para Lautaro073:`

**Verificación independiente:** GitHub Actions `approval-policy` run **37403363705** → **success**.

## Estado funcional

La conclusión de ronda 1 se mantiene:

- `notes` y `cash_change_amount` salen de los selects/mapeos pre-match SSR y live;
- salen de `AvailableRequestItem` y del contrato live;
- `RequestCard` y `OfferSheet` conservan medio de pago y «Necesita cambio» sin monto;
- las pruebas nuevas cubren proyección, payload, UI y E2E;
- `data-request-id` no agrega un dato nuevo al cliente.

## Checks observados

Sobre `49b87b1`:

- approval-policy ✅
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- Vercel ✅
- audit ❌ — advisories de dependencias no modificadas por T-342
- e2e-preview estaba reejecutándose por el commit documental de revisión; la corrida funcional anterior de T-342 ya estaba verde.

## No bloquea esta revisión

- `audit`: requiere tratamiento separado; no hay cambios de `package.json` ni `pnpm-lock.yaml` en T-342.
- CC-023 (#267): sigue siendo el cierre del acceso directo por API.
- T-343 / #269: vocabulario del feed live, fuera de T-342.
