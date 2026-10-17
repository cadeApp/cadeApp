# PR #358 / T-356 — Revisión independiente — Ronda 5 — 2026-10-17

**Dictamen: SIN NUEVOS BLOQUEANTES DE CÓDIGO POR INSPECCIÓN; GATE E2E DEL HEAD PENDIENTE. NO MERGEAR AÚN.**

**SHA funcional revisado:** `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`. **Base develop observada:** `711a2f7054d77fd664d3ec09b3bbdd24efb88476`. Estado GitHub durante revisión: PR OPEN/DRAFT, mergeable=true, compare `develop...HEAD` 0 behind y 24 ahead. Los commits nuevos sobre la ronda 4 son `21732e6c` (helper y tests) y `ed4a118f` (aserción E2E y bitácora).

## Revalidación H06: ARREGLADO-VERIFICADO con alcance específico

- **Implementación comprobada en código:** `src/features/courier-onboarding/upload-manager.ts:getDocumentExtension` prioriza estrictamente `file.type`: image/jpeg→jpg; image/png→png; image/webp→webp; application/pdf→pdf; MIME desconocido lanza excepción. `buildCourierStoragePath` aplica el sufijo antes de Storage y `uploadCourierDocument` conserva contentType y `upsert:false`.
- **Pruebas nuevas:** `upload-resilience.test.ts` incorpora 4 tests (alias JPEG .jfif/.jpe/.tiff, JPEG tras compresión de PNG, MIME válidos, MIME inválido sin upload y fake Storage con ruta verificable). Ningún test del autor se marcó independientemente verificado sin comprobación propia.
- **Mutación independiente real del algoritmo:** extraje mediante el conector GitHub el cuerpo exacto de `getDocumentExtension` en `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`, lo ejecuté como JavaScript puro V8 en sesión aislada (sin reescribir el switch), y ejecuté 10 entradas (8 válidas, 2 que deben lanzar): **GREEN 10/10**. Modifiqué solo el string del cuerpo en memoria para reintroducir `file.name.split('.').pop()`: **7 casos RED por salida incorrecta/no lanzar error**. Restauré cuerpo intacto: **GREEN 10/10**. También ejecuté cuerpo extraído de `buildCourierStoragePath`, confirmando `courier/<uuid>/license_1700000000000.jpg`. Método exacto y script reproducible desde checkout en `evidencia/comandos.md`.
- **Límite del método:** se ejecutaron los **cuerpos reales extraídos del archivo remoto** como funciones JS, pero NO el archivo TypeScript con imports, mocks ni suite Vitest propia en un clon. Esto verifica específicamente la función y su sensibilidad; el resultado de integración dentro del proyecto proviene del CI real del HEAD. Nunca llamarlo «E2E independiente».
- **Test E2E ajustado:** `e2e/specs/courier-onboarding.spec.ts` conserva aserción estricta de ruta, cambia `license_\\d+\\.png` por `license_\\d+\\.jpg`. Es coherente con `compressImage` que transforma PNG a MIME JPEG preservando `file.name`; no se eliminó aserción ni ocultó resultado. Run previo `39049776421` fue **FAIL (85/86 Chromium PASS)** por la expectativa anterior, no contarlo como PASS.

## Checks verificados por GitHub sobre el SHA exacto

- [CI run 39052207646](https://github.com/cadeApp/cadeApp/actions/runs/39052207646) SUCCESS: log **unit 139 Test Files / 2618 Tests PASS**, **db-tests 27 archivos / 2420 pgTAP PASS**, con typecheck, lint, build, audit y bundle-budget SUCCESS.
- [approval-policy run 39052205218](https://github.com/cadeApp/cadeApp/actions/runs/39052205218) SUCCESS. Esto no equivale a aprobación independiente de contenido.
- [E2E Preview run 39052264162](https://github.com/cadeApp/cadeApp/actions/runs/39052264162), job `117453108213`: en la última lectura, `Verify Supabase Develop target=SUCCESS`, `Health check=SUCCESS`, **`Run preview E2E gate=IN_PROGRESS`**. NO afirmar 86/86, no marcar PASS, no autorizar merge con esa evidencia incompleta. El run 39049776421 del SHA anterior fue rojo 85/86 y no sustituye el gate actual.

## Estado de hallazgos y alcance

- PR358-H06: **arreglado-verificado específicamente en el helper**, con ejecución independiente del cuerpo de la función, mutación en memoria y CI real posterior; `verificado_en_sha=ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`.
- H03/H04/H05, R02/R03, H01/H02: siguen **arreglado-sin-verificar** en la clasificación previa; no invento mutaciones propias para esas áreas. R01 continúa `parcial` por la dependencia de limpieza aprobada aparte.
- Cambios R5 desde R4: solamente `upload-manager.ts`, `upload-resilience.test.ts`, `e2e/specs/courier-onboarding.spec.ts`, `docs/tasks/log/T-356.md`, todos dentro de allowlist. `docs/tasks/T-356.md` en diff global solo marca checks DoD, no amplía archivos ni dependencias respecto de develop.
- T-370 / [issue #399](https://github.com/cadeApp/cadeApp/issues/399) sigue abierta como **gate obligatorio ANTES de promoción CC-025 a staging o main**, pero no bloquea en sí misma la integración de la UI a develop. No cerrar [issue #363](https://github.com/cadeApp/cadeApp/issues/363).

## Condición pendiente, sin cambios de código pedidos

Esperar a **comprobar el resultado final del E2E de HEAD `ed4a118f12a2ee384b67d60c875ec8d5bfb6e8ad`**: job `117453108213`, contenido de su log, pruebas Chromium/visuales ejecutadas, cero fallos, y status publicado por `report-preview-status`. Si es GREEN real y GitHub sigue mergeable, se puede solicitar dictamen de gate final sin ronda de cambios funcionales; **no requiere repetir CI solo por este commit documental de revisión**. Si falla, abrir hallazgo de código/prueba con causa real, no ajustar mocks/assertions para forzar verde. No aprobar ni mergear #358 sin solicitud expresa de Lautaro073.

## Método y transparencia

Inspección exacta de fuentes GitHub y runs, ejecución independiente en V8 de cuerpos fuente extraídos de `getDocumentExtension`/`buildCourierStoragePath`, mutación en memoria sin cambios de rama. **No** pnpm local, Docker, SQL remoto, Playwright propio, ni modificación funcional por el revisor.
