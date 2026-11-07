# Informe de aceptación — PR #631 / CC-046 · Ronda 3 (2026-11-06)

**PR:** https://github.com/cadeApp/cadeApp/pull/631  
**Tarea dependiente:** T-405 / PR #629 · **CC:** CC-046 / issue #630  
**SHA funcional revisado:** `89c9ed13615d02980f7ff28d3599fecb89b52852`  
**Base actual:** `develop` @ `b5ceef11e4f227d87f438ff7d686e9355a6daac9`  
**Resultado:** **SIN BLOQUEANTES** de CC-046. **ACEPTACIÓN DE REVISIÓN INDEPENDIENTE**. La revisión **NO aprobó ni mergeó** la PR.

## Alcance y sincronización

- `89c9ed13` es un commit de merge de `5acb8a1` (revisión R2 en la rama CC) y `b5ceef1` (develop), con dos padres explícitos y sin rebase/force. Comparación `develop...89c9ed13` = ahead 6, behind 0. GitHub `mergeable=true`; no se ejecutó `git merge-tree` en local porque `github.com` no resuelve DNS en este entorno.
- Los cuatro archivos centrales del CC conservan **exactamente** el mismo blob que f54dc934: `src/ui/sheet.tsx` (`59e13841...`), `src/ui/sheet.test.tsx` (`06d9ae8f...`), `e2e/specs/admin-nav-mobile.spec.ts` (`e1200e9e...`), `docs/tasks/log/CC-046.md` (`882a96ac...`). La integración de T-425 modificó otros archivos de la base, entre ellos `src/app/(admin)/admin-nav.tsx`; el E2E volvió a ejecutar el flujo y pasó.
- `src/ui/sheet.tsx` sigue aplicando `justify-end` si `side="right"`, `justify-center` si `side="bottom"`, preservando las clases del wrapper, la API y el manejo de cierre.
- Aprobación del contrato por Lautaro073 en calidad P2 el 2026-11-06: sigue registrada en `docs/contracts/CC-046.md`.

## Revalidación de los hallazgos R1

| Hallazgo | Estado final | Verificación |
|---|---|---|
| **PR631-H01** foco tras Escape | **arreglado-verificado** | Unit `src/ui/sheet.test.tsx` 4/4; E2E `admin-nav-mobile.spec.ts:109` ✓ (primer intento) incluye `toBeFocused()` tras Escape en los casos móviles |
| **PR631-H02** geometría 390/1023 | **arreglado-verificado** | E2E `:109` ✓ (primer intento); bucle `[390,1023,1024,1280]`; `390px x≈0`, `1023px x>0`, borde derecho dentro de 1px |
| **PR631-H03** bitácora | **arreglado-verificado** | `docs/tasks/log/CC-046.md` permanece en SHA final, con baseline y RED/GREEN del autor claramente identificados; evidencia de existencia y forma leída vía GitHub Contents API |

El revisor **no ejecutó mutación local**. Los dos mecanismos redundantes de restauración de foco (Sheet y Radix) explican que mutar uno solo sobreviva; la bitácora del autor registra RED al anular ambos y GREEN al restaurarlos. No se necesita debilitar tests ni cambiar producción para obtener un RED artificial. La verificación final de H01/H02 proviene de tests unit/E2E reales de GitHub Actions, comprobados directamente en sus logs, con el SHA y rutas exactos.

## Checks del SHA exacto

| Check | Evidencia oficial | Resultado |
|---|---|---|
| CI | [run 42248108325](https://github.com/cadeApp/cadeApp/actions/runs/42248108325), **attempt 2** | **success** (build, typecheck, lint, audit, db-tests, bundle-budget, unit) |
| Vitest unit | job `128000638534` | **194 archivos, 3659 tests passed**; `sheet.test.tsx` **4/4**; `verify-fichas.test.ts` **7/7** |
| DB tests | job `128000580686` | **Files=42, Tests=3396, Result: PASS**; `git diff --exit-code -- src/types/database.types.ts` sin diferencias |
| E2E trusted | [run 42249814951](https://github.com/cadeApp/cadeApp/actions/runs/42249814951), job `128001704352` | **success**, status `e2e-preview=success` reportado con `TARGET_SHA=89c9ed13615d02980f7ff28d3599fecb89b52852` |
| Chromium | job `128001704352` | **117 passed (34.9m)** y **2 flaky** |
| global-settings | mismo job | **6 passed (2.5m)** |
| Menú admin | `admin-nav-mobile.spec.ts:72`, `:109` | ✓ ambos al **primer intento**; flujo navegación, geometría y Escape/foco |

**Aclaración del CI:** el resultado final es el intento 2 de un mismo run; la causa del rerun de build relacionada con `next/font/google` fue comunicada por Lautaro073 y no se atribuye al código de CC-046. No se afirma ejecución local de CI ni Playwright.

## Flaky conocidos, fuera del alcance de CC-046

- **T-407** `e2e/specs/admin-audit-filters.spec.ts:69`: falla en los dos primeros intentos por dos coincidencias del texto «Mostrando los eventos de una sola entidad.» en `:108`; pasa en retry #2. Seguimiento [#636](https://github.com/cadeApp/cadeApp/issues/636).
- **T-410** `e2e/specs/admin-trips.spec.ts:167`: falla dos intentos al buscar «Entrega 1 entregada» en `:202`, pasa en retry #2. Seguimiento preexistente [#585](https://github.com/cadeApp/cadeApp/issues/585).
- Diagnóstico informado por Lautaro073: segmento de streaming `div[hidden]#S:1` de React 19.2, huérfano bajo `body` si el boundary se renderiza en cliente antes del reveal `$RV`. **No fue reproducido de manera independiente en esta revisión**, no se afirma causa demostrada aquí. Corregirlo exige ficha/PR de QA propia, sin tocar CC-046.
- El gate **no** ofrece evidencia de ausencia de flakiness en esos tests: el resultado success incluye reintentos; no ocultarlo, ni cerrar #585/#636 por tener verde final.

## Bloqueo externo T-424: resuelto

En develop, la ficha T-424 incorporada por **T-425 / #635** ya incluye `docs/revision-pr/**`, sección `## DoD` y primer ítem alineado con la fila del plan. `tools/verify-fichas.test.ts` pasó **7/7** en el CI del SHA revisado. El issue #637 ya está cerrado. La [PR #638](https://github.com/cadeApp/cadeApp/pull/638) creada durante R2 quedó redundante y se cerró **sin merge**.

## NO TOCAR / límites de la aceptación

- No volver a modificar `src/ui/sheet.tsx`, tests, expectativas, el CC o la bitácora solo para tapar fallas externas.
- No exigir otro CI GREEN por commitear **únicamente** esta carpeta de revisión; los checks oficiales se verificaron contra el SHA **funcional** `89c9ed13615d02980f7ff28d3599fecb89b52852`.
- No aprobar ni mergear desde el revisor, conforme al modo Chat del usuario. El merge final es de Lautaro073.
- El check `approval-policy` estaba rojo antes de este cierre por el **formato** del informe en la descripción de la PR (el validador exige `Informe revisar-pr — T-xxx` y el cuerpo decía `CC-046`). Se corregirá el reporte de la descripción sin falsear los resultados ni borrar la autorrevisión histórica; verificar estado posterior, no decir que ya está verde.

## Metodología y límites

Revisión independiente por API de GitHub: comparación de commits, inspección de blobs en SHA final, lectura directa de CI y E2E (incluido `TARGET_SHA` publicado por trusted workflow), y comprobación de la carpeta `docs/revision-pr/pr-631`. No se pudo clonar GitHub ni correr el harness propio por restricción DNS de este contenedor. Por eso `arreglado-verificado` indica **verificación de código y tests oficiales del SHA por un revisor diferente del autor**, y no mutación local ejecutada por el revisor. La carpeta del revisor sigue separada de la bitácora del autor.

**Conclusión: CC-046 aceptada sin bloqueantes propios. PR #631 lista para decisión de merge de Lautaro073 una vez satisfecho el requisito documental de `approval-policy`; el seguimiento de flakies continúa por #585/#636.**
