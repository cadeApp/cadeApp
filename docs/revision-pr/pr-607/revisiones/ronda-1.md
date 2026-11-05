# PR #607 — Revisión independiente, ronda 1

**Tarea:** T-404 · **Fecha local:** 2026-11-04 · **SHA revisado:** `e5ca27ad40400283993752ac93d833912753ce95` · **Base develop:** `7d07fdf80d94bce49580ec84cc39722b5bff4756`.

**Resultado: CON BLOQUEANTES (2)**. Ajuste de documentación adicional: H03 (decisión ya resuelta). PR Draft; **sin aprobación ni merge**.

**Checks independientes:** typecheck **no ejecutado** · lint **no ejecutado** · unit **no ejecutado** · test:db **n.a. (sin cambio SQL/server)** · E2E Preview **no ejecutado** · CI **no inspeccionado aún porque hay bloqueantes**. Motivo: clon por Git HTTPS inaccesible desde este entorno (DNS `github.com`); solo lectura y comparación vía conector GitHub. Las cifras 193/193, 3555/3555, 420/420 y mutaciones M1–M4 son **declaraciones del autor, no resultados verificados**.

## Lo que está bien por inspección

- `getApplicantDetail` usa `createClient()` de sesión, no service role, para `couriers`, `courier_documents`, `consents` y `audit_log`; propaga los errores. No añade CBU ni DNI al nuevo panel.
- El rechazo valida `z.enum(APPLICANT_REJECTION_OPTIONS)` + texto obligatorio para «Otro» también en `rejectCourierAction`; `decideCourierAction` conserva su guarda AAL2 y RPC. El texto compuesto respeta el límite de la RPC.
- Nuevos tests de UI y E2E abordan barra por estado, consentimiento, vista de documentos, suspensión/reconsideración y motivo compuesto en auditoría. **La existencia de tests no equivale a verificación de ejecución.**
- La comparación `develop...head` indica 16 archivos cambiados, todos dentro del listado original de «Archivos permitidos»; ningún contrato/RPC/migración fue modificado. Rama adelante 1 commit, detrás 0. En el momento de revisar no había hilos de review ni comentarios humanos.

## BLOQUEANTES

### PR607-H01 · Se pierden hitos reales al recortar 50 auditorías + hitos

**Archivo:** `src/features/admin/queries.ts:323-348`, especialmente `events.slice(-APPLICANT_HISTORY_LIMIT)`.

**Evidencia por inspección:** `getApplicantAuditRows` ya ejecuta `.limit(50)`. `buildApplicantHistory` agrega al comienzo «Registrado» y «Postulación enviada», ordena por fecha y **después** recorta a 50. Con 49 filas posteriores a los dos hitos, se pierde «Registrado»; con 50, se pierden ambos. La prueba existente solo usa 2 filas de auditoría y no detecta el extremo. No corresponde declarar una reproducción Vitest.

**Corrección D03=C autorizada:** 50 filas auditadas (las últimas por `created_at DESC,id DESC`) **más** los dos hitos reales cuando existan (máximo 52). Orden de presentación por fecha real ascendente; empate estable por identificador; nunca inventar `submitted_at` si es null. No recortar los hitos al sumar auditoría. Tests: 0, 1, 49, 50, 51 filas de input; solo se solicitan 50 auditadas, más 0–2 hitos; demostrar RED en el SHA original y GREEN tras corregir. Mutación independiente posterior: reintroducir `slice(-50)` **después** de añadir hitos debe volver rojo el nuevo test.

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice · **Estado:** abierto.

### PR607-H02 · «Ver todo» pierde eventos y no filtra al repartidor

**Archivo:** `src/features/admin/components/applicant-history.tsx:39` (enlace `buildAuditHref({ targetType: 'courier' })`); contrato actual: `schemas.ts:140-199`, `queries.ts:getAuditLog`, `components/audit-log-table.tsx:buildAuditHref`, `app/(admin)/admin/audit/page.tsx`.

**Evidencia por inspección:** el enlace genera `/admin/audit?entity=courier`. `getAuditLog` aplica `.eq('target_type','courier')`; por tanto **excluye todas las filas `courier_document`**, incluidas las que el historial sí muestra. Además no filtra `target_id` por el repartidor, así que muestra acciones de todos. El test `applicant-history.test.tsx` exige el enlace incorrecto: verificarlo no demuestra el DoD.

**Corrección D02=C autorizada:** añadir `?courier=<uuid>` validado por schema a `AdminAuditFilters`/`parseAdminAuditSearchParams` y propagado por `AuditPage`. En `getAuditLog`, filtrar por `(target_type=courier AND target_id=uuid) OR (target_type=courier_document AND (target_id IN ids reales del courier OR before.courier_id=uuid OR after.courier_id=uuid))`, manteniendo RLS de sesión y orden/keyset de auditoría (`id DESC`, cursor, `pageSize+1`). No hacer filtrado en memoria tras limitar: eso hace páginas vacías e incompletas. `buildAuditHref`, botón aplicar/reset y paginación preservan el UUID. Si se combina con `entity`, aplicar intersección explícita (no ignorar silenciosamente un filtro). Sin UUID válido, no construir SQL interpolado de usuario.

**Archivos extra autorizados para la ficha T-404:** `src/features/admin/components/audit-log-table.tsx`, `src/features/admin/components/audit-log-table.test.tsx` y, si hace falta (aquí hace falta para propagar searchParams), `src/app/(admin)/admin/audit/page.tsx`. Los test `queries.test.ts`, `schemas.test.ts`, `applicant-history.test.tsx` ya están permitidos.

**Pruebas RED exigidas:** eventos courier + dos documentos con target_id y before/after (incluido documento ya inexistente), otro courier excluido; `?courier` malformado no produce consulta amplia accidental; paginación 21+ entradas sobre la misma persona conserva cursor y UUID; la UI/link mantiene el filtro incluso tras «Aplicar», «Primera página» y «Siguiente». Mutar la rama OR del documento, eliminar `courier` en `buildAuditHref` y perderlo en el cursor deben dejar tests en rojo.

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice · **Estado:** abierto.

## Ajuste documental obligatorio

### PR607-H03 · DoD original y decisión no están reconciliados formalmente

**Archivo:** `docs/tasks/T-404.md:~108` (DoD E2E) y nota agregada en líneas finales; `docs/tasks/log/T-404.md`; descripción del PR.

**Hecho:** el DoD de develop dice «el repartidor ve el motivo compuesto»; el agente cambió una nota en la ficha sin cambiar el DoD, y el E2E revisa únicamente auditoría/historial del admin. Es un incumplimiento de alcance **hasta documentar la nueva decisión**.

**Decisión de Lautaro073 confirmada D01=C:** trasladar lectura del motivo por repartidor a CC y tarea propios, gestionados mediante `contract-change`. Seguimiento abierto y asignado: [#609](https://github.com/cadeApp/cadeApp/issues/609). **No modificar contratos en T-404.** Mantener literalmente el campo UI **«Mensaje para el postulante»** porque ese será el destino en el seguimiento. El E2E de T-404 mantiene la comprobación del motivo compuesto en auditoría del administrador.

**Antes de siguiente ronda:** en `docs/tasks/T-404.md` reemplazar solo el renglón DoD E2E para especificar la verificación admin y remisión a #609; actualizar notas originales sin atribuir una decisión no autorizada al agente; agregar nueva entrada en bitácora (sin borrar historial); actualizar cuerpo PR y enlazar #609. Incluir autorización de archivos D02. Esto se hace por el agente en su ronda de arreglos, no por la revisión.

**Severidad:** medio (proceso/alcance) · **Patrón:** P10-desvio-de-ficha-sin-consultar · **Estado:** abierto, decisión resuelta.

## Mejoras / comprobaciones pendientes

- El comentario de `getApplicantAuditRows` dice que «una de más indica historial recortado» pero hoy hace `.limit(50)`, sin fila 51 que permita saberlo; corregir comentario o devolver indicador real si se decide usarlo. No introducir una etiqueta de truncamiento falsa.
- Al implementar D02, no usar un OR global sin prefijo `target_type` ni cargar todos los documentos para luego filtrar páginas: los IDs de `courier_document` deben pertenecer al repartidor; consultas paginadas y fallos propagados.
- Verificar con CI oficial, Vitest y E2E Preview el SHA del arreglo antes de un veredicto final. No repetir la narrativa de «GREEN» sin líneas reales.

## Decisiones cerradas antes del informe

| Decisión | Respuesta | Implicación |
|---|---|---|
| D01 | **C** | CC+tarea separados, issue [#609](https://github.com/cadeApp/cadeApp/issues/609); T-404 conserva el campo de UI, modifica su DoD sin alterar RPC |
| D02 | **C** | Filtro por courier+documentos paginado y ampliación explícita de archivos permitidos |
| D03 | **C** | Hasta 50 registros auditados + dos hitos, orden cronológico, máximo 52 |

## Cierre de ronda

Se publica **un único comentario** con el informe corto y el prompt cerrado de corrección. La revisión comitea exclusivamente `docs/revision-pr/pr-607/`. El SHA verificado sigue siendo el que inspeccionó la revisión, **no** el commit de documentación, que volverá a mover el head. Autor: `git pull` antes de seguir; sin rebase, amend, force-push.
