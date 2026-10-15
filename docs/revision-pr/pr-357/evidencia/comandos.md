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
