# Revisión independiente — PR #617 / T-407 — Ronda 1 (2026-11-05)

**Resultado: CON BLOQUEANTES (2).** SHA revisado: `8116e2397d9a28504024850be4ae31913d35abdc`. No aprobar ni mergear.

## Alcance y fuentes

- Ficha `docs/tasks/T-407.md` leída desde `develop` y contrastada con la versión del PR; 16 archivos cambiados dentro de «Archivos permitidos».
- Consultados diseño `docs/design/stitch/04-admin.md` (A06), bitácora T-407, comentarios, pruebas unitarias y código de la RPC `admin_resolve_incident` (CC-012).
- La ficha y la fila T-407 del plan habían diferido la nota de inmutabilidad sin autorización inicial. **Lautaro073 confirmó D01=B el 2026-11-05.** Se acepta el cambio de alcance; la nota depende de T-408 y de los tests SEC-02. No exigir una afirmación falsa.
- GitHub indicó `mergeable: true` al comienzo. No se corrió `git merge-tree` localmente; no se da esa comprobación por hecha.

## PR617-H01 — BLOCKER: tono erróneo en incidentes desestimados

**Lugar:** `src/features/admin/audit-format.ts:26,50-55`. **Severidad:** medio · correctness · `P06-enumeracion-incompleta`.

**Evidencia por inspección:** `ACTION_TONES` fija `admin_resolve_incident: 'positive'`. La RPC de CC-012 guarda `after.status='dismissed'` cuando `p_decision='no_action'` y `after.status='resolved'` en otros resultados. `toAuditLogItem` conserva el cambio de `status`, pero `auditActionTone` ignora esa diferencia para esta acción. Una desestimación muestra insignia de éxito.

**Arreglo exacto:** eliminar `admin_resolve_incident` del mapa de positivos incondicionales. En `auditActionTone`, leer `item.changes.find(c => c.field === 'status')?.after` para esa acción: `resolved` → `positive`; `dismissed` → `neutral`; ausente/desconocido → `neutral`. Mantener intacta la clasificación de aprobar/rechazar documentos.

**Test:** en `src/features/admin/audit-format.test.ts`, cubrir `resolved`, `dismissed` y status ausente. **Mutación RED:** al inicio de la función, forzar `admin_resolve_incident → positive` y demostrar que falla la expectativa de `dismissed`; restaurar y demostrar GREEN. No valen fallos de import, sintaxis o mocks falsos.

## PR617-H02 — BLOCKER: página vacía con cursor sin retorno

**Lugar:** `src/features/admin/queries.ts:811-820`, `src/features/admin/components/audit-log-table.tsx:294-305`. **Severidad:** medio · correctness/test-coverage · `P08-control-no-cubre-lo-que-dice`.

**Evidencia por inspección:** los indicadores de ambas direcciones exigen `visibleRows.length > 0`. Cuando una URL con cursor solicita una página sin filas, ambos quedan falsos. El `nav` del componente depende solo de esos indicadores. Resultado: no hay navegación de recuperación.

**Arreglo exacto:** en `src/features/admin/components/audit-log-table.tsx`, incluir un enlace **«Volver al inicio»** cuando `filters.cursor !== undefined && result.items.length === 0`, con `href={buildAuditHref(filters)}` (elimina `cursor` y `dir`, conserva `actor`, `action`, `entity`, `courier`, `target`, `from` y `to`). No alterar enlaces `Anterior`/`Siguiente` cuando hay filas. Reponer `firstPage: 'Volver al inicio'` en `src/features/admin/copy.ts`. No hacen falta cambios en consultas SQL ni en los tipos.

**Tests:** en `src/features/admin/components/audit-log-table.test.tsx`, crear resultado vacío con `cursor=90` y filtros `targetId`, `action`, `from`, `to` activos. Afirmar que el link existe, elimina `cursor/dir` y conserva filtros. Con resultado vacío sin cursor no debe aparecer. **Mutación RED:** sustituir temporalmente la guarda exacta del fallback por `false`, comprobar fallo de la expectativa del enlace, restaurar y GREEN.

## D01 resuelta — B (autorizada)

Se difiere la frase de inmutabilidad de A06 a T-408; actualmente SEC-02 permite operaciones de modificación de `audit_log` por admin. `t123-dod.test.ts` prohíbe prometer inmutabilidad antes de asegurarla en la base. La modificación del plan/ficha queda aceptada. La decisión no certifica la seguridad ni anticipa el cumplimiento de T-408.

## Estado de pruebas y CI

- El autor **declaró** `typecheck`, `lint`, `test` verdes (193 archivos, 3594 tests); esta revisión **no los ejecutó**.
- El autor **declaró** mutaciones M1/M2/M3 (4, 4 y 1 tests fallidos, restauración 109/109). No reproducidas por el revisor.
- Revisión realizada mediante lectura de GitHub, sin clon local preparado para comandos. **H01 y H02: por inspección estática, no RED demostrado en esta ronda.**
- CI oficial y `e2e-preview` se comprueban cuando no queden bloqueantes; no se afirma GREEN del SHA revisado. No se tocó Supabase remoto/local, Docker, secrets ni configuración.

## Cierre

El revisor publica documentación en esta rama, sin tocar código de aplicación; ese commit mueve el HEAD y puede disparar CI. Antes de corregir, el autor debe hacer **`git pull`**. No `rebase`, `amend`, `--force` ni edición de `docs/revision-pr/**`. La batería independiente propuesta y sus límites están en [evidencia/comandos.md](../evidencia/comandos.md).

