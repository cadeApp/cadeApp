# PR #330 — Ronda 1 independiente (2026-10-14)

Revisión del HEAD 2a9e5e4c0e8545b67f29371a09117f565e5adee8 contra develop 205a93f9de8a68c6aa1d064564f2c016b8be8201.
**RESULTADO: CON BLOQUEANTES (5).** Sin aprobación ni merge. Decisión B aprobada por Lautaro073 para H03.
Responsable activo: KiraK72, suplente asako669. No repartir trabajo.

## Hallazgos
### PR330-H01 — Se omite mark_picked_up previo a mark_drop_* [alto]

Archivo e2e/specs/multi-drop.spec.ts:643. El estado matched no cumple precondición SQL in_transit. Migración t340_multi_drop líneas 1048,1194.
Estado: abierto; detectado mediante inspección del SHA indicado. Corrección y test negativo en comentario único de la PR.

### PR330-H02 — La oferta se fabrica mediante admin.insert [alto]

Archivo e2e/specs/multi-drop.spec.ts:605. Evita submit_offer como repartidor autenticado; E2E no demuestra precio/oferta real.
Estado: abierto; detectado mediante inspección del SHA indicado. Corrección y test negativo en comentario único de la PR.

### PR330-H03 — Cinco solicitudes de DB separadas no ofrecen atomicidad ni rollback [alto]

Archivo src/features/requests/actions.ts:67. Errores después del draft dejan filas parciales; RLS no permite DELETE merchant del padre. Decisión B autoriza RPC, issue #331.
Estado: abierto; detectado mediante inspección del SHA indicado. Corrección y test negativo en comentario único de la PR.

### PR330-H04 — Falta prueba de totalAmountArs, collectibleAmountArs, idempotencia y payload privado [alto]

Archivo e2e/specs/multi-drop.spec.ts:598. Verifica algunos UI negativos y status final, pero no totalidad de invariantes CC-022.
Estado: abierto; detectado mediante inspección del SHA indicado. Corrección y test negativo en comentario único de la PR.

### PR330-H05 — Aserción non-null prohibida y también presente en E2E [medio]

Archivo src/features/requests/actions.ts:138. dropByPosition.get(i + 1)! y dropsRows[0]! y dropContactsRows! incumplen AGENTS.md §4.
Estado: abierto; detectado mediante inspección del SHA indicado. Corrección y test negativo en comentario único de la PR.

## Riesgo por análisis, NO fallo demostrado
GPS en create-request-form.tsx líneas 113–140 captura index en callback asíncrono. Si se elimina un drop previo, el índice puede quedar obsoleto. Exigir prueba de geolocation diferida antes de atribuir un bug; si se reproduce, usar identidad field.id en callback.

## CC / decisión B
La opción B del dueño requiere una RPC transaccional de alta+publicación con contrato formal, pruebas SQL/RLS/concurrencia, idempotencia y despliegue compatible. Issue https://github.com/cadeApp/cadeApp/issues/331. Contract-change debe completar su PR y migrarse primero, antes de que el escritor actualizado de #330 pueda E2E contra Develop.

## Método y límites
Leídos patch de PR330, ficha T-340 desde develop, CC-022, migraciones SQL de multi-drop y clean-legacy, AGENTS.md, skills de revisar-pr y contract-change, comentarios y bitácora. Diff de 11 archivos, sin archivos fuera de la lista autorizada original.
No se corrieron tests locales, Docker, Supabase ni mutaciones por el revisor. La evidencia es lectura de código y SQL; no se certifica RED/GREEN inexistente. Bitácora de autor declara tests pero no son tests ejecutados por la revisión.
No se alteró código funcional. Solo se registró este informe en docs/revision-pr/pr-330. El nuevo commit cambia el HEAD y cualquier CI debe corresponder a ese HEAD.

