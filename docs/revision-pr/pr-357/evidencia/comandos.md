# Evidencia y comandos reproducibles — PR #357 / T-361 · ronda 1

**SHA inspeccionado:** `3dad94b0039c7676838b7dfb82209b0798079711`. **Limitación:** este entorno NO tiene clon GitHub/pnpm accesible; no se ejecutaron Vitest ni Playwright del PR. El script siguiente fue smoke-testeado en `/tmp` con un fixture aislado que reprodujo la función y patrones del SHA, **no** constituye ejecución de los tests del repositorio sobre el SHA.

## Instrumento independiente completo (solo lectura; mutaciones en memoria)

Desde la raíz de un clon limpio en el SHA, copiar el bloque completo; no se necesita `.env` ni modifica ningún archivo del árbol de Git:

```bash
cat > /tmp/review-pr357-independent.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const root = process.argv[2] ?? process.cwd();
const get = (path) => readFileSync(join(root, path), 'utf8');
const source = get('src/lib/whatsapp.ts');
const match = source.match(/export function buildNotifyCustomerWhatsAppMessage\(params: NotifyCustomerMessageParams\): string \{([\s\S]*?)\n\}/);
assert.ok(match, 'No se encontró la implementación real de buildNotifyCustomerWhatsAppMessage');
const body = match[1];
const makeFn = (b) => new Function('params', b);
const params = (status) => ({courierName: 'Carlos Test', status});
const checks = [
  ['matched', /Ya tengo asignado tu pedido/, /en camino/i],
  ['in_transit', /estoy en camino/, /REQ-|Costo de envío:/i],
  ['delivered', /ya fue entregado/, /en camino/i],
];
function assertMessages(fn) {
  for (const [status, expected, forbidden] of checks) {
    const msg = fn(params(status));
    assert.match(msg, expected, 'Falta mensaje correcto para ' + status);
    assert.doesNotMatch(msg, forbidden, 'Contenido prohibido para ' + status);
    assert.match(msg, /Carlos Test/);
  }
}
assertMessages(makeFn(body));
console.log('GREEN control sin mutación: matched, in_transit y delivered');
const mutants = [
  ['matched falso en camino', 'Ya tengo asignado tu pedido', 'Estoy en camino con tu pedido'],
  ['in_transit omite aviso', 'Te aviso que estoy en camino', 'Te aviso que consultaré más tarde'],
  ['delivered dice otra cosa', 'Tu pedido ya fue entregado', 'Tu pedido se está preparando'],
];
for (const [name, needle, replacement] of mutants) {
  assert.ok(body.includes(needle), 'Mutación sin objetivo: ' + name);
  const mutated = body.replace(needle, replacement);
  assert.notEqual(mutated, body, 'Mutación sin efecto: ' + name);
  assert.throws(() => assertMessages(makeFn(mutated)), undefined, 'No se obtuvo RED: ' + name);
  console.log('RED mutación propia detectada: ' + name);
}
const courierView = get('src/features/trips/components/trip-courier-view.tsx');
const merchantView = get('src/features/trips/components/trip-merchant-view.tsx');
const e2e = get('e2e/specs/main-flow.spec.ts');
const knownDefects = [
  ['multi-drop courier usa trip.status sin estado del drop', /buildNotifyCustomerWhatsAppMessage\(\{[\s\S]{0,250}?status:\s*trip\.status/.test(courierView)],
  ['multi-drop merchant usa trip.status sin estado del drop', /buildNotifyCustomerWhatsAppMessage\(\{[\s\S]{0,250}?status:\s*trip\.status/.test(merchantView)],
  ['E2E todavía espera importe en el mensaje', /expect\(decodedMessage\)\.toContain\(formatArs\(acceptedOffer\.amountArs\)\)/.test(e2e)],
  ['E2E todavía espera efectivo', /expect\(decodedMessage\)\.toMatch\(\/efectivo\/i\)/.test(e2e)],
  ['status indefinido afirma en camino', /en camino/i.test(makeFn(body)(params(undefined)))],
];
for (const [name, present] of knownDefects) console.log((present ? 'RED por inspección: ' : 'NO DETECTADO; revalidar: ') + name);
if (!knownDefects.every(([, present]) => present)) console.log('El código cambió respecto del SHA auditado: hacer una nueva ronda.');
NODE
node /tmp/review-pr357-independent.mjs .
```

**Cuidado:** el instrumento compila *solo el cuerpo extraído* de la función de mensajes, sin montar componentes React ni ejecutar el Playwright real; las verificaciones de los componentes y E2E son estructurales. La extracción está intencionalmente acoplada a la firma exacta del SHA revisado; se debe crear batería nueva al recibir arreglos. Un «sin objetivo» NO es rojo válido.

**Smoke test realizado** (solo fixture local `/tmp/review-pr357` con la función de T-361 y patrones de componentes, no GitHub checkout):

```text
GREEN control sin mutación: matched, in_transit y delivered
RED mutación propia detectada: matched falso en camino
RED mutación propia detectada: in_transit omite aviso
RED mutación propia detectada: delivered dice otra cosa
RED por inspección: multi-drop courier usa trip.status sin estado del drop
RED por inspección: multi-drop merchant usa trip.status sin estado del drop
RED por inspección: E2E todavía espera importe en el mensaje
RED por inspección: E2E todavía espera efectivo
RED por inspección: status indefinido afirma en camino
```

Este smoke test valida que el script funciona y detecta los patrones del fixture; **no prueba el SHA remoto**. Los «RED por inspección» no son tests del proyecto.

## Evidencia remota CI observada

- HEAD: `3dad94b0039c7676838b7dfb82209b0798079711`.
- Run GitHub: https://github.com/cadeApp/cadeApp/actions/runs/38675475862 : unit, lint, typecheck, build, db-tests, audit, bundle-budget SUCCESS.
- Unit: `129 passed` archivos Vitest, workflows `79/79` y ADR `6/6`. No se sustituyen por afirmaciones de mutación del autor.
- DB: `All tests successful`; `Files=22, Tests=2205`, `Result: PASS`. Los fallos de mutación SQL del job son intencionales y restaurados.
- Approval policy: FAIL, salida «El PR requiere aprobación vigente de Lautaro073».
- Preview de Vercel en Ready. Sin ID/caso/resultados E2E Preview T-361 entregados para el SHA.

## Receta completa para próxima ronda (ejecutar EN clon limpio del nuevo SHA)

```bash
git fetch origin
git ls-remote origin feat/T-361-whatsapp-destinatario-natural
git status --short
git merge-tree --write-tree origin/develop HEAD
pnpm typecheck > /tmp/pr357-typecheck.log 2>&1; echo "typecheck:$?"; tail -15 /tmp/pr357-typecheck.log
pnpm lint > /tmp/pr357-lint.log 2>&1; echo "lint:$?"; tail -15 /tmp/pr357-lint.log
pnpm test > /tmp/pr357-test.log 2>&1; echo "test:$?"; grep -E 'Test Files|Tests |# tests|# pass|# fail' /tmp/pr357-test.log | tail -12
node docs/revision-pr/analizar.mjs verificacion
```

Los comandos con `;` muestran salidas incluso con fallos: **el agy debe detenerse ante cualquier exit distinto de cero, no ocultarlo**. `pnpm test:db` no es exigido por T-361 sin cambios de esquema/servidor, y esta revisión no levantó Supabase/Docker local. El E2E se corre con la infraestructura Preview+Supabase Develop existente, sobre el nuevo SHA; registrar run, URL y oráculos de usuario reales sin secretos. No modificar tests para fabricar verde.

## Ronda 2 — CI E2E (2026-10-15)

**Ejecutado remotamente, log leído por el revisor** (no simulación):
- Run: https://github.com/cadeApp/cadeApp/actions/runs/38758120713; job `e2e-preview=116502029876`; evento `repository_dispatch`.
- `workflow_run.head_sha=3b9f409048e2b3555377108cc29765c091fc995a` (**es develop, no el SHA efectivamente testeado**).
- Log: `actions/checkout ref: 7909e3bca66e29980b3bd6bb9b3c536844143f1a`, `HEAD is now at 7909e3b` y `git log -1 --format=%H => 7909e3...`.
- `pnpm exec playwright test --project=chromium --workers=1`: **76 passed, 2 failed**. E2E Flujo 5 en `main-flow.spec.ts:435`: **PASS 33.2s**.
- `e2e/specs/multi-drop.spec.ts:313`: `getByText('Destinatario Uno MD')`, strict mode: 1. `<p>Cliente: Destinatario Uno MD</p>`; 2. `<a>Avisar a Destinatario Uno MD</a>`.
- `e2e/specs/multi-drop.spec.ts:723`: `getByText('Destinatario Uno Writer')`, misma duplicación. Ambos fallan retry 1/2.

**Receta reproducible sobre checkout verdadero (NO ejecutada localmente por el revisor):**

```bash
git fetch origin
git switch feat/T-361-whatsapp-destinatario-natural
git pull --ff-only origin feat/T-361-whatsapp-destinatario-natural
git status --short
# RED ya observado en la suite Preview previa:
# https://github.com/cadeApp/cadeApp/actions/runs/38758120713
# Antes de arreglar, añadir test estricto para texto visible y nombre accesible en components.test.tsx.
pnpm exec vitest run src/features/trips/components.test.tsx > /tmp/t361-r01-red.log 2>&1; code=$?; tail -20 /tmp/t361-r01-red.log; echo "red_exit=$code"
# En el arreglo: texto visible multi-drop = 'Avisar por WhatsApp'
# aria-label por destinatario; no tocar e2e/specs/multi-drop.spec.ts.
# GREEN, revertir cualquier mutación con un backup /tmp verificable, sin git checkout.
pnpm exec vitest run src/features/trips/components.test.tsx > /tmp/t361-r01-green.log 2>&1; code=$?; tail -20 /tmp/t361-r01-green.log; test "$code" -eq 0
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

**Mutaciones independientes pendientes para ronda 3:** en copia aislada `/tmp`, probar volver `Avisar a ${drop.recipientName}` al texto visible mientras `aria-label` permanece y comprobar que la nueva prueba de texto visible cae (sin tocar fixtures ni tests); cambiar `href` de Beto a teléfono de Ana y comprobar que el oráculo de teléfono por drop cae; cambiar un estado `failed` por copy de `pending` y comprobar que el test de contenido por estado cae. Registrar comandos completos y verde original → rojo mutante → verde restaurado. **No se presentaron estas mutaciones como ejecutadas.**

## Ronda 3 — batería independiente real sobre SHA ea33a97

**Método y alcance:** El revisor obtuvo `src/lib/whatsapp.ts` del SHA `ea33a97064985f1e062c80bd0ba93f9b8ee053f8` por el conector GitHub y ejecutó en V8 aislado el **cuerpo real** de `buildNotifyCustomerWhatsAppMessage` (sin compilar TS ni montar React). **9 escenarios GREEN** originales, **6 mutaciones RED** propias (failed, delivered, identidad de emisor, matched, privacidad y pending) y **GREEN restaurado**. No se hicieron cambios en el repo. Los mensajes y tests React no se trataron como ejecutados por este harness.

**Script íntegro para repetir en un clon limpio con Node** (el V8 aislado del revisor ejecutó la misma lógica sobre el cuerpo remoto; este guion reproduce los pasos, no es Vitest):

```bash
cat > /tmp/review-pr357-r3.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const root = process.argv[2] ?? '.';
const code = readFileSync(root+'/src/lib/whatsapp.ts','utf8');
const match=code.match(/export function buildNotifyCustomerWhatsAppMessage\(params: NotifyCustomerMessageParams\): string \{([\s\S]*?)\n\}/);
assert.ok(match,'sin objetivo: firma inesperada');
const body=match[1];
const fn=(source)=>new Function('params',source);
const checks=[
 ['failed/courier',{courierName:'Prueba',sender:'courier',tripStatus:'in_transit',dropStatus:'failed'},['no se pudo completar','Soy Prueba'],['en camino','ya fue entregado','REQ-']],
 ['failed/merchant',{courierName:'Prueba',sender:'merchant',tripStatus:'in_transit',dropStatus:'failed'},['Prueba no pudo completar','Te escribo del comercio'],['Soy Prueba','en camino','ya fue entregado','REQ-']],
 ['delivered/courier',{courierName:'Prueba',sender:'courier',tripStatus:'in_transit',dropStatus:'delivered'},['ya fue entregado','Soy Prueba'],['en camino','no se pudo completar','REQ-']],
 ['delivered/merchant',{courierName:'Prueba',sender:'merchant',tripStatus:'delivered',dropStatus:'delivered'},['ya fue entregado por Prueba','Te escribo del comercio'],['Soy Prueba','en camino','REQ-']],
 ['pending/courier',{courierName:'Prueba',sender:'courier',tripStatus:'in_transit',dropStatus:'pending'},['en recorrido','Soy Prueba'],['ya fue entregado','no se pudo completar','REQ-']],
 ['pending/merchant',{courierName:'Prueba',sender:'merchant',tripStatus:'in_transit',dropStatus:'pending'},['está en recorrido','Te escribo del comercio'],['Soy Prueba','ya fue entregado','REQ-']],
 ['matched/courier',{courierName:'Prueba',sender:'courier',tripStatus:'matched'},['Ya tengo asignado tu pedido'],['en camino','ya fue entregado','REQ-']],
 ['matched/merchant',{courierName:'Prueba',sender:'merchant',tripStatus:'matched'},['es el repartidor asignado'],['Soy Prueba','en camino','ya fue entregado','REQ-']],
 ['legacy/delivered',{courierName:'Prueba',sender:'courier',tripStatus:'delivered'},['ya fue entregado'],['en camino','REQ-']]
];
function failures(source){const run=fn(source),errors=[];for(const [name,params,must,avoid] of checks){const msg=run(params);for(const t of must)if(!msg.includes(t))errors.push(name+' missing '+t);for(const t of avoid)if(msg.includes(t))errors.push(name+' leaked '+t)}return errors;}
assert.deepEqual(failures(body),[],'baseline no está verde'); console.log('GREEN baseline: 9 casos');
const mutants=[
 ['failed no reconocido',"params.dropStatus === 'failed'","params.dropStatus === 'never'"],
 ['delivered no reconocido',"params.dropStatus === 'delivered'","params.dropStatus === 'never'"],
 ['emisor merchant invertido',"if (params.sender === 'merchant')","if (params.sender === 'courier')"],
 ['matched dice en camino','Ya tengo asignado tu pedido','Estoy en camino con tu pedido'],
 ['REQ- incrustado','Quería avisarte que no se pudo completar la entrega','REQ-1234. Quería avisarte que no se pudo completar la entrega'],
 ['pending dice entregado','Ya retiré tu pedido y estoy en recorrido','Tu pedido ya fue entregado y estoy en recorrido']
];
for(const [name,needle,replacement] of mutants){assert.ok(body.includes(needle),'MUTANTE SIN OBJETIVO: '+name);const damaged=body.replace(needle,replacement);assert.notEqual(damaged,body);const errors=failures(damaged);assert.ok(errors.length,'MUTANTE SOBREVIVIENTE: '+name);assert.deepEqual(failures(body),[]);console.log('RED '+name+': '+errors[0]+'; GREEN restaurado');}
const courier=readFileSync(root+'/src/features/trips/components/trip-courier-view.tsx','utf8');
const merchant=readFileSync(root+'/src/features/trips/components/trip-merchant-view.tsx','utf8');
const tag='Avisar a '+String.fromCharCode(36)+'{drop.recipientName} por WhatsApp';
for(const [source,token] of [
 [courier,"arr.length > 1 ? 'Avisar por WhatsApp' : 'Avisar a mi cliente'"],
 [merchant,"dropsList.length > 1 ? 'Avisar por WhatsApp' : 'Avisar a mi cliente'"],
 [courier,tag],[merchant,tag],
 [courier,"dropStatus: arr.length > 1 ? drop.status : undefined"],
 [merchant,"dropStatus: dropsList.length > 1 ? drop.status : undefined"]
])assert.ok(source.includes(token),'Token estructural ausente: '+token);
console.log('PASS 6 tokens estructurales (inspección, NO DOM React)');
NODE
node /tmp/review-pr357-r3.mjs .
```

**Salida resumida REAL del V8 aislado**: baseline GREEN de 9 casos; 6 mutantes RED con aserciones rotas y verde original restaurado. Mutante `failed` deja de producir «no se pudo completar», `delivered` deja de anunciar entrega, invertir merchant rompe la identidad, matched con «en camino» viola el oráculo, inyectar REQ- viola privacidad y pending falsamente entregado viola estado. El guion Node es la versión copiable del mismo harness, no su propia ejecución confirmada por el revisor.

**CI:** HEAD ea33a97 [38783727001](https://github.com/cadeApp/cadeApp/actions/runs/38783727001) unit 133/2345 PASS; DB Files=22 Tests=2205 Result PASS. **E2E sobre código 5da667c:** [38779673898](https://github.com/cadeApp/cadeApp/actions/runs/38779673898) 78+3 PASS; T-340 multi-drop :41 y :364 PASS, T-361 Flujo 5 PASS. **E2E sobre HEAD documental ea33a97:** run 38783885818 en curso. H06: bitácora reconoce que los logs RED históricos R1 no se guardaron; no se los afirma ni reconstruye.
