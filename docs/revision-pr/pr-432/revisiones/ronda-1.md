# Informe independiente — PR #432 / T-375 — ronda 1

**Fecha:** 2026-10-19  
**Código revisado:** 35b2792ba68eaff8c33d4e7851e056098e8ac87a  
**Base:** develop, d9b49647f484b5f1b5a502225e9f3b6f95d7402a  
**Resultado:** **SIN BLOQUEANTES EN T-375**; 1 decisión aceptada y aislada en issue #433. No se aprobó ni mergeó.

## Alcance y sincronización

- Ficha T-375 leída desde develop. Comparación mecánica de 5 archivos: todos en «Archivos permitidos».
- La modificación de docs/tasks/T-375.md solo cambia el marcado de casillas DoD; no agrega alcance.
- GitHub compare: rama 1 commit ahead / 0 behind; mergeable=true. No se ejecutó git merge-tree en clon (no había acceso de red para clonar).
- Se revisaron descripción, bitácora y comentarios: no había una ronda previa independiente ni archivos pr-432 en la rama.
- En los dos specs, los cambios se limitan al ciclo de pilot_active: no cambian las aserciones de negocio, pasos, timeouts, retries, ni Playwright config.
- El helper usa PILOT_BASELINE=true, assertBaseline fail-closed, registra mustRestore antes de store.write, restaura en finally y hooks afterEach/afterAll, y relee el valor restaurado.
- No se detectaron cambios de contratos, dependencias, rutas de producto, SQL ni secretos.

## Comprobaciones del SHA revisado

| Control | Evidencia | Resultado |
|---|---|---|
| Unit | CI run 39336725694, job unit 118347962438: Test Files 148 passed; Tests 2890 passed | PASS |
| Typecheck, lint, build, audit, bundle-budget | CI run 39336725694 | PASS |
| db-tests | CI run 39336725694, job 118347962650: pgTAP 31 archivos / 2868 pruebas, Result: PASS; comprobaciones RED de otras tareas son intencionales y se restauran | PASS |
| Verificación de tipos generados | job db-tests, paso git diff --exit-code | PASS |
| e2e-preview Chromium | run 39336816251, job 118348338164: 91 passed (26.5m) | PASS |
| e2e-preview global-settings | mismo run/job: 6 passed (2.8m), 3 créditos y 3 suscripción | PASS |
| Helper aislado independiente | código de helper de 101 líneas, SHA-256 a5f1c1e423ffcb1dd73afa2d1e74413913901fc772f7deed880d31f0e822ab70; 9 escenarios y 3 mutaciones in-memory | 12/12 |
| approval-policy en HEAD de código | falló antes de informe de revisión | No es defecto del código; publicar informe |
 
**Límites de verificación:** el harness temporal Playwright usado por el autor fue borrado, tal como preveía la ficha. Su RED/GREEN de timeout intencional está documentado en la bitácora, pero **no fue reproducido literalmente por la revisión independiente**. La revisión sí ejecutó el helper exacto en Node con almacenes in-memory y tres mutaciones independientes. El E2E oficial ejercita Playwright y la integración contra Develop sin timeout artificial. No se afirma un RED real independiente de Playwright ni se tocó Supabase remoto.

## D01 / PR432-H01 — riesgo adicional (ACEPTADO, NO BLOQUEANTE)

**Archivo:** e2e/helpers/pilot.ts, funciones createPilotGuard.set / restore.

**Diagnóstico:** si una llamada write(false) queda pendiente cuando corre afterEach, restore puede escribir y releer true, pero una llamada anterior puede terminar más tarde y escribir false. Es una secuencia observable en un PilotStore controlado; **no está demostrado en PostgREST/Supabase**. El caso no es el timeout del cuerpo descrito por el DoD.

**Demostración:** escenario 09 del harness: store.write(false) bloqueada; restore() escribe true; se libera la operación vieja y la lectura final es false. Evidencia determinista en memoria, sin escritura remota.

**Decisión de Lautaro073 (2026-10-19): opción A.** Mantener T-375 y estudiar el riesgo separado en https://github.com/cadeApp/cadeApp/issues/433. No ampliar la tarea ni introducir un lock cuya eficacia no fue contrastada. Se registra como decisión aceptada, **no como defecto corregido**.

## NO TOCAR — revisado y descartado

- No pedir restaurar «original» inicial: un valor false contaminado perpetuaría el incidente.
- No auto-reparar un false antes de beforeAll: viola fail-closed de la ficha.
- No exigir restaurar snapshot del comercio en afterEach de esta tarea: T-375 restringe los dos specs al manejo de pilot_active; los finally de suscripción siguen igual.
- No alterar timeouts, retries ni gate de GitHub.
- No repetir CI solo porque este informe añada archivos documentales, salvo cambios efectivos de código.

## Evaluación

Se acepta la solución de T-375 para la causa raíz reportada. Lo comprobado en Playwright real por CI es GREEN en ejecución normal; la tolerancia a timeout artificial se apoya en el diseño de hooks, el RED/GREEN registrado por el autor y la verificación independiente de lógica, **no** en un timeout reproducido en esta revisión. El único riesgo adicional identificado queda fuera de la PR por decisión explícita.

**Acción manual pendiente:** cuando el reporte de revisión esté publicado y el check approval-policy actualizado, Lautaro073 deberá decidir marcar el Draft como Ready y realizar el merge. La revisión no realiza esas acciones.
