# Evidencia reproducible — PR #742 — Ronda 1

## Identidad, contraste y límites

- `develop`: `22dff3fa93df5c79b88d8021c1267389b2055666`; PR HEAD revisado: `a8166b5b0f037c561e8652142e90768cda698b37`.
- GitHub compare: ahead 1, behind 0, mergeable verdadero, solo tres archivos documentales.
- Bitácora `docs/tasks/log/T-437.md` ausente; sin review threads humanos ni carpeta de revisión previa.
- Se leyeron migraciones CC-050 (dos RPC vigentes), CC-043 (obligatorios), CC-042 (verificación y locks) y CC-025 (reemplazo), además de queries/types/fake/tests/seed indicados en informe.
- No se ejecutó `git merge-tree`, `pnpm` ni `test:db`; sin repositorio local en esta sesión. CI para `a8166b5b0f037c561e8652142e90768cda698b37`: workflow cancelado. No inventar resultados.

## Probes independientes sobre el contrato (6 baseline GREEN / 6 mutantes RED)

Se ejecutó el equivalente JavaScript **en memoria sobre el texto obtenido de GitHub de ese SHA**, sin modificar archivos. Cada control se limita a su sección; una versión inicial de probes con `includes` global dejaba pasar cambios fuera de esa sección y se descartó (AG-60). El control final exige un target exacto y detectó las seis mutaciones:

| Probe | Invariante documental | Mutación (en memoria) | Baseline | Mutado |
|---|---|---|---|---|
| DOC01 | Helper exige cuatro tipos | borrar `avatar` de la lista | GREEN | RED |
| DOC02 | Aprobación produce error específico | reemplazar mensaje por `INVALID_STATE_TRANSITION` | GREEN | RED |
| DOC03 | Rehabilitación incluye guarda | `la misma guarda` → `sin guarda` | GREEN | RED |
| DOC04 | Helper sin execute clientes | `revoke` → `grant execute` | GREEN | RED |
| DOC05 | UI especifica ambos botones | quitar Rehabilitar de la cláusula | GREEN | RED |
| DOC06 | DoD exige ausencia de efectos | `sin update ni audit` → `con update y audit` | GREEN | RED |

**Cuidado:** son pruebas de *texto contractual*, no demuestran el comportamiento SQL ni React, y no subsanan H01-H04.

### Harness completo, sin escritura de archivos

Guardá este script en `/tmp/pr742-documental.mjs` y ejecutalo sobre un **worktree limpio del SHA revisado** desde la raíz. El script lee el árbol y muta solo **strings en memoria**; falla si el objetivo no existe o si un control no detecta su propia mutación.

```bash
cat >/tmp/pr742-documental.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2] || process.cwd();
function read(path) {
  return readFileSync(join(root, path), 'utf8');
}
const CC = read('docs/contracts/CC-052.md');
const FICHA = read('docs/tasks/T-437.md');
const SQL042 = read('supabase/migrations/20261106120000_cc042_courier_vehicles.sql');
const QUERIES = read('src/features/admin/queries.ts');
const TYPES = read('src/features/admin/types.ts');

function between(source, first, next) {
  const a = source.indexOf(first);
  if (a < 0) throw new Error('Ancla no encontrada: ' + first);
  const b = next ? source.indexOf(next, a + first.length) : source.length;
  if (b < 0) throw new Error('Fin no encontrado: ' + next);
  return source.slice(a, b);
}
function probe(id, source, a, b, needle, replacement, predicate) {
  const sub = between(source, a, b);
  const targets = sub.split(needle).length - 1;
  if (targets !== 1) throw new Error(id + ': targets=' + targets + ' (sin objetivo es error)');
  if (!predicate(sub)) throw new Error(id + ': baseline RED');
  if (predicate(sub.replace(needle, replacement))) throw new Error(id + ': mutación CIEGA');
  process.stdout.write(id + ' baseline GREEN; mutante RED; targets=1\n');
}

probe('DOC01', CC, '1. **Helper interno**', '2. **`admin_decide_courier`**',
  "'dni_front', 'dni_back', 'selfie', 'avatar'",
  "'dni_front', 'dni_back', 'selfie'",
  (s) => s.includes("'dni_front', 'dni_back', 'selfie', 'avatar'"));
probe('DOC02', CC, '2. **`admin_decide_courier`**', '3. **`admin_reinstate_courier`**',
  "'DOCUMENTS_NOT_VERIFIED'", "'INVALID_STATE_TRANSITION'",
  (s) => s.includes("'DOCUMENTS_NOT_VERIFIED'"));
probe('DOC03', CC, '3. **`admin_reinstate_courier`**', '4. **Código',
  'la misma guarda', 'sin guarda', (s) => s.includes('la misma guarda'));
probe('DOC04', CC, '1. **Helper interno**', '2. **`admin_decide_courier`**',
  '`revoke all … from public, anon, authenticated`',
  '`grant execute … to authenticated`',
  (s) => s.includes('`revoke all … from public, anon, authenticated`'));
probe('DOC05', CC, '5. **UI del admin**', 'Ejemplo:',
  '«Aprobar» y «Rehabilitar»', '«Aprobar»',
  (s) => s.includes('«Aprobar» y «Rehabilitar»'));
probe('DOC06', FICHA, '## DoD', '## Regla de pruebas',
  'sin `update` ni `audit_log`', 'con `update` y `audit_log`',
  (s) => s.includes('sin `update` ni `audit_log`'));

const diagnostic = {
  writers_block_rejected_suspended:
    SQL042.includes("v_courier_rec.status::text in ('rejected', 'suspended')"),
  admin_detail_omits_purged_at:
    !between(QUERIES, ".from('courier_documents')", ".order('uploaded_at'")
      .includes('purged_at'),
  admin_type_omits_purged_at:
    !between(TYPES, 'export interface ApplicantDocumentDetail', 'export interface ApplicantDetail')
      .includes('purgedAt'),
  no_reinstate_ui_mutation: !CC.includes('t437-ui-reinstate-guard'),
  d4_contract_still_A: CC.includes('**D4-A'),
};
for (const [name, observed] of Object.entries(diagnostic)) {
  if (!observed) throw new Error('Diagnóstico inesperado, verificar manualmente: ' + name);
  process.stdout.write(name + ': OBSERVADO (inspección)\n');
}
NODE
node /tmp/pr742-documental.mjs "$(pwd)"
```

La batería debe arrojar seis líneas `baseline GREEN; mutante RED; targets=1`, seguidas de cinco diagnósticos `OBSERVADO` en el commit fijado. Los diagnósticos de H01/H02/H03/H04 no son tests de producción y no certifican que exista exploit.

**Ejecución observada contra GitHub en esta sesión:** 6/6 baseline GREEN, 6/6 mutaciones RED en memoria; la primera tentativa con comprobaciones globales fue deliberadamente descartada por ceguera de los controles. **No** se ejecutó el script de Node sobre un worktree completo: el runtime no dispone del clon y no hay acceso de red para descargarlo.

## Casos RED→GREEN exigidos a la PR de implementación T-437 (NO corridos en #742)

1. **pgTAP** `supabase/tests/cc052_courier_verified_documents.sql`: cada uno de los cuatro tipos en absent/submitted/rejected/purged/histórico, sin transición ni audit; control happy path y rechazo; quitar cada guarda de RPC produce RED en casos correspondientes. Si el duplicado vigente se prueba, aislar la restricción única y restaurarla; error del índice no acredita la guarda.
2. **Concurrencia** `supabase/tests/integration/cc052_concurrency.mjs`: dos conexiones reales, lock en curso comprobado con `pg_blocking_pids`, último documento verificado/rechazado ↔ aprobar en ambos órdenes y con auditoría correcta.
3. **UI** `e2e/mutations/manifest.json` con `t437-ui-approve-guard` y `t437-ui-reinstate-guard` independientes. Cada mutación debe dejar RED un `toBeDisabled` en flujo E2E real con admin MFA, no un mock o fallo de setup.
4. **Rehabilitación posterior a subsanación**: no poder saltar directamente a approved; RPC segura para nuevos obligatorios; admin verifica cuatro, luego recién reinstate; fallo antes sin auditoría ni actualización. Confirmar permisos de otro repartidor, índices y locks.
5. **Regresión de fixtures**: pgTAP `rpc_admin`, `cc034`, `cc043`, `cc050`; integración `cc034_concurrency`; E2E `courier-onboarding`, `admin-courier-reinstate`, `admin-audit-filters`. Cambiar únicamente semillas positivas a verificados; conservar todas las aserciones existentes.

## Comandos de control, reservados para el autor de implementación

```bash
pnpm db:types
pnpm typecheck && pnpm lint && pnpm test
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
# pgTAP en CI db-tests, NO Docker/Supabase local; E2E preview en staging de Develop
```

Verificar código del job `db-tests` contra el SHA final, `Files=` / `Tests=` / `Result:`, paso de comparación `db --local` + `git diff --exit-code`. En esta PR de docs no se exigen esos resultados de runtime.

# Ronda 2 — Evidencia y comandos

- **HEAD documental examinado:** `5c8095cb42441245e4d12c45456d496bb4c27b73`; develop `22dff3fa93df5c79b88d8021c1267389b2055666`.
- **Rango autoral:** `9967b141..5c8095cb`, solo CC, ficha, fila de plan y bitácora. PR body ya declara D4-C y D7-A como automáticas.
- **CI:** status completed, conclusion cancelled; no afirmar verde. `pnpm exec vitest run tools` 10/123 se menciona únicamente en bitácora del autor, sin ejecución independiente. No se ejecutó pgTAP/E2E ni Docker/Supabase.

## Mutaciones documentales independientes, sobre el texto remoto

| Control | Basal | Mutación en memoria | Mutante |
|---|---|---|---|
| H01: RPC subsanación + lock `couriers` | GREEN | `RPC nueva` → `RPC ausente` | RED |
| H02: `purgedAt` + allowlist query/types | GREEN | quitar `purgedAt` del tipo proyectado | RED |
| H03: dos patches approve/reinstate | GREEN | borrar patch reinstate | RED |
| H04: «sin aprobación personal» + D4-C | GREEN | sustituir «sin» por «con» | RED |
| H05: índice y helper separados | GREEN | cambiar `unique_violation` por insert exitoso **solo en cláusula de duplicados** | RED |
| H06: riesgo purga no demostrado | GREEN | cambiar «hipótesis» a «demostrado» | RED |
| M3: mensaje «aprobar o rehabilitar» | GREEN | borrar «o rehabilitar» | RED |

La primera prueba H05 con un `includes('unique_violation')` global **fue ciega** debido a una segunda ocurrencia; se descartó y se verificó el RED con el ámbito `**Duplicados vigentes (PR742-H05)** … **Purga del cron (PR742-H06)**`.

### Evidencias cruzadas (lectura e inspección; no SQL en ejecución)

- R01: `CC-052.md:105-107` remite al alta con DNI liberado; `20261104200000_cc043_courier_application.sql` bloquea `status NOT IN ('pending','approved')`; CC-050 reinstate requiere `dni_hmac IS NOT NULL`. La cuenta original `rejected/suspended` no puede reentrar al alta por ese RPC.
- R02: `applicant-detail-view.tsx:826-834` tiene `openDecisionModal('reactivate')` y `('reconsider')`; `src/features/admin/copy.ts:165-169`: «Reactivar repartidor» y «Reconsiderar aprobación». No existe botón literal «Rehabilitar».
- R03: `20260922051650_rls_v1.sql:134-148` define `is_courier()` solo como rol courier; `courier_docs_insert_own_folder` exige bucket/carpeta; consentimiento activo lo debe comprobar la RPC.

## Para reproducir en checkout exacto, sin mutar archivos

```bash
git fetch origin
git switch --detach 5c8095cb42441245e4d12c45456d496bb4c27b73
git diff --stat 9967b14166bc58e8261954622fc07361011bc80b 5c8095cb42441245e4d12c45456d496bb4c27b73
git diff --check 9967b14166bc58e8261954622fc07361011bc80b 5c8095cb42441245e4d12c45456d496bb4c27b73
node docs/revision-pr/analizar.mjs verificacion
# En implementación real solamente: pnpm db:types
# pnpm typecheck && pnpm lint && pnpm test
# pnpm exec vitest run tools
# pgTAP por CI db-tests (no Docker/Supabase local)
```

El harness de texto usado en la sesión con fuentes obtenidas del conector compara in-memory las siete invariantes, crea cada mutante reemplazando exactamente una cláusula dentro de su sección y exige `baseline=true` y `mutated=false`. No hubo clon local para correr el script en el árbol entero. Al arreglar R01–R03 es normal que los diagnósticos de regresión ya no coincidan; se debe volver a revisar en R3.

**Cautela pgTAP H05:** las pruebas existentes se envuelven en `BEGIN; … ROLLBACK;`. Si `DROP INDEX` y pruebas de integridad del mismo archivo comparten transacción, aislar la alteración con `SAVEPOINT … ROLLBACK TO SAVEPOINT` o colocarla como último caso antes del rollback externo; un rollback prematuro podría invalidar el resto de assertions.

# Ronda 3 — Evidencias, SHA b9bad8bc61b66486b9cf31d01e11013023241ce8

## Entradas y alcance

- Comparación remota `a7e927a278b1695bb540ff697329cce9839ce18c..b9bad8bc61b66486b9cf31d01e11013023241ce8`: **1 commit / 4 rutas**, contrato, ficha, fila de plan y bitácora. 0 archivos productivos y sin cambios autorales a `docs/revision-pr/**`; sin rebase.
- Protocolo y skill leídos. La rama y develop se contrastaron por SHA; #743 existe y está abierto.
- GitHub Actions por SHA no devolvió runs; el autor informa CI cancelada. El autor informa 123 tests `vitest run tools` y `git diff --check`, **no ejecutados por el revisor**. Sin pgTAP/E2E/DB/Docker ni `pnpm`.
- No se ejecutó `node docs/revision-pr/analizar.mjs verificacion` sobre todos los registros por falta de checkout. JSONL parseable; en memoria: **8 `arreglado-verificado`**, **1 `decision-pendiente`**, **0 `abierto/parcial`**; un resuelto es falso positivo R03.

## Probes de contenido

Nueve comprobaciones cruzadas de CC/ficha/plan y código vigente en develop: exclusión R01, UI sin tarjeta, tres patches en todas las fuentes sin el viejo reinstate, tres handlers reales, cada RED esperado en `toBeDisabled`, definición vigente de CC-007, chequeo independiente de consentimiento en RPC, savepoint, D8-B no ratificada. **9/9 GREEN**, tras corregir un matcher D8-B que inicialmente falló por el salto de línea Markdown.

| Mutación sobre texto remoto (in-memory, sin tocar repo) | Basal | Mutante |
|---|---|---|
| D7-A «no puede subsanar, volver al onboarding ni rehabilitarse» → «puede...» | GREEN | RED |
| Quitar patch `t437-ui-approve-guard.patch` de sección catálogo | GREEN | RED |
| Quitar patch `t437-ui-reactivate-guard.patch` de sección catálogo | GREEN | RED |
| Quitar patch `t437-ui-reconsider-guard.patch` de sección catálogo | GREEN | RED |
| Sustituir `rollback to savepoint` por rollback total | GREEN | RED |
| D8-B «no puede ratificarlas en nombre» → «ratifica en nombre» | GREEN | RED |

Los seis mutantes **no ejecutan SQL/TypeScript** ni demuestran el RED futuro de los E2E: comprueban que una alteración textual de los requisitos no pase desapercibida.

## Rectificación de R03, fuentes vigentes

1. `supabase/migrations/20260922051650_rls_v1.sql:134-148`: primera versión de `app_private.is_courier()` solo role courier.
2. `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:103-116`: **CREATE OR REPLACE** exige role courier **y** `consent_status='active'`.
3. Lectura de las **47 migraciones posteriores** disponibles en develop: ninguna redefine `is_courier()`. Por lo tanto, la policy Storage vigente usa el helper **con consentimiento activo**. La crítica R2-R03 fue un **falso positivo del revisor**; el CC actual especifica esta sucesión y exige además validación de consentimiento propia en `resubmit`.
4. `supabase/migrations/20261106120000_cc042_courier_vehicles.sql:1646`: `finalize_courier_application` no acepta cuentas rejected/suspended; CC-050 `admin_reinstate_courier` exige `dni_hmac`, confirmado contra D7-A.

## Reproducibilidad al disponer del checkout

```bash
git fetch origin
git diff --stat a7e927a278b1695bb540ff697329cce9839ce18c b9bad8bc61b66486b9cf31d01e11013023241ce8
git diff --check a7e927a278b1695bb540ff697329cce9839ce18c b9bad8bc61b66486b9cf31d01e11013023241ce8
node docs/revision-pr/analizar.mjs verificacion
# Solo en futura PR de implementación:
pnpm db:types
pnpm typecheck && pnpm lint && pnpm test
pnpm exec vitest run tools
# pgTAP con db-tests en CI; E2E-mutantes GREEN/RED reales
```

La revisión termina con cero bloqueantes técnicos del contrato documental y `PR742-H04` de ratificación personal pendiente. Sin aprobación ni merge.


# Ronda 4 — Evidencia sobre b00032ba98c950d34c6a8326dc58eee5b1094a07

- GitHub compare `b0b48c517ac3ffe07a008bb7a4d519ae1aa417b7..b00032ba98c950d34c6a8326dc58eee5b1094a07`: 2 commits adelante, **3 archivos**: CC, ficha y bitácora. Ningún cambio autoral en `docs/revision-pr/**`. HEAD de PR y base confirmados.
- Inspección ejecutada: **11 invariantes de documentos y metadata GREEN** y **8 mutaciones en memoria GREEN→RED**: ratificación CC, cuatro casillas, ficha 0 abiertas, conservación de la primera corrida fallida, declaración en cuerpo del PR.
- Cita «aprobadas las deciciones», opciones D1-A, D2-A, D3-A, D4-C, D5-A, D6-A y D7-A, fecha y autoría **declaradas** en CC, ficha, bitácora y PR body. Mensaje original de la otra sesión **no accesible**, por tanto no autenticado.
- Pruebas reportadas por autor: primera `pnpm exec vitest run tools` con 1 archivo fallido/109 pasados/14 omitidos **sin log**; dos siguientes exit 0, 10/123. `git diff --check` limpio, según bitácora. No repetido por revisor, sin causa del fallo conocida.
- CI informada cancelada por docs, API devolvió lista vacía de runs; no verde confirmado. Sin clone, pnpm, pgTAP, E2E, Supabase/Docker, merge-tree ni analizador completo.


### Harness de contenido documental para repetir en checkout de b00032ba

El siguiente script es repetible si se copia a `/tmp/pr742-r4.mjs` y se ejecuta **desde la raíz del checkout de SHA b00032ba98c950d34c6a8326dc58eee5b1094a07**. El control del cuerpo de la PR se hace **aparte** por API GitHub, pues no es un archivo local.

```js
import {readFileSync} from 'node:fs';
const cc = readFileSync('docs/contracts/CC-052.md','utf8');
const task = readFileSync('docs/tasks/T-437.md','utf8');
const log = readFileSync('docs/tasks/log/T-437.md','utf8');
const codes=['D1-A','D2-A','D3-A','D4-C','D5-A','D6-A','D7-A'];
function assert(ok,label){if(!ok)throw Error('RED baseline: '+label);console.log('GREEN: '+label);}
function mut(name,text,needle,to,check){
 if(text.split(needle).length!==2||!check(text)||check(text.replace(needle,to)))throw Error('Mutante ciego: '+name);
 console.log(name+': baseline GREEN, mutante RED');
}
assert(codes.every(c=>[cc,task,log].every(s=>s.includes(c))),'7 opciones en docs');
assert([cc,task,log].every(s=>s.includes('aprobadas las deciciones')),'cita textual');
assert([cc,task,log].every(s=>s.includes('D8-B')),'historia de seleccion automatica');
assert(task.includes('Decisiones abiertas: 0.'),'cero abiertas');
const app=cc.slice(cc.indexOf('## Aprobaciones')).split('\n').filter(s=>s.startsWith('- ['));
assert(app.length===4&&app.every(s=>s.startsWith('- [x]')),'4 casillas');
assert(log.includes('La primera dio 1 archivo fallido'),'primer test fallido no oculto');
mut('ratificacion',cc,'Lautaro073 las ratificó personalmente el 2026-11-13','pendiente',s=>s.includes('Lautaro073 las ratificó personalmente el 2026-11-13'));
for(const [id,needle] of [
 ['P1','- [x] P1 (dueño de esquema/RPC)'],
 ['P2','- [x] P2 (dueña de domain/ui)'],
 ['UI','- [x] Lautaro073 (comportamiento visible del admin)'],
 ['ficha','- [x] Ficha T-437 reconciliada']
])mut(id,cc,needle,needle.replace('- [x]','- [ ]'),s=>s.includes(needle));
mut('abiertas',task,'Decisiones abiertas: 0.','Decisiones abiertas: 7.',s=>s.includes('Decisiones abiertas: 0.'));
mut('primer-fallo',log,'La primera dio 1 archivo fallido','Las tres fueron verdes',s=>s.includes('La primera dio 1 archivo fallido'));
mut('cita-log',log,'«aprobadas las deciciones»','«seleccion del agente»',s=>s.includes('«aprobadas las deciciones»'));
```

Este harness solo valida **texto**, no autoría personal, SQL o tests de producto; no fue ejecutado en worktree local de esta sesión. Las comprobaciones equivalentes sí se ejecutaron in-memory con contenido remoto. Los ocho mutantes de la sesión fueron los mismos salvo que el último operó sobre **PR body** y no sobre el log.

