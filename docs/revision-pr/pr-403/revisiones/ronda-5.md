# Informe de revisión independiente — PR #403 / T-367 — Ronda 5

**Fecha local Argentina:** 2026-10-17  
**SHA funcional examinado:** `0e99879d95fb9f833f84fcc4b137b23894f4f30b`  
**Base develop examinada:** `0488f8a98f44b67101c7c520696c356d46c161ff`  
**Rama:** `feat/T-367-avatar-perfil` → `develop`  
**Resultado: SIN BLOQUEANTES.** La PR **está lista para merge por Lautaro073** siempre que los checks/aprobación sigan vigentes al hacer la operación; no se aprobó ni mergeó desde esta revisión.

## 1. Integración upstream — H09 CORREGIDO Y VERIFICADO

- El commit merge `f29fe8109f8c7790d7df4b79f7458d9d59cb48e3` tiene **dos padres reales**, primero `7c4fcffff0b24865a7b6199a803b3d9d713c03c0` (R4) y segundo `0488f8a98f44b67101c7c520696c356d46c161ff` (`develop`).
- HEAD funcional posterior `0e99879d95fb9f833f84fcc4b137b23894f4f30b` añade únicamente bitácora `docs/tasks/log/T-367.md`. El diff comparativo `develop...HEAD` lista **18 archivos y todos pertenecen a T-367 o su carpeta de revisión**. No contiene `e2e/specs/subscription.global-settings.spec.ts` ni migraciones, workflows o infraestructura propios como modificación de esta PR.
- Comparación `develop` → HEAD: 17 commits de la PR, **behind=0**; `develop` es ancestro de HEAD (confirmado por comparación de commits, y por padres del merge).
- El fichero `e2e/specs/subscription.global-settings.spec.ts` tiene el contenido de `develop` con `PUBLICATION_CREDITS_EXHAUSTED` y restauración exacta de estado de suscripción. No se reimplementó ni editó a mano el arreglo de T-371: fue heredado del merge de PR #407. Lo mismo para CC-030/T-370, cuyos cambios llegan por upstream, no como delta propio de T-367.
- La prueba T-306 que bloqueaba R4 **pasó ahora las 3 variantes con E2E real en el HEAD exacto de T-367**, run `39086663866` / job `117554606613`. Por tanto H09 se cierra con verificación remota real, no con la mera afirmación del agente.

## 2. Verificación funcional T-367

El único escenario añadido a `e2e/specs/courier-onboarding.spec.ts:1500` (avatar aprobado, URL firmada, descarga real `naturalWidth > 0`, sesión separada para otro cadete, denegación cross-user, fallback en rechazo/archivo ausente y recuperación) fue **PASS en 26,6s** en run 39086663866 sobre el SHA examinado. El fallback accesible `role="img" aria-label="Avatar de perfil no disponible"` y los controles de H08 se conservan.

Las correcciones de seguridad previas H01, H03, H06 se conservan: filtro SQL de vigencia, path canónico solo `avatar_<timestamp>.(png|jpg|jpeg|webp)` y mocks tipados. No hubo cambios a esos archivos en la integración upstream; la suite `queries.test.ts` se ejecutó con todas las unidades en CI. H05 documenta mutación visual RED→GREEN en bitácora ejecutada por el autor; **esta revisión no repitió esa mutación**. H04 (autorrevisión antigua) se preserva separada y el autor no modificó carpetas del revisor.

No se añadieron dependencias, contratos ni cambios a RLS/Storage por el código propio de T-367.

## 3. CI y aprobación vigentes sobre SHA exacto

| Gate | Evidencia | Estado |
|---|---|---|
| CI general | Actions run **39086582843** | **SUCCESS** |
| Unit | job **117554333570** — **141 test files / 2696 tests PASS**; tests adicionales de workflows 79/79 y ADR 6/6 | **SUCCESS** |
| DB | job **117554333576** — pgTAP **Files=29, Tests=2735, Result: PASS**, regeneración de tipos y `git diff --exit-code` | **SUCCESS** |
| Typecheck, lint, build, audit, bundle-budget | jobs de CI del mismo run | **SUCCESS** |
| Vercel Preview | status de SHA `0e99879d95fb9f833f84fcc4b137b23894f4f30b` | **SUCCESS** |
| Playwright Chromium | E2E run **39086663866**, job **117554606613** | **86 PASS + 1 FLAKY recuperado en retry; gate SUCCESS** |
| Playwright global-settings | mismo job: T-306 **3/3 PASS** | **SUCCESS** |
| E2E T-367 | mismo job, `courier-onboarding.spec.ts:1500`: **PASS (26,6s)** | **SUCCESS** |
| Approval-policy | re-evaluación run **39088272905**, job **117559333404** | **SUCCESS** |
| Revisión de Lautaro073 | GitHub review `APPROVED` 2026-10-18 01:56:22Z | **VIGENTE al revisar** |

**Distinción importante:** el proyecto Chromium no fue 87/87 impecable en primer intento: **un test de T-358 falló inicialmente y pasó al reintentarlo**, de modo que Playwright informó `1 flaky; 86 passed`. No ocultar esta señal por el gate verde.

### Mejora no bloqueante M10 — Flakiness de T-358 fuera del alcance

`e2e/specs/merchant-registration.spec.ts:454`, flujo **T-358** de editar teléfono de comercio: `expect(page).toHaveURL(/\/merchant\/plan/)` esperaba la navegación tras guardar, pero en el primer intento el navegador permaneció en `/merchant/onboarding`. Playwright **la clasificó como flaky** porque pasó tras el retry; no hay cambios a ese spec ni flujo en T-367. Registrar seguimiento **separado de T-367** si se repite, sin cambiar tests ni timeouts para pintar verde. **No bloquea el merge de T-367**, puesto que el gate de E2E íntegro concluyó `success`.

## 4. Metodología y límites

Inspeccioné vía API de GitHub: HEAD, merge de dos padres, comparación de archivos contra develop, cambios incrementales desde R4, bitácora, caso T-367, E2E Chromium + global-settings con logs y check de aprobación vigente. **No ejecuté** localmente pnpm, Docker/Supabase, Playwright ni mutaciones; `Checks locales` = no ejecutados en esta sesión, y no se falsea su resultado con el CI remoto. Los resultados de CI están claramente etiquetados como externos y corresponden al SHA revisado.

## 5. Dictamen de revisión

```text
Informe revisar-pr — T-367 — 2026-10-17 — revisión independiente R5
Resultado: SIN BLOQUEANTES
Checks locales: typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db no ejecutado
Checks remotos: unit 2696 PASS · pgTAP 2735 PASS · typecheck/lint/build/audit/bundle-budget PASS · E2E gate SUCCESS
BLOQUEANTES:
- (ninguno)
MEJORAS:
- [e2e/specs/merchant-registration.spec.ts:513] T-358 tuvo 1 fallo en primer intento y pasó en retry; investigar en su flujo si reincide, fuera de PR #403.
No revisado / dudas para Lautaro073:
- Validación humana de staging tras el merge/promoción; no es prerrequisito de merge del feature.
```

**SIN BLOQUEANTES — APTA PARA MERGE.** La revisión R5 solo agrega documentación independiente. Este dictamen no constituye autorización para que el agy mergee por cuenta propia, ni reproduce una aprobación (que ya otorgó Lautaro073).
