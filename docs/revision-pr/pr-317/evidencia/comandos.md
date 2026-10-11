# Evidencia reproducible — PR #317 / ronda 1

**SHA revisado:** `cf69ffd6a99d65418894c57868db86d8e28822fe`. **Limitación:** sin Docker/Supabase locales según instrucciones del proyecto. CI `db-tests` se alcanzó a ejecutar hasta la migración y falló; no llegó a ejecutar pgTAP.

## H01 — CI real en rojo, sin inferencias

Job: https://github.com/cadeApp/cadeApp/actions/runs/38090110065/job/114324632186  
`Applying migration 20261009200000_t340_multi_drop.sql...`  
`ERROR: column "is_active" does not exist (SQLSTATE 42703)`  
`At statement: 83` (backfill de `delivery_request_drops`)  
`Process completed with exit code 1`.

La tabla `public.zones` de `20260922031435_schema_v1.sql` tiene `active`, no `is_active`. La suite nueva no llegó a ejecutarse: no asignar estado verde.

## H02–H05 — harness completo de inspección (solo lectura, autocontenido)

Corré con el checkout del SHA observado o del nuevo HEAD. No escribe en el repo; usa copias en memoria. **Este harness detecta defectos estáticos, NO sustituye ejecución pgTAP ni acredita RED→GREEN SQL.**

```bash
node <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const migration = fs.readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql','utf8');
const test = fs.readFileSync('supabase/tests/t340_multi_drop.sql','utf8');
const lines = test.split(/\r?\n/);
const assertions = lines.filter(x => /^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|pass\(|lives_ok)/.test(x));
const dummy = assertions.filter(x => /^\s*select\s+pass\(/.test(x));
const plan = Number(test.match(/select plan\((\d+)\)/)?.[1]);
console.log({plan, assertions:assertions.length, dummy:dummy.length});
const checks = {
  'H01 columna inexistente en migración': /where is_active limit 1/.test(migration),
  'H02 consentimiento inventado': /coalesce\(c\.recipient_consent_declared,\s*true\)/.test(migration),
  'H02 datos personales inventados': /'Sin dirección'|'Sin nombre'|'\+543865000000'/.test(migration),
  'H03 tests pasivos': dummy.length > 0,
  'H04 plan incorrecto': plan !== assertions.length,
  'H04 zona inexistente en fixture': /insert into public\.zones\s*\(id, name, code, is_active, polygon\)/.test(test),
  'H04 request sin pickup zone': /insert into public\.delivery_requests\s*\(id, merchant_id, status\)/.test(test),
  'H05 get_trip_details redefinido en etapa 1': /create or replace function public\.get_trip_details\(/.test(migration)
};
for (const [name, broken] of Object.entries(checks)) console.log((broken ? 'BLOQUEANTE' : 'OK')+' | '+name);
assert.equal(plan,38);
assert.equal(assertions.length,39);
assert.equal(dummy.length,22);
assert(Object.values(checks).every(Boolean));
// Prueba del detector mismo: mutación EN MEMORIA para asegurar que alerta desaparezca cuando se corrige.
const cleanTest=test.replace(/^\s*select pass\([^\n]*\);?\s*$/gm,'').replace('select plan(38)','select plan(17)');
assert.equal(cleanTest.split(/\r?\n/).filter(x => /^\s*select\s+pass\(/.test(x)).length,0);
console.log('Detector: baseline observado y mutación negativa en memoria reproducibles.');
NODE
```

> El `plan(38)` original contabiliza 39 aserciones (17 no triviales + 22 `pass`). El test de `app_private.lock_draft_request_for_child_write` debe ejecutarse realmente como cliente `authenticated`, no como dueño del runner.

## Casos de integración necesarios para la siguiente ronda (no ejecutados por esta revisión)

- Verificar CI DB desde cero sobre **SHA nuevo**, inspeccionando `Files=`, `Tests=`, `Result:`, pasos `db --local` y `git diff --exit-code`.
- Migración: backfill repetido no crea duplicados, no inventa destinatario/consentimiento, datos legacy originales permanecen, esquema anterior sigue exponiendo las notas y cambio al lector viejo.
- Trigger: como authenticated dueño/no dueño, insert/update/delete en `draft` y `published`, update contactos, y serialización con publicación desde **sesiones concurrentes reales**.
- Pago: cash+cambio+monto positivo; cash+cambio+NULL; cash sin cambio+NULL; cash sin cambio+monto; transfer/to_agree+cambio; transfer/to_agree sin cambio+NULL; escrituras directas que eludan UI.
- Seguridad: antes de match no leer `drop_contacts`; después de match aceptado sí; actor ajeno nunca; columnas status/fecha/razón solo desde RPC; `drops_count` readable por `authenticated`.
- Antifraude de test: aplicar mutaciones nuevas **independientes del autor** en copia de trabajo descartable (por ejemplo quitar condición `needs_change`, eliminar check de rol, quitar guard de `draft`) y comprobar que la **misma suite** queda roja en lugar de sustituir la aserción. No hacer esto contra la base remota.

## Verificación posterior sugerida

```bash
git fetch origin
git status --short
git diff origin/develop...HEAD --stat
node docs/revision-pr/analizar.mjs verificacion
pnpm typecheck && pnpm lint && pnpm test
# pgTAP solo por job db-tests de CI; sin Docker/Supabase local
```

La rama estaba **detrás de develop por 2 commits** según la comparación de GitHub (merge-base `8ebd5e21`) al consultar la ronda; pedir integración no destructiva de `origin/develop` únicamente después de completar correcciones y sin rebase/force/amend.

## Ronda 2 — inspección independiente, SHA 5bba8319

**CI de base comprobado:** https://github.com/cadeApp/cadeApp/actions/runs/38098236439/job/114348546731. La migración T340 aplica sin error; bootstrap `Files=1, Tests=10, Result: PASS`; pgTAP `Files=21, Tests=1943, Result: PASS`, incluye `t340_multi_drop.sql ... ok`. La suite tiene 40 aserciones y no hay `select pass()`. `approval-policy` permanece rojo.

### H06 — detector de regresión SECURITY DEFINER

Este harness es independiente del autor. Corrélo desde la raíz del checkout del SHA revisado; trabaja solo en memoria, no modifica archivos:

```bash
node <<'NODE'
const fs=require('node:fs');
const m=fs.readFileSync('supabase/migrations/20261009200000_t340_multi_drop.sql','utf8');
const fn=m.match(/create or replace function app_private\.lock_draft_request_for_child_write\(\)[\s\S]*?\n\$\$;/)?.[0] || '';
function accepts(s){ return /security invoker/i.test(s) && /if current_user in \('authenticated', 'anon'\)/i.test(s) && /for update;/i.test(s); }
const mutated=fn.replace(/security definer/i,'security invoker');
console.log('BASE guard protegido:', accepts(fn));
console.log('CONTROL mutado en memoria:', accepts(mutated));
if(accepts(fn) || !accepts(mutated))process.exitCode=1;
NODE
```

**Salida de la revisión:** BASE `false` (RED); mutación que restituye `SECURITY INVOKER` `true` (GREEN). Es verificación estática, NO una carrera ejecutada. El hecho subyacente es semántica estándar de PostgreSQL: dentro de SECURITY DEFINER `current_user` es el dueño de la función, no el cliente authenticated.

### H07 — detectores de pruebas autofabricadas

```bash
node <<'NODE'
const fs=require('node:fs');
const s=fs.readFileSync('supabase/tests/t340_multi_drop.sql','utf8');
const names=['test_backfill_incomplete_draft','test_backfill_inconsistent_nondraft','test_backfill_repeated_no_duplicates'];
for (const name of names){
 const start=s.indexOf('create function pg_temp.'+name+'()');
 const end=s.indexOf('\n$$;',start);
 const body=s.slice(start,end);
 const manuallyInserts=/insert into public\.(delivery_requests|audit_log|delivery_request_drops)/.test(body);
 const callsBackfill=/app_private\.t340_backfill_legacy|pg_temp\.run_productive_backfill/.test(body);
 console.log(name, {manuallyInserts,callsBackfill});
}
const plan=Number(s.match(/select plan\((\d+)\)/)?.[1]);
const count=s.split(/\r?\n/).filter(x=>/^\s*select\s+(has_table|has_column|throws_matching|is\(|ok\(|has_function|lives_ok)/.test(x)).length;
console.log({plan,count,pass:(s.match(/select\s+pass\(/g)||[]).length});
NODE
```

**Observado:** tres casos siembran explícitamente resultados o datos y ninguno invoca el código de backfill; `plan=40`, `count=40`, `pass=0`. Esto comprueba estructura, no demuestra que una mutación productiva corrió contra Postgres. **Mutación RED pendiente para el autor:** deshabilitar el backfill en una copia aislada, correr su prueba real por CI y ver que falla específicamente la aserción.

### H08 — concurrencia ausente

El test inspeccionado tiene actores y consultas secuenciales (`supabase/tests/t340_multi_drop.sql:138-236`). No abre dos conexiones para ejecutar `publish_request` contra `insert/update/delete` de drops y `update` de contactos. **Prueba necesaria:** dos sesiones/locks, verificación de la versión efectivamente publicada; mutar a SECURITY DEFINER o quitar bloqueo y comprobar RED.

### H09 — casos lógicos que la auditoría no cubre

El filtro de `legacy_migration_inconsistent` solo verifica los campos obligatorios/consentimiento. El filtro del `insert` además requiere una combinación válida de medio de pago y `needs_change` con `cash_change_amount`. Para valores completos: `transfer + needs_change=true` y `cash + needs_change=true + cash_change_amount=NULL`, ninguno queda materializado y ninguno queda auditado. El CI existente carece de fixture que verifique ambos filtros en la misma ejecución de backfill.

### Alcance

Solo se usaron la lectura del SHA exacto, los resultados reales de CI y comprobaciones estructurales en memoria. No se levantó Supabase/Docker local, no se modificaron tests/implementación y no se simuló un run de concurrencia. Las mutaciones funcionales de DB quedan explícitamente **pendientes**.
