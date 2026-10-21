# Revisión independiente — PR #454 / T-384 — Ronda 3

**Fecha:** 2026-10-20 · **SHA de código revisado:** `5ebda83932d8279a7f88e61e70694d0136ed8fc5` · **base:** `develop@fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`.
**Rama:** `feat/T-384-cc033-optional-document` · **PR:** Draft · **Resultado:** **SIN BLOQUEANTES de código detectados (por inspección + CI)** · **Decisiones 🔵:** ninguna.

## Sincronización, alcance y propiedad

Se consultó GitHub por PR, comentarios, bitácora, ficha T-384 y CC-033 desde develop y el diff de la corrección respecto de la revisión `7e0712a5`: tres commits posteriores, cero behind; únicamente `supabase/tests/cc033_add_courier_optional_document.sql`, `src/domain/testing/rpc-fake.ts`, `src/domain/cc033-add-courier-optional-document.test.ts` y `docs/tasks/log/T-384.md`. No se tocó la carpeta independiente desde ronda 2. El diff total de la PR sigue dentro de los archivos permitidos (17 archivos), sin alteración de la ficha ni UI. GitHub informa `mergeable=true`, no prueba suficiente de todos los requisitos de protección de rama.

`git fetch`, `merge-tree` y la ejecución Vitest local no pudieron practicarse en este entorno: `git ls-remote` falla por DNS `Could not resolve host: github.com`. Se usó la lectura directa del conector GitHub y el estado de CI. No se ejecutó PostgreSQL ni Docker local, conforme T-384.

## Revalidación de ronda 2

| Hallazgo | Observación independiente sobre `5ebda839` | Estado |
|---|---|---|
| **H01** | pgTAP ahora crea Storage para license del pending, prueba respuesta y documento vigente, `license_status=submitted`, `doc_level=0` (líneas 38,75–78). Fuerza perfil eligible approved a `reconsent_required`, exige `P0001/UNAUTHORIZED_ACTOR`, 0 documentos y 0 auditorías y luego restaura active (55–63). INSERT directo usa `throws_ok` con SQLSTATE exacto `42501` (130). Job db-tests pasó: 34 archivos / 3019 tests. | **Corregido; inspección + CI, sin mutación propia de Postgres.** |
| **H03** | Fake RPC eliminó flag `i` de regex de sufijo (línea ~2976). Test tiene `.PNG` *presente* en Storage y exige `VALIDATION_ERROR` (168–185). Comparación independiente extraída de las regex originales: `.PNG` con fake actual = false, SQL = false; regex mutante `/i` = true (RED aislado de la propiedad, no ejecución de FakeRpcClient). | **Corregido; inspección + CI + semántica regex independiente.** |
| **H04** | Suite ahora cubre merchant y reconsent_required con rechazo y sin efectos, `approved` para license/insurance, `getDocument(documentId)` con kind/path/isCurrent/status, estado del courier y retry sin UUID duplicado (líneas 91–165). Unit CI: 152 archivos / 2965 tests; `rpc-fake.ts` ramas 90,69 %. | **Corregido; inspección + CI, sin mutación propia de FakeRpcClient.** |
| **H02** | Se mantiene suite de 4 carreras de dos sesiones más mutación de locks; `db-tests` del SHA nuevo pasó. | **Sin regresión observada; mutación del autor en CI, no propia.** |
| **H05** | Test del wrapper comprueba nombre y payload; cambios de ronda 3 no tocaron wrapper. Unit CI verde en HEAD. | **Sin regresión observada; sin mutación propia.** |
| **H06** | `db-tests` terminó SUCCESS después de `git diff --exit-code -- src/types/database.types.ts`. | **Verificado en este SHA mediante CI.** |
| **H07** | Desde `7e0712a5` no hubo nueva edición de `docs/revision-pr/**` por el autor. | **Observación de proceso histórica, no bloqueante.** |

La bitácora del autor declara mutaciones temporales de role/consent/documents.set con RED y GREEN. **No fueron reproducidas por este revisor**; no se convierten en `arreglado-verificado` por ese relato.

## CI y el check de Preview

- [CI run 39444717225](https://github.com/cadeApp/cadeApp/actions/runs/39444717225), HEAD `5ebda83932d8279a7f88e61e70694d0136ed8fc5`: **build, lint, typecheck, unit, db-tests, audit, bundle-budget: SUCCESS**.
- Unit job **118703452341**: `Test Files 152 passed`, `Tests 2965 passed`, `rpc-fake.ts` branch coverage **90.69 %**.
- DB job **118703452788**: `cc033_add_courier_optional_document.sql .. ok`; `Files=34, Tests=3019, Result: PASS`; job SUCCESS, incluida generación/compare de tipos. Las líneas `Failed test` de otras suites aparecen dentro de mutaciones intencionales, no en el resumen de TAP final.
- `e2e-preview`: **estado de commit ERROR, descripción `BLOCKED / REQUIRES DEVELOP MIGRATION`**. El workflow separado 39444841967 concluyó SUCCESS, pero su job `e2e-preview` quedó SKIPPED (no se corrió Playwright). La lógica vigente de `.github/workflows/e2e-preview-target.mjs` marca **toda PR con `supabase/migrations/`** como blocked y publica `error`, porque la base Develop compartida no tiene todavía la migración de esa rama. No es una falla funcional demostrada. Según T-384 el E2E pertenece a T-376 **después** del merge y `migrate-develop`; no declarar E2E verde ni manipular su gate.

**Límite operacional:** la consulta de protección de `develop` dio 403 con esta integración. No pude confirmar si el contexto `e2e-preview` es requerido para merge. Si fuese requerido, el merge se bloquearía aun sin defectos de código; no debe saltarse el gate sin resolver la política del repo.

## Evidencia y cierre

Se ejecutó en memoria la comparación **exacta** de regex extraídas de los blobs del fake y la migración: `.jpg` acepta, `.PNG` rechaza; al agregar `i` la misma extensión pasa (mutante detectado a nivel de expresión). También se inspeccionó que las aserciones de pgTAP y Vitest nombradas están presentes. **Esto no equivale a correr Vitest con mutantes ni a ejecutar una mutación PostgreSQL independiente**. Evidencia completa y arnés reproducible en [comandos.md](../evidencia/comandos.md).

**Dictamen:** **SIN BLOQUEANTES de implementación detectados**, según inspección de cambios y CI oficial. **No aprobar ni mergear automáticamente**. Pendiente operativo tras el merge: confirmar `migrate-develop` y solo entonces habilitar T-376; si `e2e-preview` es requerido, aclarar antes cómo se compatibiliza con el diseño de migración posterior al merge. El commit documental de esta ronda moverá HEAD, pero **no exige repetir CI solo por documentación**.
