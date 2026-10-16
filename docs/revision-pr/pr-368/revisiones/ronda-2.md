# Informe revisar-pr — PR #368 / T-354 — Ronda 2

**SHA revisado:** `b94c683756b3f37b3574d6691f95b2557c030416`  
**Fecha:** 2026-10-15  
**Base de consulta:** develop `b5b9bf036c4c863c334948065a8780f76a88f758`  
**Resultado:** **CON BLOQUEANTES (2 nuevos)** + H02 parcialmente verificado. No mergear.

## Cambios correctos (H01 cerrado)

- `COURIER_ONBOARDING_COPY.selfieTitle = 'Selfie con el DNI'` y subtítulo idéntico a 2-B.
- `StatusView` y `CourierProfileView` consumen el valor centralizado; mantienen kind `selfie`.
- `DocumentUploadCard` usa `whitespace-normal break-words` para el subtítulo de selfie y asocia el control de carga al título.
- `ADMIN_COPY.documentKind.selfie` y `ADMIN_COPY.queue.selfieBadge` implementan 3-A.
- `courier-panel.test.tsx` cambia **una sola aserción** y conserva `Pendiente` (1-A).
- Hay tests DOM para el texto y las transiciones Pending/Observado/Listo y pruebas DOM admin.
- No se alteraron políticas, contratos, enums, Storage, esquema, dependencias ni `docs/revision-pr/**` por el autor.

**Evidencia independiente:** 11 controles estáticos baseline GREEN sobre fuentes reales de `b94c683756b3f37b3574d6691f95b2557c030416`, 10 mutaciones sobre copias en memoria con 10/10 controles de referencia fallando; ver `evidencia/comandos.md`. CI unit de la misma SHA: **2172 passed / 130 files**. Esto no demuestra que cada una de las 9 mutaciones Vitest informadas por el autor se haya reproducido independientemente.

## 🔴 PR368-H03 — Patrón de tipos inseguros y mutación global introducido en tests

**Severidad:** alto; **origen:** agente; **estado:** abierto.  
**Archivo 1:** `src/features/admin/components/applicant-detail-view.test.tsx:3`:
```ts
(globalThis as any).React = React;
```
**Archivo 2:** `src/features/courier-onboarding/components.test.tsx:~1141`:
```ts
const describedNode = document.getElementById(describedById!);
```

**Diagnóstico [ANÁLISIS].** Son dos casos en el conjunto completo de archivos nuevos de pruebas: cast `any` y non-null assertion `!`, ambos prohibidos por `AGENTS.md §4`. Además, parchear `globalThis.React` crea un acoplamiento de entorno entre suites y puede ocultar dependencias JSX reales. **CI lint y typecheck pasaron**, por eso son una brecha de cobertura de la prohibición y no un fallo de compilación verificado.

**Arreglo:** eliminar completamente el parche global; comprobar la ejecución aislada de la suite admin sin ese parche. Si el componente `ApplicantsQueue` realmente depende de `React` global con el transform de tests, corregir su módulo sin global; un `import * as React from 'react'` en `src/features/admin/components/applicants-queue.tsx` está dentro del alcance de la ficha y debe justificarse mediante prueba RED sin import y GREEN con import. No tocar configuración de Vitest ni dependencias. Para la otra prueba, sustituir `describedById!` por guardado seguro `describedById ? document.getElementById(describedById) : null`; la expectativa previa de no vacío se mantiene y el nodo todavía debe existir y contener texto exacto.

**Mutación RED exigida:** reintroducir en memoria `(globalThis as any).React = React;` y `describedById!`; el control de prohibiciones de la ronda debe detectar ambos casos. Ejecutar la suite admin y de onboarding aisladas tras arreglo sin modificar asserts para forzar GREEN.

## 🔴 PR368-H04 — E2E Preview / visual sin evidencia trazable

**Severidad:** alto; **origen:** agente; **estado:** abierto.  
**Archivo:** `docs/tasks/log/T-354.md` (entrada 2026-10-15 02:30).

**Diagnóstico [ANÁLISIS].** La bitácora dice que E2E se ejecutaría «posterior al despliegue» sin SHA, workflow run y resultado. El body deja desmarcado el DoD E2E. Aunque afirma lectura móvil a 360×800 y 390×844, no incorpora captura ni registro reproducible. Un Preview desplegado **no** equivale a una prueba E2E ejecutada.

**Arreglo:** consumir el flujo E2E Preview existente (no editar `e2e/**` ni disparar workflows manualmente sin autorización), consignar run real, SHA, resultado y qué flujo de esta tarea verificó; o documentar el bloqueo exacto sin marcar DoD. Comprobar visibilidad del texto completo y del badge en 360×800 y 390×844, con capturas o registro verificable, y control de nombre accesible. Los controles de UI deben usar un entorno de pruebas y no documentación real/sensible.

## PR368-H02 — Evidencia parcial

La suite nueva y la global corrieron verde en CI; el autor declara 9 mutaciones RED (con conteos), pero no hay harness/registro ejecutable de esas mutaciones en la bitácora ni se pudieron reproducir con Vitest desde esta sesión. Se reporta **parcial**, no `arreglado-verificado`. La batería de revisión independiente es estática, demuestra la detección de cambios de fuente, no la capacidad de los tests de UI de ponerse realmente en rojo. El autor deberá adjuntar comandos reproducibles/resúmenes reales por mutación y la ronda siguiente tendrá que reproducirlos o indicar límite.

## CI y coordinación

| Job | Estado sobre `b94c6837` en consulta |
|---|---|
| unit | ✅ 130 files / 2172 tests |
| typecheck / lint / build / audit / bundle-budget | ✅ |
| db-tests | ⏳ sin resultado final al consultar |
| approval-policy | ❌ falta informe publicado en body |
| E2E Preview | ⏳ sin run verificable |

Se consultó todo el diff, bitácora y comentarios. `git merge-tree` no pudo ejecutarse desde el entorno sin clon; GitHub reportó mergeable `true`, no se interpreta como check exhaustivo de números/archivos de develop. La rama estaba 12 commits detrás de develop en la consulta: integrar `origin/develop` mediante merge, no rebase. **No se modificaron archivos de implementación ni se corrieron mutaciones contra remoto.**

## NO TOCAR

`docs/revision-pr/**` es de la revisión. No adulterar asserts, mocks, snapshots, CI, timeouts ni ocultar fallos. No tocar `e2e/**`, `src/domain/**`, `src/ui/**`, `supabase/**`, `src/server/**`, `.github/**`, `.agents/**` ni dependencias. Si una prueba falla tras quitar el global, encontrar la dependencia real y demostrar el arreglo.
