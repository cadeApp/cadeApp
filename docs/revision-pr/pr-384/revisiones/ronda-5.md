# Informe revisar-pr — PR #384 / T-357 — Ronda 5

**Fecha:** 2026-10-17 (Argentina).
**SHA de código revisado:** `7b2dadba73800a8548433c1cc1051f2264243bff`.
**Comparación actual:** rama de PR HEAD idéntica a 7b2dadba al iniciar ronda, sin commits nuevos de agy desde el merge de develop.
**Resultado:** **SIN BLOQUEANTES FUNCIONALES NUEVOS; CI y E2E GREEN del árbol combinado.** Conserva cuatro hallazgos de código corregidos pero sin verificación runtime por mutación independiente (H01/H02/H03/H05). Recomendación de merge **solo con esa reserva de verificación documentada**; no aprobar ni mergear automáticamente.

## Inspecciones y alcance

1. El commit `7b2dadba` es merge real de dos padres (`38e42bcd` + `293c3a27`) y GitHub considera la PR mergeable; respecto del develop con que se integró, no está detrás. Los archivos T-357 `actions.ts`, `vehicle-form.tsx`, `schemas.ts`, `page.tsx`, `actions.test.ts` y `courier-onboarding.spec.ts` resultaron de contenido idéntico al árbol anterior al merge, por lo que se preservó la implementación y los tests.
2. En el momento de esta ronda, develop avanzó 3 commits más, todos limitados a `docs/contracts/CC-029.md`, `docs/implementation-plan.md`, `docs/revision-pr/pr-395/**` y `docs/tasks/T-369.md`. No cambian aplicación, tests ni workflow ejecutable y no intersectan con T-357. **No se pide otro CI únicamente por esta documentación o por el informe R5.**
3. No hubo nuevas dependencias, secretos, SQL o RLS agregados en el delta propio de T-357; conserva decisiones vinculantes **1-A** (editar no revoca `approved`) y **2-A** (solo tipo/patente; gestión de documentos por T-356/CC-025).

## CI de GitHub verificada en logs — SHA 7b2dadba

- [CI run 39017572040, intento 2](https://github.com/cadeApp/cadeApp/actions/runs/39017572040): **SUCCESS**.
- Vitest `unit` job `117354729729`: **138/138 Test Files, 2551/2551 Tests PASS** (log verificado).
- `db-tests` job `117354745798`: **27 files / 2420 tests PgTAP PASS** (log verificado). Los RED deliberados de otros CC en el job **no acreditan** mutaciones T-357.
- `build` job `117354728723`: **PASS al reejecutar en el mismo SHA**, después de un FAIL de `next/font` con Montserrat (`TypeError reading '1'`). El hecho comprobado es RED inicial/GREEN posterior sin cambios de código. **No se probó cuál fue la causa raíz del fallo; red transitoria es hipótesis, no defecto de T-357 demostrado.**
- `typecheck`, `lint`, `audit`, `bundle-budget`, `approval-policy` y Vercel: PASS.

## E2E Preview — SHA exacto comprobado

- [Run 39017634271, intento 2](https://github.com/cadeApp/cadeApp/actions/runs/39017634271) / job `117357103537`, conclusión **SUCCESS**. A pesar de que el workflow `repository_dispatch` publica un `head_sha` de la rama de confianza, el **checkout efectivo en el log es `7b2dadba73800a8548433c1cc1051f2264243bff`**. Status `e2e-preview: success` en el SHA de PR.
- **85/85 Chromium PASS + 3/3 global-settings PASS**, 88 E2E en total.
- Test T-357 `:813` flujo completo moto→auto ELA 666→bici→a pie PASS (25.1s), `:998` negativo alta incompleta y RLS cross-actor PASS (10.4s), `:1077` **vista de viaje del comercio + recarga + RPC get_trip_details** PASS (30.2s), sin reintentos necesarios.
- No se alteró ningún test ni se ejecutó un runner modificado por la revisión.

## Hallazgos, sin adjudicar pruebas inexistentes

| ID | Estado | Resumen y limitación |
|---|---|---|
| H01 alto | `arreglado-sin-verificar` | Guard server de onboarding existente; unit y UI negativa PASS. Sin ataque directo a Server Action bajo sesión real incompleta o mutación runtime propia. |
| H02 alto | `arreglado-sin-verificar` | Edición schema strict solo tipo/patente, sin upsert docs, E2E snapshot de docs intacto PASS. Sin mutación runtime propia. |
| H03 medio | `arreglado-sin-verificar` | UPDATE condicional y 0 filas diferenciadas en unit PASS. Sin carrera DB real independiente ni mutación runtime propia. |
| **H04 alto** | **`arreglado-verificado`** | E2E de viaje completo, recargas, RPC y RLS cross-actor PASARON en runner y SHA inspeccionados. |
| H05 medio | `arreglado-sin-verificar` | Error DB diferenciado y unit PASS. Sin mutación runtime propia. |
| **R01 alto** | **`arreglado-verificado`** | Bug Playwright strict mode anterior tuvo RED en run `39011316740` y prueba equivalente GREEN en este SHA. |

**Limitación expresa:** las cuatro mutaciones runtime propias del revisor no se pudieron ejecutar sin clon ejecutable en este entorno; la inspección de logs/verificación manual del diff no es una mutación, por lo que sus campos `verificado_en_sha` quedan nulos. No hay nuevo defecto funcional reproducido, pero **si el gate de mutaciones independientes se trata como indispensable para aprobar el DoD, ese gate sigue pendiente y no debe simularse cumplido**.

## Cierre y decisión operativa

**Todos los checks técnicos reales y el flujo de usuario de T-357 están en verde sobre el SHA combinado.** En términos funcionales, la PR está técnicamente preparada para merge; no hay conflictos ni errores abiertos de CI. La reserva es de profundidad de auditoría: cuatro hallazgos con solución comprobada por tests del autor y CI, pero sin la mutación runtime propia pedida por la guía. Se recomienda conservar esa reserva en los registros, sin pedir rondas de código ni otro CI por un cambio de bitácora. El dueño es quien decide aceptar el riesgo de verificación parcial; no se mergeó ni aprobó en esta revisión.

No se activó manualmente ninguna workflow; no se accedió a bases remotas ni secretos; no se modificó la aplicación.
