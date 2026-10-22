# Evidencia reproducible — PR #508 / T-393 — Ronda 1

**SHA de la fuente revisada:** \`e234ad0955b262f1cb2ce29ed06a50859ba9935f\`
**Fuente:** \`src/features/trips/drop-outcome.ts\`.
**Método real en esta sesión:** se obtuvo el archivo exacto vía GitHub, se removió **solo tipado TypeScript en memoria** y se ejecutó su lógica en JS con una batería del revisor. 10 comprobaciones originales pasaron. Las cinco mutaciones independientes fueron detectadas; no se tocaron archivos del repositorio. No fue posible clonar GitHub ni ejecutar \`pnpm\` en este contenedor (DNS github.com no disponible).

## Harness completo (para copiar en /tmp desde la raíz del clon)

Copiar íntegramente el siguiente bloque desde una raíz del repositorio y ejecutarlo. No crea ni modifica archivos en Git, y las mutaciones son cadenas en memoria. **Este harness fue ejecutado en modo equivalente en el aislado JS contra el contenido remoto del SHA**; su invocación desde \`/tmp\` en un clon debe revalidarse cuando el clon esté disponible.

\`\`\`bash
cat >/tmp/pr508-drop-outcome-review.cjs <<'NODE'
const fs = require('node:fs');
const assert = require('node:assert/strict');
const source = fs.readFileSync('src/features/trips/drop-outcome.ts', 'utf8');

function eraseTypes(s) {
  return s
    .replace(/export type [^\n]+\n/g, '')
    .replace(/export interface DropOutcomeSummary \{[\s\S]*?\n\}/, '')
    .replace(/export function toDropOutcomeStatus\(status: string \| undefined\): DropOutcomeStatus \{/, 'function toDropOutcomeStatus(status) {')
    .replace(/export function summarizeDropOutcome\([\s\S]*?\): DropOutcomeSummary \{/, 'function summarizeDropOutcome(drops, requestStatus) {')
    .replace(/let outcome: DropOutcome =/, 'let outcome =');
}
const load = s => new Function(eraseTypes(s) + '\nreturn {toDropOutcomeStatus,summarizeDropOutcome};')();

const cases = [
  ['dos-entregadas', ['delivered', 'delivered'], 'delivered', ['all_delivered', 2, 2, 0, 0]],
  ['parcial', ['delivered', 'failed'], 'delivered', ['partial', 2, 1, 1, 0]],
  ['ninguna', ['failed', 'failed'], 'delivered', ['none_delivered', 2, 0, 2, 0]],
  ['en-progreso', ['delivered', 'failed', 'pending'], 'in_transit', ['in_progress', 3, 1, 1, 1]],
  ['una-entregada', ['delivered'], 'delivered', ['all_delivered', 1, 1, 0, 0]],
  ['una-fallida', ['failed'], 'delivered', ['none_delivered', 1, 0, 1, 0]],
  ['una-pendiente', ['pending'], 'matched', ['in_progress', 1, 0, 0, 1]],
  ['legacy-entregada', [], 'delivered', ['all_delivered', 1, 1, 0, 0]],
  ['legacy-progreso', null, 'in_transit', ['in_progress', 1, 0, 0, 1]],
];
function run(s) {
  const f = load(s);
  const results = cases.map(([name, statuses, requestStatus, expected]) => {
    const actual = f.summarizeDropOutcome(statuses?.map(status => ({status})), requestStatus);
    return [name, JSON.stringify([actual.outcome, actual.total, actual.delivered, actual.failed, actual.pending]) === JSON.stringify(expected)];
  });
  results.push(['normaliza-unknown', f.toDropOutcomeStatus('otro') === 'pending']);
  return results;
}
const base = run(source);
assert(base.every(([, ok]) => ok), JSON.stringify(base.filter(([, ok]) => !ok)));
console.log('BASE GREEN: 10/10');

const mutants = [
  ['M1-failed-threshold', "else if (failed > 0)", "else if (failed > 999)"],
  ['M2-none-threshold', "if (delivered === 0)", "if (delivered < 0)"],
  ['M3-single-as-legacy', "if (!drops || drops.length === 0)", "if (!drops || drops.length <= 1)"],
  ['M4-failed-count', "const failed = drops.filter((d) => d.status === 'failed').length;", "const failed = 0;"],
  ['M5-unknown-coerced-delivered', "return status === 'delivered' || status === 'failed' ? status : 'pending';", "return status === 'delivered' || status === 'failed' ? status : 'delivered';"],
];
for (const [id, from, to] of mutants) {
  assert(source.includes(from), id + ' sin objetivo: no asumir que la prueba pasó');
  const changed = source.replace(from, to);
  const failures = run(changed).filter(([, ok]) => !ok).map(([name]) => name);
  assert(failures.length > 0, id + ': mutación NO detectada');
  console.log(id + ' RED: ' + failures.join(', '));
}
console.log('MUTACIONES RED: 5/5');
NODE
node /tmp/pr508-drop-outcome-review.cjs
\`\`\`

**Salida observada del harness equivalente sobre el contenido recuperado en esta ronda:**
\`\`\`text
BASE GREEN: 10/10
M1-failed-threshold RED: parcial
M2-none-threshold RED: ninguna, una-fallida
M3-single-as-legacy RED: una-fallida
M4-failed-count RED: parcial, ninguna, en-progreso, una-fallida
M5-unknown-coerced-delivered RED: normaliza-unknown
MUTACIONES RED: 5/5
\`\`\`

## Reproducciones pendientes en un clon

**H01**
\`\`\`bash
pnpm exec vitest run src/features/trips/drop-outcome.test.ts src/features/trips/components.test.tsx src/features/requests/components/merchant-history-view.test.tsx
\`\`\`
Antes de implementar el fix de single-drop, el nuevo caso debe fallar por ausencia de Badge/motivo y por mensaje de WhatsApp incorrecto; no por error artificial de importación. Tras arreglar, GREEN. Mutación posterior: cambiar únicamente \`dropStatus\` para el single a \`undefined\` en memoria/worktree temporal, RED; restaurar y GREEN.

**H02**
\`\`\`bash
# Preparar las credenciales de E2E autorizadas por el entorno; no registrarlas en archivos ni logs.
CI=true pnpm exec playwright test e2e/specs/merchant-partial-delivery.spec.ts --retries=0
\`\`\`
En el nuevo E2E: crear \`draft\` administrativo, llamar \`publish_request\` con cliente autenticado del comercio y afirmar salida. Mutar temporalmente omitiendo esa llamada: \`submit_offer\` no debería avanzar y el spec pasa a RED; restaurar, E2E GREEN, y conservar verificación de UI. No ejecutar remoto sin las protecciones y el Preview establecidos.

**H03**
\`\`\`bash
pnpm exec vitest run src/features/trips/components.test.tsx -t 'T-393'
\`\`\`
Agregar aserción a \`XCircle\` del último paso, mutar ese único componente a \`CheckCircle2\` (no el texto ni los checks de otros pasos) y exigir RED; restaurar y exigir GREEN.

## Checks completos — cuando no queden bloqueantes
\`\`\`bash
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
\`\`\`
No se levantó Docker ni Supabase. No se lanzó ni inspeccionó CI completo en ronda con bloqueantes; la bitácora del autor no sustituye estos comandos del revisor. Revisar HEAD y correlación SHA antes de afirmar verde.
