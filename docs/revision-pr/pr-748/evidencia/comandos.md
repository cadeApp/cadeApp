# Evidencia y comandos reproducibles — PR #748, ronda 1

**HEAD revisado:** `93b34c056d039e0ec66785fb5d82221e5f566898`. **Base:** `4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a`.

## Alcance real de esta evidencia

La revisión leyó los archivos desde el conector GitHub en sus SHAs, comparó el PR (4 rutas) y consultó el resultado de CI (cancelled). No hubo acceso a un clon de Git utilizable para ejecutar los comandos de abajo, ni a PostgreSQL local, ni se hicieron mutaciones runtime. **Los bloques son reproducibles para quien tenga el clon; no se presentan como comandos ya ejecutados.** No se proporcionan números GREEN/RED inventados. Los tests de integración se exigen a la futura implementación y entonces serán verificados independientemente.

## 1. Estado, contenido y conflicto (desde clon limpio)

```bash
git fetch origin
git rev-parse origin/develop
git rev-parse origin/cc/CC-053-suspension-active-trips
git diff --stat 4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a..93b34c056d039e0ec66785fb5d82221e5f566898
git diff --name-only 4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a..93b34c056d039e0ec66785fb5d82221e5f566898
git diff 4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a..93b34c056d039e0ec66785fb5d82221e5f566898 -- docs/tasks/T-438.md
git merge-tree --write-tree origin/develop 93b34c056d039e0ec66785fb5d82221e5f566898
git log --oneline -- docs/revision-pr/pr-748/
```

Al inspeccionar remotamente: HEAD=`93b34c05`, base=`4c85b8da`, ahead=1, behind=0, mergeable=true; cambio de 4 archivos, +367/-1. La ficha es nueva (ausente en base). El último comando no arrojará commits de revisión anteriores al commit de esta ronda. **No se ejecutó** `git merge-tree` en este entorno.

## 2. Contraste literal «Actual» vs SQL vigente en develop

```bash
BASE=4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a
git show "$BASE:supabase/migrations/20260924013700_rpc_admin_v1.sql" | nl -ba | sed -n '104,175p'
git show "$BASE:supabase/migrations/20260927120000_cc012_incidents_contract.sql" | nl -ba | sed -n '166,278p'
git show "$BASE:supabase/migrations/20261017090000_t369_publication_credits.sql" | nl -ba | sed -n '793,910p;1215,1275p'
git show "$BASE:supabase/migrations/20261009200000_t340_multi_drop.sql" | nl -ba | sed -n '949,1185p;1250,1310p;1350,1440p'
git show "$BASE:supabase/migrations/20261108020000_cc047_admin_hardening.sql" | nl -ba | sed -n '102,190p'
git show "$BASE:supabase/migrations/20261019060000_cc032_request_cancellation_history_rpc.sql" | nl -ba | sed -n '1,155p'
git show "$BASE:docs/contracts/CC-032.md" | nl -ba | sed -n '60,70p;300,310p'
git show "$BASE:docs/master-plan.md" | nl -ba | sed -n '133,139p'
```

Resultado por inspección de las fuentes remotas:
- `admin_suspend_courier` → courier FOR UPDATE, UPDATE courier, UPDATE offers pending. Sin matched/in_transit.
- `admin_resolve_incident` → incident FOR UPDATE, accepted offer FOR UPDATE, courier FOR UPDATE; la decisión válida es `preventive_suspension`, **no** `suspend_courier`.
- `request_cycle` courier → request FOR UPDATE, accepted offer FOR UPDATE, courier FOR SHARE; suspended bloquea las acciones.
- `mark_drop_delivered` y `mark_drop_failed` → courier sin lock, request FOR UPDATE, drop FOR UPDATE.
- `submit_offer` y `take_request` → courier sin lock, request FOR UPDATE, courier FOR SHARE.
- `accept_offer` versión CC-047 → request FOR UPDATE, offer FOR UPDATE, courier FOR SHARE.
- `get_request_cancellation_history` → solo `courier_cancel_match`; paginación limit+1 después de filtros de rol/actor.
- `CC-032` 1-A ratificada excluye otros tipos hasta la enmienda autorizada para CC-053.

## 3. Barrido de las ocho RPC y la novena de historial

| Unidad | Orden bloqueante actual | Orden deseado |
|---|---|---|
| `admin_suspend_courier` | courier → offers UPDATE | courier → requests (id asc) → drops, si corresponde → offers |
| `admin_resolve_incident` | incident → accepted offer → courier → offers | incident → courier → requests → drops → offers |
| `accept_offer` | request → offer → courier | courier → request → offer |
| `submit_offer` | courier sin lock → request → courier | courier FOR SHARE → request → offer |
| `take_request` | courier sin lock → request → courier | courier FOR SHARE → request → offer |
| `app_private.request_cycle` (courier) | request → accepted offer → courier | courier FOR SHARE → request → offer |
| `mark_drop_delivered` | courier sin lock → request → drop | courier FOR SHARE → request → drop → oferta (si se bloquea) |
| `mark_drop_failed` | courier sin lock → request → drop | courier FOR SHARE → request → drop → oferta (si se bloquea) |
| `get_request_cancellation_history` | lectura STABLE, sin row locks | conservar lectura STABLE; novena redefinición **funcional**, no del lock |

«Requests ordenadas por id» y «offers de forma consistente» necesitan prueba si la suspensión toca varias solicitudes. La demostración real de ausencia de 40P01 frente a los cinco escenarios del CC es tarea de `cc053_concurrency.mjs` en la PR de implementación. No ejecutar Docker/Supabase local por las reglas del proyecto.

## 4. Diagnóstico de archivos/contrato y salidas

```bash
HEAD=93b34c056d039e0ec66785fb5d82221e5f566898
git show "$HEAD:docs/contracts/CC-053.md" | nl -ba | sed -n '1,225p'
git show "$HEAD:docs/tasks/T-438.md" | nl -ba | sed -n '20,136p'
git show "$HEAD:docs/implementation-plan.md" | grep -n 'T-438'
git show "$BASE:src/features/trips/components/cancellation-history-card.tsx" | nl -ba | sed -n '20,73p'
git show "$BASE:src/features/trips/components/cancellation-history-list.tsx" | nl -ba | sed -n '1,90p'
git show "$BASE:src/features/trips/cancellation-history-copy.ts" | nl -ba | sed -n '1,45p'
git show "$BASE:src/features/trips/cancellation-history.test.tsx" | nl -ba | sed -n '1,105p'
git show "$BASE:src/domain/rpc-contracts.ts" | nl -ba | sed -n '560,630p'
git show "$BASE:src/server/rpc/offers.ts" | nl -ba | sed -n '52,99p'
git show "$BASE:src/server/rpc/admin.ts" | nl -ba | sed -n '62,89p'
```

Reconciliar **cada** ruta del CC `Impacto exacto` contra la lista cerrada de `Archivos permitidos` y la fila T-438 del plan; aparte, cada obligación de pruebas contra el `DoD`. Las rutas que faltan están individualizadas en H04. Cuando se cierre D3-C, probar el render de `categoryLabel:null` y `actor:null`: el componente de lista actual **renderiza ambos** y su fallback genérico, por lo que la tarjeta por sí sola no resuelve el caso.

## 5. Script independiente de auditoría de anclas (solo lectura)

Este script se copia a `/tmp` y corre desde la raíz de un clon con `git`, sin paquetes, base de datos ni archivos mutados. Inspecciona **SQL original**, no valida por tautología el nuevo CC. `--mutate` altera una ancla **en memoria** para comprobar que la propia sonda detecta la pérdida; no equivale a RED funcional de pgTAP.

```bash
cat > /tmp/pr748-static-audit.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
const BASE = '4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a';
const mutate = process.argv.includes('--mutate');
const get = (path) => execFileSync('git', ['show', BASE + ':' + path], { encoding: 'utf8' });
const sources = [
  {
    file: 'supabase/migrations/20260924013700_rpc_admin_v1.sql',
    checks: ['create or replace function public.admin_suspend_courier(', 'for update;', "status = 'withdrawn'"],
  },
  {
    file: 'supabase/migrations/20260927120000_cc012_incidents_contract.sql',
    checks: ["p_decision = 'preventive_suspension'", 'from public.incidents', 'from public.couriers'],
  },
  {
    file: 'supabase/migrations/20261108020000_cc047_admin_hardening.sql',
    checks: ['create or replace function public.accept_offer(', 'from public.delivery_requests where id = v_req_id for update;', 'from public.offers where id = p_offer_id for update;', 'where profile_id = v_offer.courier_id for share;'],
  },
  {
    file: 'supabase/migrations/20261019060000_cc032_request_cancellation_history_rpc.sql',
    checks: ["rcr.action = 'courier_cancel_match'", 'limit v_limit + 1'],
  },
  {
    file: 'src/features/trips/components/cancellation-history-list.tsx',
    checks: ['event.categoryLabel', 'event.actor?.displayName'],
  },
  {
    file: 'src/server/rpc/offers.ts',
    checks: ["return 'INTERNAL_ERROR';"],
  },
];
let checks = 0;
let failures = 0;
for (let i = 0; i < sources.length; i++) {
  const item = sources[i];
  let content = get(item.file);
  if (mutate && i === 1) {
    content = content.replace("p_decision = 'preventive_suspension'", "p_decision = 'suspend_courier'");
  }
  for (const needle of item.checks) {
    checks++;
    if (!content.includes(needle)) {
      failures++;
      process.stdout.write('FAIL ' + item.file + ' :: ' + needle + '\n');
    }
  }
}
process.stdout.write('anchors=' + checks + ', failures=' + failures + ', mutate=' + mutate + '\n');
process.exitCode = failures ? 1 : 0;
NODE
node /tmp/pr748-static-audit.mjs             # objetivo: anclas presentes, exit 0
node /tmp/pr748-static-audit.mjs --mutate    # objetivo: al menos 1 falla, exit 1
```

**Nota de reproducibilidad:** el script es la especificación completa del arnés de inspección; no se afirma que fue ejecutado en este entorno. Si alguna ancla no coincide por variación textual, se ajusta contrastando el SQL real y se registra la corrección, no se desactiva para obtener verde. Las mutaciones requeridas de `T-438` son otras: SQL real + pgTAP y transacciones reales + harness de concurrencia, bajo CI.

## 6. Verificación final después del arreglo documental

```bash
git fetch origin
git diff origin/develop...origin/cc/CC-053-suspension-active-trips --stat
rg -n "D3-C|assignment_unavailable|preventive_suspension" docs/contracts/CC-053.md docs/contracts/CC-032.md docs/tasks/T-438.md docs/master-plan.md
rg -n "cancellation-history-list.tsx|cancellation-history-copy.ts|cancellation-history.test.tsx|cc032_request_cancellation_history.sql" docs/contracts/CC-053.md docs/tasks/T-438.md docs/implementation-plan.md
node docs/revision-pr/analizar.mjs verificacion
git merge-tree --write-tree origin/develop HEAD
git status --short
```

La revisión futura ejecutará los checks en SHA nuevo y comparará el comportamiento/documentación con este registro. El CI cancelado del commit documental no puede convertirse en prueba.


---

## Ronda 2 — control independiente del contrato

**Autor SHA:** `4129bf6f6ec56bf1f1eb7f57702d3b6c39c8a0f7`  
**Base:** `4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a`  
**Fuente:** archivos de contrato/ficha/plan/bitácora obtenidos del conector GitHub; SQL fuente de `develop` inspeccionado por comparación.

### Alcance y resultados reales

- `GitHub compare(7503f0a7,4129bf6f)`: `ahead_by=1`, `behind_by=0`; seis rutas modificadas: CC-032, CC-053, ficha, plan, `6.3 y bitácora; ninguna en el directorio de revisión.
- La PR está abierta y Draft, `mergeable=true`, base sin cambios; `CI 43687525249`: `completed/cancelled`.
- Controles JS independientes evaluados sobre texto real de GitHub: **H01–H09: 9/9 afirmaciones estáticas presentes**. Nueve mutaciones controladas de las afirmaciones, **en memoria**, produjeron nueve fallos del control específico; las originales no fallaron. **Esto prueba sensibilidad de los controles de texto, NO comportamiento SQL/UI**.
- El usuario declara `git diff --check` sin salida y `git merge-tree` sin conflictos; **revisor no los ejecutó**. No se ejecutó PostgreSQL, Supabase, Docker, pnpm, pgTAP ni E2E.
- Se detectó y corrigió **un error del registro de ronda 1**: los nueve JSONL no tenían `linea` por un fallo de serialización del script inicial. En esta ronda se restituyeron las líneas sin cambiar `ronda-1.md`.

### Script completo (copiar a /tmp desde raíz de un clon limpio)

```bash
cat > /tmp/pr748-round2-static-audit.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const SHA = '4129bf6f6ec56bf1f1eb7f57702d3b6c39c8a0f7';
const BASE = '4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a';
const files = {
  C: 'docs/contracts/CC-053.md',
  D: 'docs/contracts/CC-032.md',
  T: 'docs/tasks/T-438.md',
  P: 'docs/implementation-plan.md',
  M: 'docs/master-plan.md',
};
const get = (rev, path) => execFileSync('git', ['show', rev + ':' + path], { encoding: 'utf8' });
const original = Object.fromEntries(Object.entries(files).map(([k, p]) => [k, get(SHA, p)]));
const sql = get(BASE, 'supabase/migrations/20261019060000_cc032_request_cancellation_history_rpc.sql');
const offers = get(BASE, 'src/server/rpc/offers.ts');

const check = {
  H01: d => d.C.includes('admin_resolve_incident(preventive_suspension)') &&
    !d.C.includes('admin_resolve_incident(suspend_courier)'),
  H02: d => d.C.includes('Conjunto visible, calculado **antes** de paginar:') &&
    d.C.includes('El repartidor **nunca** lo ve') &&
    d.C.includes('`hasMore` y `nextCursor` salen del conjunto visible') &&
    sql.includes("and rcr.action = 'courier_cancel_match'") &&
    d.T.includes('páginas mixtas'),
  H03: d => d.C.includes("`action: 'assignment_unavailable'`") &&
    d.C.includes('`actor: null`') && d.C.includes('`offerId: null`') &&
    d.C.includes('`rawReason: null`'),
  H04: d => ['cancellation-history-list', 'cancellation-history-copy',
    'cancellation-history.test.tsx', 'cc032_request_cancellation_history.sql', 'CC-032']
    .every(s => d.C.includes(s) && d.T.includes(s) && d.P.includes(s)),
  H05: d => d.C.includes('8 funciones con cambio de orden de locks') &&
    d.C.includes('9 redefiniciones funcionales') &&
    d.T.includes('las 9 funciones'),
  H06: d => d.C.includes('p_include_assignment_unavailable boolean default false') &&
    d.C.includes('`drop` de la firma de 4 argumentos') &&
    d.C.includes('`PGRST202`') &&
    d.C.includes('repite **una vez**') &&
    d.C.includes('viejo | nuevo') && d.C.includes('nuevo | viejo') &&
    d.C.includes('nuevo | nuevo'),
  H07: d => d.D.includes('**Adenda (CC-053, autorizada por Lautaro073 el 2026-11-15):**') &&
    d.D.includes('única excepción a 1-A') &&
    d.D.includes('2-A, 3-A y 4-A no cambian'),
  H08: d => d.C.includes('los wrappers de `src/server/rpc/` no reconocen ese SQLSTATE y lo devuelven como `INTERNAL_ERROR`') &&
    offers.includes('INTERNAL_ERROR'),
  H09: d => d.C.includes("`app_private.unconsume_publication(request_id, p_actor_id, 'courier_suspended')`") &&
    d.C.includes('`cancel_reason` en `null`') &&
    d.C.includes('`decided_at = v_now`'),
};
const mutant = {
  H01: ['C', 'admin_resolve_incident(preventive_suspension)', 'admin_resolve_incident(suspend_courier)'],
  H02: ['C', 'Conjunto visible, calculado **antes** de paginar:', 'Conjunto visible, calculado **después** de paginar:'],
  H03: ['C', "`action: 'assignment_unavailable'`", "`action: 'courier_suspended'`"],
  H04: ['T', 'cancellation-history-list', 'cancellation-history-removed'],
  H05: ['C', '9 redefiniciones funcionales', '8 redefiniciones funcionales'],
  H06: ['C', 'p_include_assignment_unavailable boolean default false', 'p_include_assignment_unavailable boolean default true'],
  H07: ['D', '**Adenda (CC-053, autorizada por Lautaro073 el 2026-11-15):**', '**Adenda retirada:**'],
  H08: ['C', 'los wrappers de `src/server/rpc/` no reconocen ese SQLSTATE y lo devuelven como `INTERNAL_ERROR`', 'los wrappers de `src/server/rpc/` no reconocen ese SQLSTATE y lo devuelven como `DATABASE_ERROR`'],
  H09: ['C', "`app_private.unconsume_publication(request_id, p_actor_id, 'courier_suspended')`", "`app_private.skip_unconsume_publication(request_id, p_actor_id, 'courier_suspended')`"],
};
let green = 0, red = 0;
for (const [id, predicate] of Object.entries(check)) {
  if (!predicate(original)) { console.error('BASE FAIL', id); continue; }
  green++;
  const [file, from, to] = mutant[id];
  if (!original[file].includes(from)) { console.error('MUTATION NO TARGET', id); continue; }
  const changed = { ...original, [file]: original[file].replace(from, to) };
  if (predicate(changed)) { console.error('MUTATION NOT CAUGHT', id); continue; }
  red++;
}
console.log('BASE PASS=' + green + '/9 ; CONTROLLED MUTATIONS DETECTED=' + red + '/9');
if (green !== 9 || red !== 9) process.exitCode = 1;
NODE
node /tmp/pr748-round2-static-audit.mjs
```

**Interpretación estricta:** los checks son anclas de texto para contrastar las **nueve correcciones documentales**; no son una prueba de que la migración futura funcione. El script usa `git show` para leer los SHA sin editar el working tree; el mutante vive solo en memoria. Ejecutar `node` en el clon puede fallar si los textos cambian: el SHA es fijo y su falla debe investigarse, no taparse. La ejecución de referencia en esta revisión usó el conector GitHub y JavaScript de inspección: primero H01/H03/H04/H06/H07/H09, después H02/H05/H08, con las nueve mutaciones detectadas.

### Checkpoints del rollout que deberán ejecutarse en la implementación

1. **Viejo + viejo:** llamar firma CC-032 con 4 args, salida estricta de `courier_cancel_match`.
2. **Viejo + nuevo:** omitir quinto argumento, deben quedar fuera `assignment_unavailable`; comprobar contrato exacto de CC-032.
3. **Nuevo + viejo:** quinto argumento no existe: `PGRST202`; reintentar **una vez**, mismos cuatro argumentos previos, sin error visible ni acción nueva.
4. **Nuevo + nuevo:** flag `true`; página con acción `assignment_unavailable`, campos sensibles nulos, paginación mixta estable, acción neutral renderizada. Verificar primer fetch y «Ver más».
5. **Cache de esquema:** después del despliegue SQL, verificar que PostgREST reconozca la nueva firma de 5 args. `PGRST202` puede ser cache stale incluso con SQL nueva; fallback puede ocultar temporalmente el evento. No asumir que el estado nuevo+nuevo está confirmado solo por el éxito de la migración.

### Cierre documental (reproducible cuando haya clon)

```bash
git fetch origin
git rev-parse origin/develop origin/cc/CC-053-suspension-active-trips
git diff --check origin/develop...4129bf6f6ec56bf1f1eb7f57702d3b6c39c8a0f7
git merge-tree --write-tree origin/develop 4129bf6f6ec56bf1f1eb7f57702d3b6c39c8a0f7
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

No se requiere reejecutar un CI solo para los cambios de `docs/revision-pr/**` o la bitácora.
