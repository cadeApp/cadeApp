# PR #248 — T-336 · Navegación de retorno y 404 al home real de la sesión

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/248 |
| **Tarea** | T-336 · issue #247 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-336-retorno-home-real` → `develop` |
| **Base** | `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3` |
| **SHA funcional final verificado** | `76d174027202db06c3e06c7da6f8b53b7b98e2d4` |
| **Estado** | **SIN BLOQUEANTES — revisión independiente cerrada** |

## Rondas

| Ronda | SHA | Resultado |
|---|---|---|
| 1 | `752707bf5cc885d14924d01eb281d0313406298f` | H01–H04 abiertos |
| 2 | `89bc392f096ebb1da6f79d5407d7612c15e68cea` | H01/H03/H04 cerrados; H02 abierto |
| 3 | `76d174027202db06c3e06c7da6f8b53b7b98e2d4` | **H02 cerrado · 0 bloqueantes** |

## Estado final

- PR248-H01 → **arreglado-verificado**
- PR248-H02 → **arreglado-verificado**
- PR248-H03 → **arreglado-verificado**
- PR248-H04 → **arreglado-verificado**

## Verificación final

- navegación de error/404 usa `/login` como gateway;
- merchant/courier vuelven a home u onboarding según estado;
- admin AAL1 entra a MFA hacia applicants;
- admin AAL2 vuelve a `/admin/applicants`;
- CC-007 conserva prioridad;
- scanner root detecta:
  - productores directos;
  - variables locales literales hacia `/`;
  - variables encadenadas simples;
  - helpers locales que devuelven `/`;
  - usos indirectos en router/redirect/redirectTo/href;
- allowlist root restringida por tipo y cantidad;
- mutación indirecta real dejó el control RED y fue restaurada;
- Preview de producto ya validado en R2 a 360 px;
- fetch independiente del revisor confirmó el 404 real con `href="/login"`.

## CI del SHA funcional final

Run `37184391888`:
- **118 archivos / 1879 tests**;
- DB probe: **10/10 PASS**;
- DB suite: **1811/1811 PASS**;
- lint: GREEN;
- typecheck: GREEN;
- build: GREEN;
- bundle-budget: GREEN;
- `/courier/feed = 159 kB`;
- `/courier/profile = 178 kB`.

El deployment Vercel del SHA final volvió a topar la cuota diaria, pero este SHA solo cambia `route-integrity.test.ts` y bitácora respecto del Preview ya verificado; no modifica producto ni runtime.

## QA ajeno

El flaky T-306 observado en R2 quedó registrado en issue #249. No bloquea T-336.

## Resultado

**PR #248 sin bloqueantes técnicos ni de evidencia. Lista para merge desde la revisión independiente.**

No se aprueba ni mergea automáticamente sin instrucción explícita de Lautaro073.
