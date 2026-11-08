# Informe revisar-pr — CC-047 / T-408 — ronda 3 — 2026-11-07

**PR:** https://github.com/cadeApp/cadeApp/pull/657  
**SHA funcional/documental revisado:** `09df17bc0be7bbdf4ef97a12f7bf32f849537c7d`  
**Padre (revisión ronda 2):** `8e2043c287a5aeed61bf51a22f7f02c3e13b2a3f`  
**Base:** `develop@4e700aa2d5f3edb362446675a736903fbb55dd35`  
**Resultado:** **SIN BLOQUEANTES DOCUMENTALES**. La ejecución de migración, RLS, RPC y pgTAP será parte de T-408, no del CC.

## Qué se inspeccionó

- Información del PR: OPEN, no merged; SHA completo confirmado mediante GitHub; GitHub lo informa `mergeable=true` (no se pudo ejecutar `git merge-tree`).
- Comparación de SHA anterior `8e2043c...` con `09df17b...`: **1 commit**, exactamente `docs/contracts/CC-047.md` (+9/-5) y `docs/tasks/T-408.md` (+27/-11). El autor **no** tocó `docs/revision-pr/pr-657/**`.
- Comparación frente a `develop`: los archivos de producto de la PR siguen siendo solo los dos documentos, además de esta carpeta de revisión. Se contrastó la ficha original de `develop` y las cláusulas nuevas con el CC.
- Rutas exactas, impacto, DoD, permisos de autoservicio, roles `aal1/aal2` y concurrencia CC-031. No se encontró una regresión adicional en el diff de ronda 3.

## Resolución verificada — R01

**Archivos:** `docs/tasks/T-408.md:52-81`, `docs/contracts/CC-047.md:46,250`; parser de producción `tools/verify-fichas.test.ts:44-47`.

| Control independiente | Resultado |
|---|---|
| Conteo de las 10 suites y migración que fallaban en `ec341a04` | **11 sin permitir** |
| Comprobación de las mismas 11 rutas contra el `T-408.md` nuevo | **11/11 permitidas** |
| Mutación independiente `rpc_distance.sql` → `{rpc_distance}.sql` | **1 rechazada** |
| Nombre exacto de migración en CC y ficha | **Coincide**: `20261108020000_cc047_admin_hardening.sql` |
| Colisión de nombre frente a 51 migraciones de `develop` | **No existe**; última `20261106120000_cc042_courier_vehicles.sql` |
| Patrones con `{...}` o `<timestamp>` en las rutas permitidas | **Ninguno** |

**Método [verificado, documento]:** se tomó el contenido exacto del SHA remoto mediante GitHub y se reprodujo en JavaScript el comparador literal/o-prefijo que usa `permite()`. La mutación se ejecutó **en memoria**, sin cambiar el repositorio. No se confunde este resultado con pgTAP o la ejecución de la futura migración.

## Resolución verificada — H05

**Archivos:** `docs/tasks/T-408.md:35-46,95`, `docs/contracts/CC-047.md:162-169`.

- Checklist y DoD: **eliminar policies de escritura administrativa privilegiada**, **conservar grants compartidos** que requiere el autoservicio, excepción explícita de grants de `audit_log` y su secuencia.
- Contrato: privilegios de admin no se extienden a columnas protegidas; `profiles_update_self`, `merchants_update_self`, `push_subscriptions_all_self` continúan sujetos a sus guardas. Se elimina la afirmación errónea de que no existe ninguna policy de escritura para admin.
- Checklist de concurrencia: ambos nombres RPC, `FOR UPDATE`, CC-031 B/C, auditoría atómica; `accept_offer` permanece.
- D2: **sin backfill**, `merchants.notes` intacta; consulta manual de candidatos por ambiente antes de promover.

**Control [verificado, documento]:** seis aserciones estructurales de texto contra el SHA remoto, y cinco mutaciones independientes que reintroducen desvíos (quitar grants compartidos del checklist, quitarlos del DoD, omitir auditoría de concurrencia, volver a backfill, negar el guard por columna). **Todas hacen fallar su aserción y se restauran en memoria.** Un primer mutante que conservaba la palabra «auditoría» no fallaba; se corrigió **el mutante**, no el contrato. El script completo y su prueba de sintaxis están en `evidencia/comandos.md`.

## Ronda 1 — hallazgos históricos H01–H04

- **H01** sigue corregido por especificación: `SECURITY INVOKER` con test de GRANT+policy, FK `ON DELETE SET NULL` y mantenimiento con `service_role`.
- **H02** sigue corregido por especificación: dos RPC `aal2` auditadas, `FOR UPDATE`, suites CC-031 e integración B/C.
- **H03** sigue corregido por especificación: `rpc_admin.sql` incluida y cambio de expectativa de nota acotado.
- **H04** sigue corregido por especificación: sin UPDATE de limpieza; SELECT de candidatos ordenado por `audit_log.id DESC`, resolución manual D2.
- Se mantienen como `arreglado-sin-verificar` para **no atribuir el SQL, triggers ni pgTAP aún inexistentes a este CC documental**. Su implementación y evidencia RED/GREEN se verifican dentro de T-408.

## CI y checks — SHA correcto y alcance real

**CI del SHA `09df17bc0be7bbdf4ef97a12f7bf32f849537c7d` (run #42436346316):** se inspeccionaron estados de jobs y el **log completo de `unit`**, no solo el color. A la última consulta de esta revisión:

| Job | Estado comprobado |
|---|---|
| `typecheck`, `lint`, `build`, `audit`, `bundle-budget` | **success** para el SHA revisado |
| `unit` | **success**: `199 passed` archivos, `3755 passed` tests; `tools/verify-fichas.test.ts` 7 tests |
| `db-tests` | **in_progress**, sin resultado final al momento de consultar |
| E2E / SQL mutado de SEC-01–11 | **NO EJECUTADOS por esta revisión documental** |

- Lautaro073 informó `git diff --check` limpio y `pnpm exec vitest run tools/verify-fichas.test.ts` 7/7; la primera salida no fue reproducida en un clon local; la segunda quedó **corroborada por el log del job `unit`** de este SHA.
- Se pasó `node --check` al harness independiente de ronda 3; se ejecutó su lógica contra contenido remoto en el evaluador JS y se mutó en memoria. No se ejecutó `node docs/revision-pr/analizar.mjs verificacion` ni `git merge-tree` en el clon porque no existe un checkout Git local accesible. Se validó el JSONL por parseo.
- **No exigir nuevo CI GREEN solo por el commit de esta carpeta de revisión**. Los checks de código y DB de T-408 corresponden a su futura PR.

## Mejora pequeña resuelta directamente

La **descripción de la PR** seguía afirmando «admin solo con policies SELECT» y «backfill verificable», frases incompatibles con D3=B y D2=B. Se actualizó la descripción a preservar grants y autoservicio, no backfill, dos RPC auditadas y listado de suites. No se cambiaron archivos de producto ni se movió el SHA. No queda acción para el autor por este punto.

## NO TOCAR y límites

- Ninguna migración o suite SQL se creó como parte de CC-047; **la ejecución del código de seguridad se verifica más adelante en T-408**. No utilizar resultados del harness documental como pruebas de RLS.
- No cambiar D1=A, D2=B, D3=B ni habilitar `profiles_update_admin`.
- No mover `cc035_register_push_subscription.sql` a tests obligatorios de cambio: autoservicio de admin se mantiene por contrato.
- No aprobar ni mergear esta PR desde la revisión. No abrir ronda 4 solo porque el commit de revisión cambie el head.

## Tareas humanas pendientes

1. **Ninguna corrección documental pendiente** para CC-047.
2. **Solo cuando se implemente y vaya a promoverse T-408:** Lautaro073 debe ejecutar la consulta de solo lectura de candidatos `merchants.notes` en **cada ambiente**, resolverlos y documentar resultado (D2). Si hay candidatos pendientes, no promover.
3. La CI `db-tests` estaba en curso durante la consulta: su estado debe ser revisado antes de cualquier decisión operacional sobre la PR. Un eventual fallo es un hecho nuevo, no un resultado de esta revisión.

**Cierre de ronda 3: SIN BLOQUEANTES DOCUMENTALES; NO APROBADO NI MERGEADO.**
