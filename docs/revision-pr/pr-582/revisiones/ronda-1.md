# PR #582 — T-400 — Revisión independiente, ronda 1

**Fecha:** 2026-11-03 · **Revisor:** revisión independiente ChatGPT · **SHA revisado:** `9a25af62e93b65f04a384758327ce608d98d3e5c` · **Base:** `f4bd475bdec8378fa819fc75388fc505b808bd25`.

**Resultado: CON BLOQUEANTES (2).** Sin aprobación ni merge. **Checks independientes:** typecheck no ejecutado · lint no ejecutado · test no ejecutado · test:db n.a. (la PR no cambia Supabase ni src/server) · E2E Preview no verificado. La bitácora del **autor** declara 189 archivos y 3450 pruebas en verde; no se certifica como reproducción.

## Alcance y contrato

La ficha `docs/tasks/T-400.md`, leída de `develop`, coincide con la del head (mismo blob SHA `a00161de...`). Los 15 archivos modificados se ajustan a «Archivos permitidos». El head del remoto y el del PR coincidían en `9a25af62e93b65f04a384758327ce608d98d3e5c` al efectuar la revisión; `develop` estaba en `f4bd475b...`; GitHub informa `mergeable: true`, lo que no sustituye a `git merge-tree` local. No se detectaron modificaciones previas del autor en `docs/revision-pr/pr-582` (no existía la carpeta).

**Aspectos correctamente delimitados por inspección:** `AUDIT_REASON_ACTIONS` contiene solo las cuatro acciones autorizadas; `getAuditLog` usa `createClient()`, consulta `profiles`, `merchants`, `courier_documents` en lote por página y emite nombres/ids cortos; `AUDIT_CHANGE_FIELDS` sigue saneando campos; React renderiza el motivo como texto con `whitespace-pre-line`; no se tocaron migraciones ni contratos protegidos.

## BLOQUEANTES

### PR582-H01 — Se pierde parte del motivo escrito (medio, correctness)

- **Ubicación:** `src/features/admin/queries.ts:550-552,676`; prueba `src/features/admin/queries.test.ts:933-954`.
- **Contrato:** T-400 pide el motivo de `after.reason` «completo» y sin truncar. Las RPC `admin_decide_courier`, `admin_suspend_courier` y `admin_verify_document` guardan `p_reason` sin normalizarlo en `audit_log.after.reason` (migraciones `20260924013700_rpc_admin_v1.sql` y `20261016210000_cc025_courier_document_replacement.sql`); la RPC de rehabilitación sí normaliza su propio motivo al escribirlo.
- **Comportamiento:** `asText()` usa `value.trim()` tanto para nombres como para motivos. Por tanto `after.reason = '  Motivo\nDetalle  '` se convierte en `'Motivo\nDetalle'`. Se altera la evidencia auditada, aunque el DOM no tenga `truncate`.
- **Por qué el test no lo ve:** el caso «motivo completo» usa un texto sin espacios iniciales/finales; solo demuestra saltos internos y allowlist.
- **Arreglo específico:** usar dos funciones o ramas distintas: `asText` puede seguir recortando nombres; para motivo devolver la **cadena original** cuando `typeof value === 'string' && value.trim().length > 0`, sin aplicar `.trim()` al retorno. Mantener `null` en nulos, no cadenas y solo espacios. No modificar el allowlist.
- **Prueba RED→GREEN requerida:** agregar en `queries.test.ts` un registro `admin_suspend_courier` con `after.reason = '  Primera línea\nSegunda línea  \n'`, exigir igualdad estricta del `reason` devuelto con ese valor. **RED** sobre `9a25af62e93b65f04a384758327ce608d98d3e5c` por pérdida de espacios/salto final y **GREEN** tras el arreglo. También mantener el caso negativo de `admin_resolve_incident`.
- **Detección:** inspección del código y SQL. **No** se ejecutó Vitest en este entorno.

### PR582-H02 — El control de dominios dinámicos comprueba presencia, no exhaustividad (alto, test-coverage, P08)

- **Ubicación:** `src/features/admin/audit-catalog.test.ts:17-36,65-70,90-94,126-129`.
- **Contrato:** T-400 exige que el test falle si cualquiera de las acciones/entidades escribibles en las migraciones carece de etiqueta, incluyendo valores dinámicos `p_action` con dominio acotado y origen identificable.
- **Comportamiento:** `resolve('p_action', file)` siempre sustituye los **siete** literales de `DYNAMIC_VALUES.p_action.values`, sin usar `file` para seleccionar/verificar el dominio de cada migración. La prueba «dominio ... sigue en su archivo de origen» solo afirma `sql.toContain("'valor'")` para cada valor conocido: no compara con los nuevos valores del SQL ni exige que el conjunto sea exacto.
- **Sonda independiente:** sobre el SQL leído de `20261017090000_t369_publication_credits.sql`, se agregó **solo en memoria** `'new_unlabeled_action'` a la condición `p_action in ('publish_request','republish_request','report_no_show')`. Se comprobó que los siete `toContain` originales seguían verdaderos y que el `INSERT audit_log` seguía escribiendo `p_action`. Los valores que extraería `resolve` tampoco cambian. **Esto demuestra una ceguera del diseño del control**, no que hoy exista esa acción en producción ni que se haya ejecutado el Vitest mutado.
- **Clase enumerada:** hay escrituras `p_action` en nueve migraciones históricas (T-101/T-xxx, CC-007, CC-015, T-330, CC-019, T-339, T-340, limpieza legacy y T-369), no solo en el archivo nuevo. `report_incident` aparece en condiciones de la función, pero retorna antes del `INSERT audit_log`; esta exclusión debe seguir justificada por la rama real, no por un comentario suelto.
- **Arreglo específico:** refactorizar el helper **del test** para identificar las migraciones con un `INSERT audit_log` cuyo `action` sea `p_action`; por cada archivo, extraer o validar exhaustivamente los literales del dominio real de la función y comparar los conjuntos declarados/reales **en ambos sentidos**. Registrar `report_incident` como exclusión explícita y verificar en el SQL la salida anterior a la escritura. Rechazar expresiones dinámicas no declaradas y futuras variables desconocidas. Sin dependencias nuevas ni parser que simplemente acepte todo.
- **Prueba RED→GREEN requerida:** control actual verde; mutación temporal `p_action in (..., 'new_unlabeled_action')` en la migración **solo dentro de un worktree descartable**, guardando/restaurando su contenido desde memoria; el `audit-catalog.test.ts` corregido debe ponerse rojo **por acción sin etiqueta**, mientras el actual permanece verde ante esa mutación. También probar una migración histórica con `p_action`. Comparar aserciones, no solamente código de salida.
- **Detección:** inspección + sonda de texto en memoria. No se puede registrar `verificado-runtime`: ni el control original de Vitest ni el mutado se pudieron ejecutar aquí.

## MEJORAS NO BLOQUEANTES

Ninguna adicional fundamentada. No se abren hallazgos hipotéticos sobre RLS o fallos de red sin prueba.

## Decisiones 🔵

**Ninguna.** Tanto el texto exacto del motivo como la cobertura de valores dinámicos están definidos en la ficha de `develop`; no requieren ampliación de alcance. No se modifica la ficha.

## Evidencia, comprobación pendiente y procedimiento

Consultar [`../evidencia/comandos.md`](../evidencia/comandos.md). Faltan entorno local clonable, reproducción de los RED descritos en la bitácora y comprobación posterior de los controles nuevos. No se declara «CI verde» para este SHA. `e2e-preview` se evaluará al dejar la ronda sin bloqueantes, con el run del SHA exacto y el log oficial.

**Conclusión:** corregir H01 y H02 y abrir ronda 2. Mantener `docs/revision-pr/**` exclusivamente para la revisión independiente.
