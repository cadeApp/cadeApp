# Evidencia y comandos reproducibles — PR #735 · ronda 1

**Head inspeccionado:** `603fa9a0d6d9d930361b93282a88b6853bef6a5d`; base `develop@2cd76f24`. La PR modifica solo documentos. **No se ejecutó Supabase remoto, no se leyó ningún secreto, no se corrieron migraciones ni se creó una falsa captura.**

## Comprobación por lectura realizada (GitHub conectado)

- `docs/contracts/CC-051.md:47`: exige INSERT de courier.
- `supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:235-245,361`: inserta `draft` y luego ejecuta `request_cycle('publish_request')`; `supabase/migrations/20261009200000_t340_multi_drop.sql:910-922`: publica por UPDATE.
- `CC-051.md:59,66,70-76,85-90,111,143-151`: control positivo UPDATE, gate de cuatro controles, reacción a cualquier clave, negativo inmediato, rollback a todas las columnas y positivo que no sobrevive al filtrado.
- `docs/tasks/T-435.md:58-70`: repite la expectativa de courier INSERT y el criterio negativo inmediato.
- `e2e/fixtures/roles.ts:29-61`: arnés siembra un request, merchant, dos couriers y limpia por `finally`.

## Reproducción local del detector de contradicciones documentales

Copiar este **bloque completo** en una terminal en la raíz del clon, en el SHA de la revisión. Es un harness de inspección que **no toca archivos del repo ni llamadas a base**. El guard `--assert-clean` debe fallar con el contrato original y quedar verde tras corregir los documentos; no sustituye los E2E de la futura PR.

```bash
set -eu
cat >/tmp/pr735-doc-audit.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const cc = fs.readFileSync('docs/contracts/CC-051.md', 'utf8');
const task = fs.readFileSync('docs/tasks/T-435.md', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql', 'utf8');
assert(sql.includes("'draft', v_pickup_zone_id"));
assert(sql.includes("request_cycle('publish_request'"));
const bad = [
  ['H01', /\*\*INSERT:\*\*\s*el repartidor aprobado[\s\S]{0,130}recibe la solicitud que publica/i.test(cc) || task.includes('el repartidor aprobado suscripto a `INSERT` recibe')],
  ['H02', /5\.\s*\*\*Control positivo:\*\*[^\n]*UPDATE/.test(cc) && !/5\.\s*\*\*Control positivo:\*\*[^\n]*INSERT/.test(cc)],
  ['H03', /espera a que el control del caso autorizado sí reciba el suyo y después confirma que el\s*\n\s*canal no autorizado no recibió nada/.test(cc)],
  ['H04-gate', cc.includes('Si los cuatro controles pasan')],
  ['H04-negativos', cc.includes('controles 1 a 4 de §Propuesto, cada uno con su aserción sobre `Object.keys`')],
  ['H06-rollback', cc.includes('Rollback: volver a agregar la tabla sin lista de columnas')],
];
for (const [id, found] of bad) process.stdout.write(id + ': ' + (found ? 'RED (contradicción)' : 'sin literal contradictorio') + '\n');
const count = bad.filter(([, v]) => v).length;
console.log('contradicciones literales:', count);
if (process.argv.includes('--assert-clean')) assert.equal(count, 0, 'corregir primero los hallazgos; no debilitar el detector');
NODE
node /tmp/pr735-doc-audit.cjs
if node /tmp/pr735-doc-audit.cjs --assert-clean; then
  echo 'Control literal sin contradicciones (no sustituye la revisión humana)'
else
  echo 'RED esperado en el head original: el contrato requiere correcciones'
fi
```

**Salida de lectura reproducida por revisión conectada (regex equivalente sobre el SHA):** H01 RED; H02 RED; H03 RED; H04-gate RED; H04-negativos RED; H06-rollback RED. Se detectó además que la ficha repite H01/H03. No se dispone de clon local en este entorno para ejecutar exactamente el heredoc anterior; **no se afirma haberlo ejecutado**.

**Mutaciones independientes, en memoria y sin efecto en Develop:** reemplazar la expectativa literal de courier INSERT por merchant INSERT → se apaga H01; reemplazar el «inmediatamente después del positivo» por ventana/barrera independiente → se apaga H03; reemplazar «rollback a todas las columnas» por rollback fail-closed → se apaga H06. Las tres se verificaron en texto extraído del SHA con el conector GitHub. Son **detectores semánticos parciales de documentos, no pruebas RED→GREEN de RLS/Realtime.** El revisor debe leer el texto corregido en ronda 2; **prohibido editar el detector o inventar tests solo para pasar en verde**.

## Matriz de oráculos para la implementación posterior (no ejecutar en esta PR)

| Escenario | Evento exigido | Positivos | Negativos | Fuente de verdad |
|---|---|---|---|---|
| RPC real `create_and_publish_multi_drop` | `UPDATE` a published; inspeccionar INSERT si aparece | Courier, merchant y service_role reciben UPDATE de ese ID | Anon no recibe | RPC real + estado persisted |
| Borrador sintético post-SUBSCRIBED | `INSERT` a draft con ambas columnas no nulas | Merchant ve evento sin claves; service_role ve evento y ambas claves/marker | Courier no recibe | Admin SELECT con valores originales |
| Published con marker artificial | `UPDATE` de ese ID | Courier y merchant ven evento sin claves; service_role ve valor en modo publicación completa | Anon no recibe | Admin SELECT + correlación de evento |
| Fuga y allowlist CC-023 §5 | Evento público sí; claves privadas nunca | Service_role ve columnas públicas; admin SELECT demuestra dato fuente; pgTAP `attnames` | Ningún actor recibe claves privadas | SQL publicación + RLS + E2E |

En negativos: corroborar `SUBSCRIBED` y autorización vía PostgREST; esperar la barrera de evento positivo correlacionado y después una **ventana acotada** no basada en un `expect.poll` que se resuelva inmediatamente; afirmar 0 eventos del ID/tipo. En positivos: verificar `eventType`, ID, `updated_at`/marcador público inequívoco, claves y JSON sin valores privados donde se prohíben. Log solo `Object.keys(payload.new).sort()`, jamás el payload ni el marker. Al fallar una comparación de contenido, informar booleanos, no valores. Hacer `removeChannel` en `finally` y `trackEntityForCleanup` del nuevo draft, restaurando las dos columnas legacy a null.

## Comandos para la futura ronda (solo cuando no haya bloqueantes)

```bash
git fetch origin
git rev-parse HEAD
git diff origin/develop -- docs/tasks/T-435.md
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
pnpm exec vitest run tools
# En la PR de implementación, solo vía e2e-preview CI: capturas Realtime en Develop
```

No usar Supabase/Docker local, no invocar workflows manualmente, no emitir credenciales, no push a develop ni force.

