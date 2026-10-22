# Informe revisar-pr — T-410 — 2026-10-22 — revisión independiente

**PR:** https://github.com/cadeApp/cadeApp/pull/510  
**Head de código inspeccionado:** `2270c2f47a2e3fa1e04d159338236771ae73c179`  
**Base:** `develop` @ `17960c76be5e75c1655a4a2eefe6aad02ad95fd8`  
**Resultado:** **CON BLOQUEANTES (3)**  
**Checks:** typecheck ✅, lint ✅, build ✅, audit ✅, bundle-budget ✅, db-tests ✅, unit ❌ (cobertura); E2E real pendiente del rollout autorizado.  
**Método:** análisis de código/contrato/pruebas y consulta de los logs CI. Sin clon ni pruebas locales independientes (no fue posible resolver github.com desde el contenedor). No se afirman mutaciones ejecutadas para H02/H03.  
**NO APROBADO · NO MERGEADO.**

## PR510-H01 — Bloqueante alto: falta cobertura real del fake

**Archivo:** `src/domain/testing/rpc-fake.ts:3721-3792` y `src/domain/cc037-admin-list-trips.test.ts`.

**Diagnóstico:** El fake incorpora `admin_list_trips` con ramificaciones por rol/AAL, estado, problemas, legado, ofertas, conteos y cursor. Pero la nueva suite CC-037 del dominio valida solo `RPC_CONTRACTS` y no ejecuta `createFakeRpcClient(...).admin_list_trips(...)`. El `unit` de CI, aunque tiene 3239 tests pasando, falla en cobertura de branches.

**Evidencia [CI verificada]:** run [39732982955](https://github.com/cadeApp/cadeApp/actions/runs/39732982955), job `119672045460`, SHA `2270c2f47a2e3fa1e04d159338236771ae73c179`: `Test Files 164 passed`, `Tests 3239 passed`, `ERROR: Coverage for branches (88.08%) does not meet "src/domain/**/*.ts" threshold (90%) for src/domain/testing/rpc-fake.ts`.

**Arreglo:** agregar pruebas del fake REAL en `src/domain/cc037-admin-list-trips.test.ts` con seeds/actores controlados: admin aal2, comercio, repartidor, admin aal1; `all` y `problems`; failed drop, courier release, no-show, cancelación e incidente; caso sano, borrador, legacy; oferta accepted; conteos, límite 1–50, cursor y empates de microsegundos e ID, `nextCursor:null`. Probar la salida real de `fake.admin_list_trips` en vez de solo schemas. Para llegar al 90 %, cubrir otras ramas reales faltantes sin cambiar thresholds, mocks/expectations ni excluir archivos.

**Mutación RED exigida al agy:** neutralizar solo en memoria/copia temporal `row.failedDrops > 0` en `admin_list_trips`; el test del filtro de fallas tiene que ponerse rojo y verde tras restaurar. Añadir mutación de comparador keyset que cambie el resultado de paginación. Nunca commitear la mutación.

## PR510-H02 — Bloqueante alto: sección «Entregas» vacía para solicitudes legacy

**Archivo:** `src/features/admin-trips/components/admin-trip-detail.tsx:74-114`.

**Diagnóstico [ANÁLISIS]:** el encabezado ya contempla `trip.drops.length===0` como una entrega si la solicitud es `delivered`, pero el render de «Entregas» ejecuta `trip.drops.length === 0 ? null`. El admin ve «1 de 1 entregadas» sin resultado de esa entrega, contraviniendo el DoD que pide el resultado de cada entrega. No hay test de UI con `drops:[]`.

**Arreglo:** para legacy sin drops y `delivered`, renderizar «Entrega 1» → «Entregada», sin motivo inventado ni contactos; si otro estado no tiene registro individual, comunicar «Sin resultado individual registrado» en lugar de inventar `failed`. Mantener intocados los drops reales con fallas y sus motivos. Añadir pruebas de render para legacy entregado y no entregado.

**Mutación RED exigida:** restaurar temporalmente el render `trip.drops.length === 0 ? null`; la prueba legacy tiene que fallar y volver a pasar al reponer el arreglo.

## PR510-H03 — Bloqueante medio: tests de queries no comprueban filtros

**Archivo:** `src/features/admin-trips/queries.test.ts:16-27,179-212`.

**Diagnóstico [ANÁLISIS]:** el método `.eq()` del mock devuelve `chain` sin almacenar ni aplicar el predicado, y la respuesta está prefijada por tabla. Un cambio que quite la condición `request_id=requestId` de las lecturas de drops/motivos/incidentes podría seguir con tests verdes. La privacidad comprobada por las listas de columnas no reemplaza el aislamiento por ID.

**Arreglo:** hacer que el mock registre/aplique `.eq(column,value)`, verificar `delivery_requests.id=requestId`, el `request_id` de drops, motivos e incidentes, y `offers.id=accepted_offer_id` en su lectura condicional. Añadir fixture adversaria de otra solicitud para evitar mezclar datos. Conservar las pruebas de ausencia de contactos.

**Mutación RED exigida:** quitar temporalmente la llamada `.eq('request_id', requestId)` de la lectura de drops. La nueva prueba debe fallar con el error de filtro/mezcla y pasar al restaurar.

## PR510-H04 — Mejora documental tomada

**Decisión:** 1-A aceptada por Lautaro073. Además autorizó ampliar la ficha T-410 solo con `docs/contracts/CC-037.md` para cambiar la frase `Fake de dominio a actualizar: no` por `sí`. Se implementó en `017da834`; es un cambio documental, no verificación funcional y no altera los parámetros, permisos ni salida de `admin_list_trips`.

## Seguridad y falsos positivos evitados

- El SQL llama a `app_private.assert_admin_aal2()` antes de leer, fija `search_path`, tiene grants/revokes y evita las tablas de contactos; por inspección no se detectó ruptura en esas propiedades.
- El filtro por problemas ocurre en SQL antes del `LIMIT`; el keyset conserva precisión microsegundos.
- La PR no debe exponer motivos en lista, ni datos del destinatario en detalle, logs o analytics.
- No se exige `e2e-preview` contra Develop sin migrar para mergear: así está decidido en T-410. **No se considera ejecutado** el E2E local exigido después de `migrate-develop`, antes de promover.

## Comprobaciones y alcance de CI

- **CI del SHA `2270c2f47a2e3fa1e04d159338236771ae73c179`**: `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: success. `db-tests`: success; `cc037_admin_list_trips.sql ... ok`, `Files=36, Tests=3101`, `Result: PASS`. `unit`: failure de branch coverage.
- **RED histórico del autor contrastado con log**: PR aislada #511 (run 39729848417), sin la migración: `admin_list_trips does not exist`, `Files=36, Tests=3057`, FAIL. Esto no demuestra H02/H03.
- Mutaciones nuevas del revisor: **no ejecutadas**, por ausencia de clon. Las instrucciones para reproducirlas y sus límites están en `evidencia/comandos.md`. No se debe marcar `arreglado-verificado` ningún hallazgo solo con lectura, tests preexistentes o prueba del autor.

## Ronda siguiente

1. `git pull` de la rama (primero obtener el commit de revisión); no rebase, amend ni force-push.
2. Agy corrige H01–H03 en archivos cerrados indicados en el comentario de PR; prohíbe falsificar RED/GREEN.
3. Corre pruebas específicas, `pnpm test:coverage`, `pnpm typecheck && pnpm lint && pnpm test`; la revisión comprueba CI y `db-tests` del nuevo SHA.
4. Bitácora por el autor: «hecho / pruebas / falta»; commit con [T-410], push y `git ls-remote`. No editar `docs/revision-pr/**`.
5. Revisor publica nueva `revisiones/ronda-2.md` sin reescribir ronda 1; chequea `merge-tree`, conflictos y alcance.
