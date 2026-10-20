# PR #416 — T-372 (fix de fixture E2E T-302) — revisión independiente, ronda 1

**Fecha:** 2026-10-18. **HEAD auditado:** `a5a3dc5a5dabb0e07aee922f2857f67f8b9fb6bc`. **Base `develop`:** `1958c9aba18543c233a8809385adb65adfd023f1` (0 commits behind al revisar). PR Draft `feat/T-372-dni-unico-onboarding` → `develop`. **DICTAMEN: CON BLOQUEANTES (1).**

## Lo que se comprobó

- El diff de código tiene alcance limitado: `e2e/specs/courier-onboarding.spec.ts` (helper `pickAvailableDni` + sustitución en «Flujo 2»). Hay además ficha T-372 nueva, bitácora y fila nueva en el plan. No hay SQL, RLS, migraciones, workflows ni código de producto modificado. Issue #415 está abierto y asignado a Lautaro073.
- La función genera `20_000_000 + (digest.readUInt32BE(0) % 70_000_000)` (rango de 8 cifras compatible con `DNI_REGEX`), usa `randomBytes(8)` + ID de corrida + intento, HMAC SHA-256 y consulta `couriers` antes de elegir. Hay tope de 10 intentos y fallo explícito; el código no borra datos de otro repartidor. La unique constraint SQL sigue vigente ante una posible carrera entre la consulta y la escritura.
- La prueba T-302 usa ese DNI para sembrar al courier 1 de la misma corrida y pasa el DNI al courier 2 mediante `sessionStorage`. Las aserciones de `role=alert`, texto de duplicado y no navegar a `/courier/onboarding/status` son las originales.
- **RED real anterior:** [develop run 39090664594](https://github.com/cadeApp/cadeApp/actions/runs/39090664594), [PR #411 run 39094918384](https://github.com/cadeApp/cadeApp/actions/runs/39094918384), ambos fallan con `couriers_dni_hmac_key` al sembrar el DNI fijo.
- **GREEN E2E real del código:** [run 39098068311](https://github.com/cadeApp/cadeApp/actions/runs/39098068311), job `117588556782` hizo checkout exactamente de `b6396784` que contiene el fix. `Flujo 2` PASS (15,1 s); `chromium` 87 PASS; `global-settings` 3 PASS. **Esos tres global-settings son de suscripción T-306, no los tres nuevos de T-369 en la PR #411**, que aún no está mergeada. La diferencia `b6396784..a5a3dc5` es solo bitácora T-372 (no cambia código), comprobada con API compare de GitHub.

## PR416-H01 — BLOQUEANTE ALTO: la nueva ficha rompe el job unit

`docs/tasks/T-372.md`, primer ítem `## DoD`, contra `docs/implementation-plan.md`, fila T-372.

- `tools/verify-fichas.test.ts:149-165` **compara literalmente** `m?.[1]?.trim() !== esperado`, no equivalencia semántica.
- **Actual** en ficha: `El DNI del caso es válido (`DNI_REGEX`, 8 dígitos), se deriva de la corrida y del azar, y se usa solo si su HMAC no existe en `couriers`; si no hay uno libre en 10 intentos, el caso falla con un error explícito.`
- **Esperado** en plan (texto exacto): `**DNI único:** el caso «Flujo 2» elige un DNI de 8 dígitos cuyo HMAC no exista, conserva la deduplicación entre los dos repartidores de la corrida y el gate `e2e-preview` corre completo.`
- El [CI sobre HEAD `a5a3dc5`, run 39099606622, job unit 117592990643](https://github.com/cadeApp/cadeApp/actions/runs/39099606622/job/117592990643) falla concretamente en `tools/verify-fichas.test.ts`, `Desincronizadas: T-372`. Resumen: **1 failed, 2764 passed**. Los errores repetitivos `Not implemented: navigation` de jsdom en el log no explican el fallo final; la única aserción fallida es la de sincronía de fichas.
- **Corrección precisa, sin cambiar el contrato:** sustituir únicamente la **primera viñeta** de `## DoD` en `docs/tasks/T-372.md` por la celda del plan **literalmente** (copiar `**DNI único:** el caso «Flujo 2» elige un DNI de 8 dígitos cuyo HMAC no exista, conserva la deduplicación entre los dos repartidores de la corrida y el gate `e2e-preview` corre completo.` después de `- [ ] `). Mover el detalle adicional `DNI_REGEX`, `testRunId`, azar y 10 intentos a una **segunda viñeta**, sin borrar las demás. No tocar `tools/verify-fichas.test.ts` ni el plan.
- **RED→GREEN controlado por el revisor:** se aplicó en memoria el mismo algoritmo de igualdad sobre strings traídos del HEAD: red (actual ≠ esperado), verde al sustituir solo el ítem y comprobar igualdad. **No** se ejecutó Vitest local; el RED de CI y la prueba propia de equivalencia están respaldados en `evidencia/comandos.md`. Agy debe correr **el test original inalterado** y mostrar rojo/verde. Un cambio de expectation o salto del test está prohibido.

## CI y gates

- Del **HEAD de código `a5a3dc5`**: `typecheck`, `lint`, `build`, `audit`, `bundle-budget` SUCCESS; `unit` FAIL por H01; `db-tests` IN PROGRESS en la consulta; `approval-policy` FAIL por informe de revisión placeholder. El `e2e-preview` del HEAD figuraba PENDING (run [39099674982](https://github.com/cadeApp/cadeApp/actions/runs/39099674982)); no declararlo verde.
- El E2E de código `b6396784` PASS no es un PASS del gate sobre el HEAD documental nuevo, pero sí evidencia de que el arreglo de DNI funciona en ejecución. La bitácora registra el SHA y la corrida exactos.
- No se ejecutaron Playwright, Vitest, Docker ni Supabase desde la sesión de revisión, ni se usaron secretos. La inspección independiente del código y log reproduce el fallo documental; no se afirma que la prueba E2E pasó sobre un HEAD distinto.
- No hay otra decisión de producto pendiente para corregir H01. Una línea de ficha + segunda viñeta, sin ampliar el alcance ni crear dependencias.

## Dictamen y próximos pasos

**CON BLOQUEANTES (1).** Corregir el primer ítem del DoD en la ficha, correr `pnpm exec vitest run tools/verify-fichas.test.ts`, luego la suite unit completa; registrar resultados reales en bitácora y obtener CI verde de código/doc afectados. No exigir E2E nuevo **solamente** porque se actualizó la bitácora o la revisión documental, pero nunca declarar un check rojo como verde. La próxima revisión independiente cerrará el hallazgo. No aprobar ni mergear #416 aún; la #411 se sincroniza contra develop tras merge de #416 y revalidará su propio gate.