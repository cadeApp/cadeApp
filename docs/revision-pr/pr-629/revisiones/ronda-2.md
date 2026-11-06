# Informe de revisión independiente — PR #629 / T-405 · Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/629  
**Fecha:** 2026-11-06  
**SHA funcional revisado:** `af61096fdad07593686f7c6870dc8a204323f695`  
**Base:** `develop` @ `5a8f6dc504a320e13579921024ddfe7711d54479`  
**Resultado:** **SIN NUEVOS BLOQUEANTES DE CÓDIGO**. **No lista para merge**: falta evidencia final del gate E2E específico de T-405 y el job DB estaba en progreso durante la inspección.

## Alcance e integración

- La PR sigue abierta y su head exacto coincidía con el SHA solicitado antes del commit documental de R2.
- [CC-046 / PR #631](https://github.com/cadeApp/cadeApp/pull/631) consta **merged** con commit `5a8f6dc5`; el merge de `develop` quedó en la rama de T-405 (`8b4151e9`).
- Se comparó la rama contra `develop`: las modificaciones del CC (primitiva, tests y menú) son ahora **base**; los 23 archivos de diff propios de PR #629 siguen acotados a T-405 y documentación de revisión; `actions.ts` + test están cubiertos por D01=A.
- `docs/tasks/T-405.md` difiere de `develop` exclusivamente en D01–D03 y los dos archivos adicionales de D01, autorizados en R1.
- `docs/revision-pr/pr-629/revisiones/ronda-1.md` conserva blob `9e25e2b7079bf77e08449c6efdd24db74eda7744`, idéntico al commit `d5d2ca0`; el autor no tocó la carpeta.

## Revalidación de R1

### PR629-H01 — `side="right"` debe apoyar el panel en el borde derecho

**Estado: arreglado-verificado para la corrección compartida**, a través de evidencia independiente en el CC y equivalencia de blobs.

**[VERIFICADO — componente compartido]**
- `src/ui/sheet.tsx` en `af61096f`: `side === 'right' ? 'justify-end' : 'justify-center'` en el **wrapper**, no solo en el atributo. Blob `59e13841f7aa7ad7d2589d46e2e59c11174b84b2`, idéntico a la revisión aceptada del CC en `89c9ed1`.
- `src/ui/sheet.test.tsx` blob `06d9ae8f5929ccf6103caafa3effb51958553814`, también idéntico. Cubre `right`, `bottom` y cierre/retorno de foco.
- El E2E real del **menú del CC** pasó en GitHub Actions: [run 42249814951](https://github.com/cadeApp/cadeApp/actions/runs/42249814951), job `128001704352`, `admin-nav-mobile.spec.ts` tests :72 y :109 aprobados (390/1023, borde derecho, Escape/foco). La aceptación independiente [PR #631 ronda 3](https://github.com/cadeApp/cadeApp/blob/5a8f6dc504a320e13579921024ddfe7711d54479/docs/revision-pr/pr-631/revisiones/ronda-3.md) confirma el gate.
- La CI de `af61096f` ejecutó el nuevo test unitario como parte de `195 archivos / 3686 tests passed` ([CI 42258573043](https://github.com/cadeApp/cadeApp/actions/runs/42258573043), job `128032200126`).

**[ANÁLISIS — integración T-405 pendiente de E2E]**
- `publication-credits.global-settings.spec.ts` mide de verdad `boundingBox()` contra `viewportSize()`; para `1280` exige borde derecho dentro de 2 px y `x > 0`; para `390` exige borde derecho y `x ≈ 0` dentro de 2 px. Luego restituye 1280 y continúa el flujo de guardar, consultar auditoría y filtrar entidad.
- El E2E **específico de T-405 todavía no tiene salida de gate** al publicar esta ronda. No afirmar que pasó; no confundir el E2E probado de menú (CC) con el nuevo E2E de comercio.

**Conclusión H01:** cerrada la causa raíz del `Sheet` con evidencia de ejecución del CC y SHA/blobs coincidentes; la readiness global de PR #629 continúa condicionada a su propio gate.

### PR629-H02 (M01) — Fecha futura dinámica

**Estado: arreglado-sin-verificar (E2E pendiente).**

**[ANÁLISIS por inspección]** `publication-credits.global-settings.spec.ts` ahora calcula:
```ts
const pilotUntil = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
const pilotUntilLabel = pilotUntil.split('-').reverse().join('/');
```
La fecha calculada alimenta `fill(pilotUntil)` y la expectativa de la fila de `merchants`. **Ambas** expectativas visibles (últimos movimientos y auditoría) usan `pilotUntilLabel`. No quedan esas dos expectativas con el literal `31/01/2027`. El cambio consta en el commit `81bfd29a`.

**[PENDIENTE]** E2E de T-405; no se ejecutó mutación de fecha pasada en esta revisión, ni se declara RED/GREEN independiente.

## Relectura del DoD — sin nuevos hallazgos de código

La implementación base de A03 no fue alterada después de R1: se mantienen cinco conteos `head: true`, filtro `subscription_status` aplicado antes de paginar, estados `pilot/active/expired/cancelled`, action de movimientos con Zod + AAL2 y auditoría limitada a entidad/comercio/acción antes de `order` y `limit 5`. No se incorporaron accesos directos a `merchant_plan_periods` ni cambios nuevos de esquema.

**No se encontraron regresiones nuevas por inspección** en los cambios propios de T-405 posteriores a la ronda 1. No extrapolarlo a ejecución real del E2E.

## Estado de CI visto en el SHA funcional

| Gate | Estado verificado |
|---|---|
| `lint` | **success** · job `128032199675` |
| `typecheck` | **success** · job `128032200195` |
| `unit` | **success** · job `128032200126`: **195 archivos, 3686 tests** |
| `audit` | **success** · job `128032200181` |
| `build` | **success** · job `128032200276` |
| `bundle-budget` | **success** · job `128033080941` |
| `db-tests` | **in_progress** · job `128032200249` |
| `e2e-preview` específico T-405 | **sin resultado todavía** |

**Fuente:** [CI run 42258573043](https://github.com/cadeApp/cadeApp/actions/runs/42258573043), resultado de Jobs y salida numérica de Vitest, inspeccionados en esta ronda. La bitácora del autor registra `typecheck/lint ✅` y `593 passed` de un subconjunto; no se presenta esa declaración como verificación independiente.

## Gate: duplicación de textos conocida

La prueba nueva de T-405 navega a Auditoría y espera `getByText('Mostrando los eventos de una sola entidad.')`, patrón que en otros E2E produjo coincidencias duplicadas por segmentos de streaming huérfanos. Existe seguimiento **T-426, issues #639/#640**, fuera del alcance T-405.

- No adjudicar automáticamente una futura falla de gate a este problema ni desactivar el test.
- Si el gate cae en esta expectativa, examinar el trace y el log para confirmar la causa; referenciar T-426 sin modificar código ajeno desde T-405.
- **El DoD exige e2e-preview verde**: el antecedente no sustituye la ejecución específica de T-405.

## NO TOCAR / decisiones

- D01=A, D02=A, D03=A y D04=B permanecen aceptadas.
- No reabrir CC-046 ni modificar `src/ui/**` dentro de T-405.
- No añadir mocks falsos, pruebas artificiales o expectativas debilitadas para forzar GREEN. Si el gate falla, registrar evidencia y tratarlo en su tarea.

## Evidencia no disponible

- El contenedor no pudo resolver `github.com` al ejecutar `git ls-remote`; sin clon ni worktree, por lo que no hay `pnpm`, Playwright ni `git merge-tree` ejecutados localmente.
- No se reprodujeron las mutaciones M1–M7 del autor ni una mutación propia del E2E T-405. El CC sí dispone de evidencia RED/GREEN y gate independiente, documentados aparte.
- `mergeable=true` es un estado de API, no `git merge-tree`.
- **Este documento es revisión estática + lectura independiente de logs oficiales**, no una ejecución local inventada.

## Estado final de la ronda

**SIN NUEVOS BLOQUEANTES DE CÓDIGO. H01 reparado/verificado en la primitiva; M01 reparada sin verificación E2E. No aprobar ni mergear todavía:** el gate `e2e-preview` de T-405 y la finalización de `db-tests` eran dependencias pendientes al revisar el SHA `af61096f`.

El commit de esta ronda solo modifica `docs/revision-pr/pr-629/**`. **No exigir un nuevo CI GREEN exclusivamente por documentación**: la evidencia funcional debe apuntar a `af61096f` y el gate debe comprobarse contra ese `TARGET_SHA`.
