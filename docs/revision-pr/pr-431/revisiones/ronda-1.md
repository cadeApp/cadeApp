# Informe de revisión — PR #431 / T-375

**PR:** https://github.com/cadeApp/cadeApp/pull/431  
**HEAD inicial del autor:** `0c50d73cdb9d676d9bb8d2afe6e502d5d3f32356`  
**HEAD revisado:** `580a1e64ccd8ed178d3e407fee61e0750098653c`  
**Base:** `develop` @ `1e69477dae1e50cd67c307c9a0f987366f90c98e`  
**Fecha:** 2026-10-19

## Informe revisar-pr

**Resultado: SIN BLOQUEANTES** por inspección, para la PR de ficha (no implementación).

**Checks locales:** typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db n.a.  
**CI disponible:** `unit`, `lint`, `typecheck`, `build`, `audit` y `bundle-budget` reportaban success en el commit original; `db-tests` todavía en progreso al consultar. `e2e-preview` pending; no se declara verde. No se exigirá nueva corrida únicamente por el agregado del informe.

## Alcance y contraste

El diff inicial tiene **únicamente** `docs/tasks/T-375.md` (nueva ficha) y la fila T-375 de `docs/implementation-plan.md`. No hubo cambios de producto, SQL, configuración o suites. La tarea no existía en `develop`, así que se evaluó la ficha nueva contra el issue #430, el plan, `e2e/AGENTS.md`, la regla 40, `playwright.config.ts`, y los tres specs citados.

- Verificado: `publication-credits.global-settings.spec.ts` apaga el piloto en `withPilot(false)` y restaura en `finally` el valor leído al principio.
- Verificado: `subscription.global-settings.spec.ts` usa lectura del valor original y varios `finally` para restaurarlo.
- Verificado: `publication-credits.spec.ts` (proyecto chromium) exige `pilot_active=true` sin cambiarlo.
- Verificado: `e2e-preview` corre chromium y luego global-settings con un solo worker, y usa una exclusión de concurrencia compartida sobre Develop.
- Evidencia externa: el job del run 39305230026 mostró timeout de 60000 ms en el primer intento de `publication-credits.global-settings`; su retry pasó, pese a lo cual el incidente pudo contaminar el estado posterior. Esto no demuestra por sí solo el estado final de DB, que se sustenta además en el issue #430.
- Referencia Playwright: el timeout de test no consume el timeout separado de `afterEach` / desmontaje de fixtures. Ver https://playwright.dev/docs/test-timeouts. Ello justifica el diseño ante un timeout normal de prueba, **no** ante un kill abrupto del worker, apagado del runner o imposibilidad prolongada de acceder a la base.

## Observación preventiva integrada a la ficha

**Ubicación:** `docs/tasks/T-375.md`, apartados «Decisión de diseño» y «DoD».  
**Tipo:** precisión documental, no defecto de la implementación (todavía no existe).  
**Acción del revisor (commits `86a7b21` y `580a1e6`):** se añadió un guard de responsabilidad: la precondición verifica el valor base antes de habilitar restauración; los hooks se activan solo si la prueba asumió la posible mutación ANTES de intentar la escritura. Se exige un test negativo donde el almacenamiento inicia en `false` y ni `afterEach` ni `afterAll` lo cambian.

**Motivo:** de otro modo un `afterAll` incondicional podría encender silenciosamente un estado sucio que la ficha exige detectar, y una escritura aplicada pero fallida al responder podría eludir la recuperación. Se precisó además que Playwright reinicia el worker después de un timeout: una variable de módulo nueva en el siguiente worker es un falso GREEN, por lo que el estado debe inspeccionarse en el `afterEach` del worker original o en un almacén de memoria externo al proceso trabajador. El test intencionalmente expirado sigue fallando; el GREEN es el de la aserción de recuperación y el gate completo se verifica por separado. Fuente del contrato: https://playwright.dev/docs/test-retries. Son prevenciones derivadas por inspección, no fallas ya reproducidas del código.

## NO TOCAR — falsos positivos descartados

- No se exige aquí demostrar RED→GREEN de la implementación: esta PR **solo autoriza** el trabajo y el DoD obliga a hacerlo en la siguiente PR.
- No se amplía el alcance a `playwright.config.ts`, workflows, otros specs, fixtures, semillas ni código productivo.
- No se obliga a modificar el estado remoto para reproducir un timeout; la reproducción en memoria con Playwright real preserva la seguridad del ambiente compartido.
- `test.afterEach` no se considera garantía ante terminación abrupta del proceso; la ficha cubre únicamente timeouts normales de test.

## Qué deben demostrar al implementar

1. Con piloto inicialmente `true`, si el cuerpo queda esperando dentro de `withPilot(false)` y vence el timeout, el estado termina `true` (lectura de verificación posterior); con el patrón viejo queda `false`. Se debe ejercer Playwright real, no solo llamar una función de limpieza manualmente.
2. Con piloto inicialmente `false`, la precondición falla y ningún hook lo altera; un retry no acepta ese estado como origen válido.
3. Si la escritura a `false` se aplica pero falla la respuesta, la responsabilidad ya está registrada y el cleanup restaura `true`.
4. El mecanismo usa la implementación del helper real, no una simulación que saltea el código bajo prueba; no se crean tests falsos ni se adulteran aserciones para obtener GREEN.
5. La batería real de `e2e-preview` pasa en Develop, con los dos specs y las aserciones existentes conservados; cualquier cleanup fallido hace fallar el E2E.

## Por qué los checks verdes no bastan

La PR solamente cambia documentación. Los checks verifican estructura, lint, tipos o integración general, pero **no prueban todavía** los hooks de restauración de T-375. Esa garantía requiere el harness RED→GREEN de la siguiente PR y el E2E de Develop.

## Metodología y límites

Se compararon archivo y plan desde la conexión GitHub contra `1e69477dae1e50cd67c307c9a0f987366f90c98e`, se leyeron las reglas de revisión, comentarios, issue #430, specs y workflow; se inspeccionó el log del run 39305230026. Se comprobó que el commit `580a1e64ccd8ed178d3e407fee61e0750098653c` incorpora la precisión documental. No había clon local accesible ni conectividad Git desde el runtime: **no** se ejecutaron `git merge-tree`, `pnpm`, mutaciones ni pruebas locales; `mergeable=true` proviene de GitHub y no se presenta como resultado de `merge-tree`. La ficha del DoD se verifica por inspección y por los checks CI que habían terminado.

No se realizó aprobación ni merge.
