# Evidencia — R5 de PR #384 / T-357 (SHA `7b2dadba73800a8548433c1cc1051f2264243bff`)

## Pipeline CI

- `39017572040` intento 2, SHA `7b2dadba`: GitHub Actions **SUCCESS**. Jobs unit/typecheck/lint/audit/build/db-tests/bundle-budget SUCCESS.
- Job unit `117354729729`: `Test Files 138 passed (138)`, `Tests 2551 passed (2551)`.
- Job PgTAP `117354745798`: `Files=27, Tests=2420`; `Result: PASS`. Las mutaciones de SQL de otros CC se ignoran para acreditar T-357.
- Job build `117354728723`: SUCCESS tras rerun, falla previa de `next/font` Montserrat de origen no probado; sin cambios en `src/app/layout.tsx`.

## E2E del árbol integrado (no solo etiqueta de status)

[Run 39017634271, intento 2](https://github.com/cadeApp/cadeApp/actions/runs/39017634271) / job 117357103537:
```text
ref: 7b2dadba73800a8548433c1cc1051f2264243bff
git checkout --progress --force 7b2dadba73800a8548433c1cc1051f2264243bff
T-357 positivo :813 PASS (25.1s)
T-357 negativo UI + RLS :998 PASS (10.4s)
T-357 viaje comercio + RPC :1077 PASS (30.2s)
85 passed (Chromium)
3 passed (global-settings)
e2e-preview: success
```
No reintento del test T-357 fue necesario. Conclusión E2E SUCCESS.

## Cambio de develop desde base combinada

```text
base merge SHA: 293c3a2756509a5fb6e82ee6bc841197c143f9c9
develop actual: c4dd91883b4b1e0990bd0e02f468133995402a1a
ahead: 3; changed paths:
- docs/contracts/CC-029.md
- docs/implementation-plan.md
- docs/revision-pr/pr-395/**
- docs/tasks/T-369.md
```
Esto **no justifica nueva CI/E2E** por ser solo documentación ajena a T-357; tampoco otorga derecho a afirmar que los mutantes propios se ejecutaron.

## Instrumentos del revisor: límites

Se usó inspección estática de las guardas de `actions.ts` y del E2E para comparar con la matriz del DoD, más lectura de logs reales. **No se ejecutaron nuevas mutaciones runtime independientes del revisor** (las mutaciones estáticas de R2/R3 no son sustituto). Esta limitación se refleja en el estado `arreglado-sin-verificar` de H01, H02, H03 y H05.

No se ejecutaron tests locales con un checkout propio por falta de clone; no se dispararon CI ni Playwright manualmente; no se usaron secretos ni Supabase remoto.

## Política de cambio documental

Un commit que modifique únicamente `docs/revision-pr/pr-384/**` o `docs/tasks/log/T-357.md` **no invalida la ejecución GREEN del SHA de aplicación 7b2dadba**. Si GitHub reejecuta checks por un cambio documental, no se exige otra ronda de verificación completa por ese solo motivo. El revisor debe seguir indicando el SHA de código efectivamente probado y el commit documental separado.
