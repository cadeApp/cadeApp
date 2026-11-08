# Evidencia y comandos reproducibles — PR #657 / ronda 1

## Alcance efectivamente inspeccionado

- Head: `f4878f8814f0002a758545d6e9617ae2da7299b7`.
- Base: `develop@4e700aa2d5f3edb362446675a736903fbb55dd35`.
- Comparación de GitHub: ahead 1, behind 0, solo `docs/contracts/CC-047.md` y `docs/tasks/T-408.md`.
- Confirmación de política y líneas vía lectura de archivos de migraciones y tests del SHA base.
- No existe clon git ni DB local en esta sesión. **Los comandos siguientes no se ejecutaron**, no hay tests RED/GREEN ni evidencia de CI atribuible a esta ronda. Los hallazgos H01-H04 son por inspección.

## Inspección git al tomar la siguiente ronda (solo lectura)

~~~bash
git fetch origin
git status --short
git rev-parse origin/develop
git rev-parse origin/cc/CC-047-admin-hardening
git diff --stat origin/develop...origin/cc/CC-047-admin-hardening
git diff origin/develop...origin/cc/CC-047-admin-hardening -- docs/contracts/CC-047.md docs/tasks/T-408.md
git diff origin/develop -- docs/tasks/T-408.md
git merge-tree --write-tree origin/develop origin/cc/CC-047-admin-hardening
git log -- docs/revision-pr/pr-657/
node docs/revision-pr/analizar.mjs verificacion
~~~

## Harness completo de revisión documental (copiable a /tmp)

El control siguiente no es pgTAP ni reemplaza la prueba SQL. Verifica que las cuatro correcciones contractuales figuren en el CC y que la ficha permita las suites históricas. **Sobre el SHA revisado de ronda 1 se espera salida NO CONFORME** (todavía no corregido); después de que el autor aplique los cambios, se espera CONFORME. No presentar este resultado como pruebas de seguridad RED→GREEN.

Guardá el contenido a `/tmp/pr657-contrato-check.cjs` y ejecutá `node /tmp/pr657-contrato-check.cjs "$PWD"`; no crea ni modifica archivos del repo.

~~~javascript
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = process.argv[2];
if (!root) { console.error('Uso: node /tmp/pr657-contrato-check.cjs RUTA_REPO'); process.exit(2); }
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const cc = read('docs/contracts/CC-047.md');
const t = read('docs/tasks/T-408.md');
const checks = [
  ['H01: trigger invoker y roles efectivos', /audit_log_reject_client_change[\s\S]{0,1200}security invoker/i.test(cc) &&
     /current_user[\s\S]{0,220}(anon|authenticated)/i.test(cc)],
  ['H02: RPCs auditadas CC-031 y FOR UPDATE', /admin_correct_courier_display_name/i.test(cc) &&
     /admin_revoke_courier_consent/i.test(cc) && /for update/i.test(cc) && /audit_log/i.test(cc)],
  ['H02: pgTAP CC-031 permitida', t.includes('cc031_courier_display_name_guard.sql')],
  ['H02: concurrencia CC-031 permitida', t.includes('integration/cc031_profile_concurrency.mjs')],
  ['H03: rpc_admin.sql permitida', t.includes('rpc_admin.sql')],
  ['H04: migración sin limpieza automática de merchants.notes',
     /no (update|delete|borra|toca)\s.{0,30}merchants\.notes/i.test(cc) ||
     /sin borrado autom[aá]tico/i.test(cc)],
  ['H04: consulta SELECT y orden total', /consulta[^\n]{0,100}select/i.test(cc) &&
     /audit_log\.id|order by[^\n]*id\s+desc/i.test(cc)],
  ['D3: autoservicio preservado con prueba de columnas', /autoservicio/i.test(cc) &&
     /privilegiadas|privilegios/i.test(cc)]
];
let failed = 0;
for (const [name, ok] of checks) { console.log((ok ? 'OK' : 'NO CONFORME') + ' — ' + name); if (!ok) failed++; }
console.log('Verificaciones documentales: ' + (checks.length - failed) + '/' + checks.length);
process.exitCode = failed ? 1 : 0;
~~~

## SQL de solo lectura para candidatos D2 — ejecutar MANUALMENTE por Lautaro073

Consulta orientativa (corregir nombres de columnas si la migración final los modifica). Ejecutar en consola SQL autorizada **en cada ambiente** y antes de promover. Produce solo identificadores y marcador de coincidencia; no muestra texto privado. El resultado no demuestra autoría y **no** autoriza UPDATE automático.

~~~sql
WITH ultimas AS (
  SELECT DISTINCT ON (a.target_id)
         a.target_id,
         a.id AS audit_id,
         a.created_at,
         a.after ->> 'notes' AS nota_admin
  FROM public.audit_log AS a
  WHERE a.action = 'admin_set_subscription'
    AND a.target_type = 'merchant'
    AND a.after ->> 'notes' IS NOT NULL
  ORDER BY a.target_id, a.id DESC
)
SELECT m.profile_id AS merchant_id,
       u.audit_id,
       u.created_at AS audit_created_at,
       'COINCIDE_REVISAR_AUTORIA'::text AS resultado
FROM public.merchants AS m
JOIN ultimas AS u ON u.target_id = m.profile_id::text
WHERE m.notes IS NOT NULL
  AND m.notes = u.nota_admin
ORDER BY m.profile_id;
~~~

Registros humanos a conservar por ambiente: nombre de ambiente, fecha, SHA de migración, cantidad de candidatos, cada ID y resolución (sin registrar contenido de la nota). Si hay candidatos sin resolver, **no promover**. La revisión no ejecutó esta consulta en ninguna base y no accedió a datos personales.

## Mutaciones SQL exigidas para T-408 (TODAVÍA NO EJECUTADAS)

- **H01:** con rol authenticated y una fila visible, reponer temporalmente GRANT y policy permisiva para demostrar que un UPDATE/DELETE/TRUNCATE sigue rechazado por el trigger. Mutar en memoria el control de invocador y demostrar que el caso da rojo; después restaurar. El test debe probar operación real, no solo `pg_proc.prosecdef`.
- **H02:** mutar temporalmente el control `aal2` y el `FOR UPDATE` de las nuevas RPC; los casos de autorización y carrera CC-031 deben fallar respectivamente. Restaurar y comprobar serialización y auditoría.
- **H03:** mutar SQL de `admin_set_subscription` para volver a escribir `merchants.notes`; la aserción de `rpc_admin.sql` debe dar rojo.
- **H04:** mutar el SQL de migración para que borre coincidencias; el test de preservación de nota debe dar rojo.
- **D3:** intentar UPDATE directo de columnas privilegiadas sobre la propia fila admin, con JWT `aal1` y `aal2`. Ninguna mutación debe alcanzar la columna auditada. Conservá los tests de autoservicio legítimo.

No usar Docker ni Supabase local; la prueba SQL queda para el job oficial de db-tests (leer Files/Tests/Result y drift db --local) de T-408. No abrir PR de mutación para E2E público; aplicar las reglas de T-347 si corresponde. No se inventan resultados de CI.

## Formato y límites

El documento `hallazgos.jsonl` contiene 4 entradas JSONL, ninguna marcada `arreglado-verificado`. Al disponer de clon, ejecutar `node docs/revision-pr/analizar.mjs verificacion` y el harness anterior. El control de CI no se considera verde por la edición de estos docs.
