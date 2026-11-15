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
