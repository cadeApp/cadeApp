# Evidencia y comandos — PR #389 / ronda 1

**Estado:** inspección remota. El runtime de la revisión no tiene clon y git ls-remote falla por resolución DNS de github.com. No se ejecutaron Vitest, Playwright ni las mutaciones aquí. **Los resultados de abajo son expectativas para probar**, no salidas observadas. El harness es independiente de las mutaciones del autor y restaura los contenidos originales en finally (sin git checkout, rebase ni commit).

## A. Precondiciones de revisión en un clon limpio

~~~bash
git fetch origin
git rev-parse HEAD
git ls-remote origin refs/heads/feat/T-362-cancelacion-viaje-por-rol
git status --short
git diff origin/develop...HEAD --stat
git diff origin/develop -- docs/tasks/T-362.md
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
~~~

HEAD inspeccionado: d872ec9b49a7a7ee0d3a21f7485026545a2ccb49. Si el SHA cambió, hacer ronda nueva y no trasladar etiquetas de verificado.

## B. Harness completo de mutaciones de UI (copiar de la caja /tmp)

Ejecutar desde la raíz del repositorio, preferentemente en un worktree limpio fijado al SHA que se está revisando. El script guarda cada archivo como string y lo repone siempre. No utilizar el script si hay cambios sin commitear sobre los archivos objetivo.

~~~bash
cat >/tmp/pr389-mutations.mjs <<'SCRIPT'
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const suite = 'src/features/trips/components/trip-cancel-dialog.test.tsx';
const target = {
  dialog: 'src/features/trips/components/trip-cancel-dialog.tsx',
  courier: 'src/features/trips/components/trip-courier-container.tsx',
  merchantView: 'src/features/trips/components/trip-merchant-view.tsx',
};
function run() {
  const p = spawnSync('pnpm', ['exec', 'vitest', 'run', suite], {
    cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
  const log = (p.stdout || '') + '\n' + (p.stderr || '');
  const summary = log.split('\n').filter(line =>
    /Test Files|Tests |FAIL |AssertionError|ReferenceError|Error:/.test(line)
  ).slice(-12).join('\n');
  return { ok: p.status === 0, summary, code: p.status };
}
const original = run();
console.log('CONTROL SIN MUTAR, esperado GREEN:', original);
if (!original.ok) throw new Error('El control ya estaba ROJO; detener la mutación');

function mutate(label, relativePath, beforeText, afterText, expectGreen) {
  const absolutePath = path.join(root, relativePath);
  const before = fs.readFileSync(absolutePath, 'utf8');
  const occurrences = before.split(beforeText).length - 1;
  if (occurrences !== 1) throw new Error(label + ': objetivo no unívoco (' + occurrences + ')');
  try {
    fs.writeFileSync(absolutePath, before.replace(beforeText, afterText));
    const outcome = run();
    console.log('\n' + label + ' (esperado ' + (expectGreen ? 'GREEN/SURVIVE' : 'RED') + '):\n' + outcome.summary);
    if (outcome.ok !== expectGreen) throw new Error(label + ': resultado inesperado, revisar la aserción funcional');
  } finally {
    fs.writeFileSync(absolutePath, before);
  }
}
mutate('M1 lista de cadete equivocada', target.dialog,
  'const reasons = actor === \'courier\' ? COURIER_CANCELLATION_REASONS : MERCHANT_CANCELLATION_REASONS;',
  'const reasons = MERCHANT_CANCELLATION_REASONS;', false);
mutate('M2 razón Emergencia borrada (debe sobrevivir ANTES de arreglar H03)', target.dialog,
  "  'Emergencia',", "  'Otro problema',", true);
mutate('M3 cancelación merchant visible in_transit', target.merchantView,
  '{onCancelTrip && isMatched && (', '{onCancelTrip && !isDelivered && (', false);
mutate('M4 Otro vacío permitido sin ReferenceError', target.dialog,
  'otherReason.trim().length > 0 && otherReason.trim().length <= 500',
  'otherReason.trim().length >= 0 && otherReason.trim().length <= 500', false);
mutate('M5 actor courier perdido en container (debe sobrevivir ANTES de arreglar H04)', target.courier,
  'actor="courier"', 'actor="merchant"', true);
const end = run();
console.log('\nCONTROL RESTAURADO, esperado GREEN:', end);
if (!end.ok) throw new Error('Fallo al restaurar GREEN');
SCRIPT
node /tmp/pr389-mutations.mjs
git status --short
~~~

**Importante:** los mutantes M2 y M5 deben sobrevivir antes de reparar los tests, y dar RED después de añadir los oráculos independientes. En las siguientes rondas la expectativa del harness para esos mutantes debe cambiarse de true a false. No alterar asserts para ocultar fallos. El script está documentado pero no ejecutado por esta revisión: no reemplaza el log real.

## C. Tests y E2E sobre el SHA final (sin secrets)

~~~bash
pnpm exec vitest run src/features/trips/components/trip-cancel-dialog.test.tsx src/features/trips/components.test.tsx src/features/trips/actions.test.ts
pnpm typecheck
pnpm lint
pnpm test
# E2E Preview se observa desde el workflow e2e-preview de GitHub Actions
# Comprobar run, SHA, estado y aserciones DB reales; no ejecutar comandos contra Supabase remoto.
~~~

El spec de E2E se probará mediante el gate del proyecto contra Vercel Preview + Supabase Develop, con fixtures segregados. Las mutaciones de seguridad E2E solo pueden ejecutarse mediante e2e-mutation contra develop **después** de mergear y mediante un cambio/PR autorizado; no desplegar mutantes en PR abierta. Si el run no existe o no terminó, registrar PENDIENTE, nunca GREEN.

## D. Cruce estático

- El spec añadido desde la línea 1151 solo ejecuta courier_cancel_match por UI en matched; merchant aparece solo en el chequeo negativo de in_transit.
- La expectativa positiva unitaria itera constantes exportadas por producción: M2 altera la expectativa automáticamente.
- La suite nueva no monta TripCourierContainer: M5 no ejerce el actor desde el consumidor.
- La mutación C del autor declara ReferenceError, no RED por longitud vacía.
- En /trips/[id] el botón de report_incident ya está disponible en estados autorizados; no modificar RPC de incidentes.


---

## Ronda 2 — harness corregido (error del revisor R1)

**ATENCIÓN:** el harness R1 anterior tiene un error de mi revisión: M1 busca la subcadena const reasons = actor... sin anclaje, que aparece tres veces (líneas 58, 63 y 67 del componente). El conteo del propio script la rechaza por ambigüedad antes de mutar. Sus cinco mutaciones no son reproducibles tal cual quedó archivado. El siguiente harness corrige la selección de M1 con un salto de línea y dos espacios, que identifica solo la declaración exterior. Se inspeccionaron las cinco cardinalidades contra SHA 1da28cca: todas tienen una ocurrencia exacta. NO se ejecutó Vitest ni se reprodujo RED/GREEN en esta sesión por ausencia de clon (DNS github.com).

### Harness completo v2: copiar tal cual a /tmp desde un worktree limpio

~~~bash
cat >/tmp/pr389-r2-mutations.mjs <<'SCRIPT'
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const suite = 'src/features/trips/components/trip-cancel-dialog.test.tsx';
const files = {
  dialog: 'src/features/trips/components/trip-cancel-dialog.tsx',
  courier: 'src/features/trips/components/trip-courier-container.tsx',
  merchant: 'src/features/trips/components/trip-merchant-view.tsx',
};

function run() {
  const proc = spawnSync('pnpm', ['exec','vitest','run',suite], {
    cwd:root, encoding:'utf8', maxBuffer:16*1024*1024
  });
  const output = (proc.stdout || '') + '\n' + (proc.stderr || '');
  const summary = output.split('\n').filter(s =>
    /Test Files|Tests |FAIL |AssertionError|TestingLibraryElementError|ReferenceError|Error:/.test(s)
  ).slice(-14).join('\n');
  return { ok:proc.status === 0, output, summary,
    ranTests:/Test Files\s/.test(output) && /\bTests\s/.test(output) };
}

const base = run();
console.log('CONTROL ORIGINAL GREEN:\n' + base.summary);
if (!base.ok || !base.ranTests) throw Error('No hay control GREEN, abortar');

function mutate(label, file, before, after, failureName) {
  const abs = path.join(root,file);
  const original = fs.readFileSync(abs,'utf8');
  const count = original.split(before).length-1;
  if (count !== 1) throw Error(label + ': objetivo no único: ' + count);
  try {
    fs.writeFileSync(abs,original.replace(before,after));
    const result = run();
    console.log('\n' + label + ' RED esperado:\n' + result.summary);
    if (!result.ranTests || result.ok) throw Error(label + ': sin RED de tests');
    if (!result.output.includes(failureName)) throw Error(label + ': falla fuera de prueba esperada');
    if (/ReferenceError: isOther is not defined|Transform failed|Failed to resolve import/i.test(result.output))
      throw Error(label + ': falló compilación/referencia, no el invariante');
  } finally {
    fs.writeFileSync(abs,original);
  }
}

mutate('M1 razones cadete', files.dialog,
  "\n  const reasons = actor === 'courier' ? COURIER_CANCELLATION_REASONS : MERCHANT_CANCELLATION_REASONS;",
  '\n  const reasons = MERCHANT_CANCELLATION_REASONS;',
  'muestra exactamente el conjunto contractual de razones del repartidor');
mutate('M2 opción Emergencia', files.dialog,
  "  'Emergencia',", "  'Otro problema',",
  'muestra exactamente el conjunto contractual de razones del repartidor');
mutate('M3 merchant in_transit', files.merchant,
  '{onCancelTrip && isMatched && (',
  '{onCancelTrip && !isDelivered && (',
  'TripMerchantView: en in_transit NO muestra');
mutate('M4 Otro espacios vacíos', files.dialog,
  'otherReason.trim().length > 0 && otherReason.trim().length <= 500',
  'otherReason.trim().length >= 0 && otherReason.trim().length <= 500',
  'al seleccionar «Otro», exige texto de aclaración no vacío');
mutate('M5 actor courier en contenedor', files.courier,
  'actor="courier"', 'actor="merchant"',
  'TripCourierContainer transmite actor="courier"');

const end = run();
console.log('\nCONTROL RESTAURADO GREEN:\n' + end.summary);
if (!end.ok || !end.ranTests) throw Error('No quedó GREEN al restaurar');
SCRIPT
node --check /tmp/pr389-r2-mutations.mjs
node /tmp/pr389-r2-mutations.mjs
git status --short
~~~

**Nota:** script diseñado y patrones revisados por inspección. Es necesario ejecutarlo verdaderamente en clon limpio, registrar salida real de cada test y comprobar que el control final está GREEN. La mutación v1 equivocada queda aquí como historia, no se reescribe la ronda 1. El agente no puede tocar esta carpeta.

### R01 / R02 y controles de cierre

R01: la aserción de paso 2 para merchant apunta a dos textos inexistentes; comparar e2e/specs/request-states.spec.ts:1271-1274 contra trip-cancel-dialog.tsx:115 y 124. El E2E debe exigir exactamente los textos que renderiza la UI actual.

R02: requestStatus se confirma cancelled en e2e:1288 antes de la visita ajena e2e:1304. En SQL CC008 get_trip_details, el filtro de estado de líneas 56-62 antecede al chequeo de actor de líneas 79-85. El negativo debe correr con merchantRequestId en matched y actor asignado capaz de ver el mismo viaje, antes de cancelarlo.

Calidad faltante tras reparar: pnpm typecheck, pnpm lint, pnpm test completos, y E2E Preview (CI) con run + SHA + resultado en bitácora. No se disparan workflows ni se llama a Supabase remoto; no se consultan logs CI mientras haya bloqueantes.


---

## Ronda 3 — evidencia remota 059270f

CI GitHub run: https://github.com/cadeApp/cadeApp/actions/runs/39053655012
- unit job 117457127966: Test Files 140 passed (140); Tests 2593 passed (2593); workflows 79 passed, ADR 6 passed.
- db-tests job 117457127855: Files=27, Tests=2420; Result: PASS, comparación de tipos success. Los errores de mutantes intermedios son deliberados y se restauran.
- typecheck, lint, audit, build y bundle-budget: success.
- approval-policy job 117457124262: exit 1 porque requiere aprobación vigente de Lautaro073.

E2E Preview run: https://github.com/cadeApp/cadeApp/actions/runs/39053732705
- El status del commit dice: E2E no corrió (cancelled): re-ejecutar el run.
- resolve-preview success; e2e-preview cancelled; report-preview-status success.
- SHA objetivo publicado en el status: 059270f612fcfd00fdefab24e5aea3ebf57f81ef.
- Log del job cancelado no disponible (BlobNotFound). No hubo salida de test del caso T-362.

Inspección fuente:
- R01: e2e/specs/request-states.spec.ts líneas 1293-1302 ahora coincide con trip-cancel-dialog.tsx líneas 115/124.
- R02: mismo spec 1238-1271, matched confirmado, negocio dueño visible y actor ajeno rechazado antes de cancelar.
- R03: bitácora documenta variante Windows shell:true, RED M1–M5, GREEN 17/17; NO ejecutado por el revisor debido a que no existe clon con red.

Verificación siguiente:
- git fetch origin && git merge origin/develop (no rebase, no force).
- git status --short y git diff --check; comprobar git merge-tree --write-tree origin/develop HEAD.
- pnpm exec vitest run src/features/trips/components/trip-cancel-dialog.test.tsx src/features/trips/components.test.tsx src/features/trips/actions.test.ts
- pnpm typecheck && pnpm lint && pnpm test
- Push normal y registrar CI + E2E Preview sobre SHA integrado. No saltear, fingir GREEN ni ejecutar comandos contra Supabase remoto.
- No exigir CI nuevo por este commit exclusivo de revisión documental. La fusión de develop sí cambia código y requiere revalidación.

---

## Ronda 4 — evidencia remota de SHA dfe467a

CI real: https://github.com/cadeApp/cadeApp/actions/runs/39061791920
- unit 117481086796: Test Files 142 passed (142), Tests 2685 passed (2685), workflows 79/79 y ADR 6/6.
- db-tests 117481086777: Files=29, Tests=2735, Result: PASS; mutaciones SQL RED temporales restauradas, job final success.
- typecheck/lint/build/audit/bundle-budget: success; Vercel deployed.
- approval-policy: https://github.com/cadeApp/cadeApp/actions/runs/39061789281; log: El PR requiere aprobación vigente de Lautaro073.

E2E run real: https://github.com/cadeApp/cadeApp/actions/runs/39061870840
- Evento repository_dispatch, resolve-preview success, e2e-preview cancelled, report-preview-status success.
- Commit status del SHA dfe467a: error, descripción E2E no corrió (cancelled): re-ejecutar el run.
- Log del job cancelado devuelve BlobNotFound, sin oráculos de Playwright. No hay falso GREEN ni resultado RED de asserts.
- Workflow .github/workflows/e2e-preview.yml: job e2e tiene concurrency group cadeapp-develop-e2e y cancel-in-progress false. Posible competencia con otras PR; no se probó como causa de la cancelación.

Comprobación de hashes de blobs entre 059270f y dfe467a:
- trip-cancel-dialog.tsx, trip-courier-container.tsx, trip-courier-view.tsx y trip-cancel-dialog.test.tsx: idénticos.
- trip-merchant-container.tsx: únicamente el éxito de reporte no-show router.refresh cambia a router.push hacia merchant/requests/id.
- trip-merchant-view.tsx: añade presentación de medio de pago, no toca isMatched de cancelar.
- request-states.spec.ts: una aserción ajena a T-362, anterior a su sección.

No corrí tests locales ni mutaciones; no certificar como verificado-runtime. No pedir un nuevo CI GREEN solo porque se añadió ronda 4, ni por registrar luego una corrida E2E en la bitácora.

---

## Ronda 5 — evidencia inspeccionada de E2E real

- Run E2E: https://github.com/cadeApp/cadeApp/actions/runs/39064324483; job 117488688553; target SHA ae05b35cf46b5217f37932c76fdff9cad2fe996a según checkout del job.
- Log observado: `87 passed (21.9m)` en chromium; `✓ 76 [chromium] ... request-states.spec.ts:1149 ... T-362 ... (44.9s)`.
- Global-settings: `subscription.global-settings.spec.ts:107`, error en 136; fail inicial + retry1 + retry2, locator de alerta suscripción vencida no encontrado. Job global conclusion=failure, 2 pruebas global-settings restantes did not run.
- Bitácora cita 77 chromium: diferencia documental frente al dato real 87.
- Comparación ae05b35..37c7e8a: un único archivo modificado, docs/tasks/log/T-362.md, 25 líneas. Comparación con develop: behind=0, ahead=12, mergeable=true.
- Issue segregado: https://github.com/cadeApp/cadeApp/issues/405. No diagnosticar causa ni omitir test T-306.
- Run nuevo por push exclusivamente documental: 39066467970 in_progress al momento de la lectura; resultado no anticipado. No exigir CI nuevo solo por cambio de log/revisión.

No ejecuté Playwright localmente ni mutaciones locales. La verificación de H01/H02/R01/R02 fue independiente mediante lectura del log y matching SHA del E2E real ejecutado por CI sobre código sin cambios funcionales posteriores. R03 permanece sin reproducción autónoma.


---

## Ronda 6 — corroboración remota de integración y gates

- Functional SHA: `476ff4dbee7bf0e6fc43b4b507a1e772e27c62f4`. Base develop: `0488f8a98f44b67101c7c520696c356d46c161ff`. Compare develop...branch: ahead=15, behind=0, GitHub mergeable=true.
- PR T-371 mergeada: https://github.com/cadeApp/cadeApp/pull/407 ; merge SHA 0488f8a, 2026-10-17T23:17:23Z; issue #405 cerrado. E2E T-371 run https://github.com/cadeApp/cadeApp/actions/runs/39075847138 = SUCCESS.
- Todos los blobs funcionales T-362 (dialog, test, courier container/view, merchant container/view, e2e/specs/request-states.spec.ts) permanecen idénticos a SHA ae05b35.
- CI #389: https://github.com/cadeApp/cadeApp/actions/runs/39079233749 → completed SUCCESS para 476ff4d. Unit job 117532620740 142 archivos PASS, 2687 tests PASS, workflows 79/79 y ADR 6/6. DB job 117532620761 Files=29, Tests=2735, Result: PASS. Typecheck/lint/audit/build/bundle-budget SUCCESS.
- E2E del propio SHA: https://github.com/cadeApp/cadeApp/actions/runs/39079295420 → resolve-preview success, e2e-preview cancelled (job 117532834069, log BlobNotFound), report-preview-status success. Job de publicación informa RESULT: cancelled; TARGET_SHA: 476ff4d...; status e2e-preview=error. No log Chromium ni pruebas reproducidas para este SHA.
- Approval-policy check #39079231341 job 117532613738 FAIL: El PR requiere aprobación vigente de Lautaro073.
- Review artifact files de la R5 sin alteraciones por autora entre commits 09e9147 y 476ff4d.
- No se ejecutaron tests ni mutaciones locales, ni git merge-tree por no haber clon disponible. No se dispararon workflows manualmente.

**Acciones para repetir legítimamente el gate:** el operador autorizado puede usar Re-run all jobs en el run #39079295420. Comprobar el mismo TARGET_SHA, `e2e-preview=success`, oráculos del E2E T-362 y los tres global-settings, antes de registrar la conclusión. Reejecución E2E en un run real NO implica reejecutar unit/DB por documentos. Sin falsos GREEN.
