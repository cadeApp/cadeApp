# Evidencia y comandos reproducibles — PR #436, ronda 1

**Base:** `54bbdcd7b079fa208e970725efa66832a8fac724`; **SHA inspeccionado:** `639ea6dc74ad87a27fb533dfd460d21e72f7dcc8`.  
**Tipo de evidencia:** inspección remota + comprobación de cobertura de especificación; **no ejecución de SQL ni E2E**.

## Consultas realizadas (vía GitHub)

- Obtener metadata HEAD y diff de PR #436.
- Comparar `develop` con `cc/CC-033-courier-optional-documents`: un commit ahead, cero behind.
- Leer `docs/contracts/CC-033.md`, `docs/tasks/T-376.md`, fila T-376 del plan y sus tres patches.
- Contrastar con `submit_courier_onboarding_documents` en `supabase/migrations/20261016033941_cc025_onboarding_atomic.sql` y `replace_courier_document` en `20261016210000_cc025_courier_document_replacement.sql` desde develop.
- Contrastar `courierOnboardingAction` y `vehicle_type` en `src/features/courier-onboarding/actions.ts` desde develop.
- Constatar ausencia de `docs/tasks/T-376.md` en develop (archivo nuevo), ausencia de carpeta de revisión `pr-436/` en rama revisada.

## Comprobación documental en SHA original (realizada sobre contenido recuperado de GitHub)

| Comprobación | SHA revisado | Interpretación |
|---|---|---|
| Guard `vehicle_type` en validaciones RPC propuestas | **FALTA** | H01 |
| Caso de onboarding incompleto en DoD de T-376 | **FALTA** | H01 |
| Prueba de integración multisesión exigida en Impacto exacto | **FALTA** | H02 |
| Orden de rollback UI antes que función | **FALTA** | H03 |
| Fila de plan T-376 exige onboarding completo | **FALTA** | H01 |

No se atribuye a estos checks cobertura de semántica de Postgres. Son señales de documentación que deben complementarse con revisión técnica en ronda 2.

## Script reproducible: detección documental (no reemplaza revisión humana)

Guardar el siguiente bloque como `/tmp/cc033-check.sh`, ejecutar desde la raíz del repo con `bash /tmp/cc033-check.sh`. Si el contrato no incorpora los requisitos devuelve **exit 1**; después de las correcciones debe devolver **exit 0**, sujeto a revisión semántica. Es un arnés **de documentación**, no pruebas falsas de SQL ni un sustituto de `db-tests`.

```bash
#!/usr/bin/env bash
set -euo pipefail
node <<'NODE'
const fs = require('node:fs');
const cc = fs.readFileSync('docs/contracts/CC-033.md', 'utf8');
const task = fs.readFileSync('docs/tasks/T-376.md', 'utf8');
const plan = fs.readFileSync('docs/implementation-plan.md', 'utf8');
const section = (text, from, to) => text.split(from)[1]?.split(to)[0] ?? '';
const proposed = section(cc, '## Propuesto', '## Invariantes');
const impact = section(cc, '## Impacto exacto en la tarea', '## Aprobaciones');
const rollback = section(cc, '## Compatibilidad, rollout y rollback', '## Decisiones de producto');
const dod = section(task, '## DoD', '## Regla de pruebas');
const row = plan.split('\n').find((line) => /^\| T-376 \|/.test(line)) ?? '';
const checks = [
  ['H01 RPC guard', /vehicle_type/i.test(proposed) && /vehicle_type\s+is\s+not\s+null/i.test(proposed)],
  ['H01 ficha', /vehicle_type|onboarding completo/i.test(dod)],
  ['H01 plan', /vehicle_type|onboarding completo/i.test(row)],
  ['H02 multisesion', /dos sesiones|multi.sesi[oó]n|cc033_concurrency/i.test(impact)],
  ['H03 rollback', /(?:retirar|deshabilitar|rollback)[\s\S]{0,650}(?:UI|interfaz)[\s\S]{0,1200}(?:drop function|migraci[oó]n posterior)/i.test(rollback)],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log((ok ? 'PRESENTE' : 'FALTA') + ' ' + name);
  if (!ok) failed++;
}
process.exitCode = failed > 0 ? 1 : 0;
NODE
```

**Limitación expresa:** por diseño esta inspección de palabras/patrones puede producir falsos positivos o negativos. El revisor debe contrastar **el comportamiento especificado completo** con CC-025; ningún `PRESENTE` implica `arreglado-verificado` sin esa revisión.

## Comandos permitidos para el autor de la PR DOCUMENTAL

```bash
git pull                           # primero, sin rebase ni amend
git diff --check
pnpm vitest run tools/verify-fichas.test.ts
git status --short
git diff origin/develop...HEAD --name-only
# Tras commit y push:
git ls-remote origin cc/CC-033-courier-optional-documents
```

No correr `pnpm test:db`, `db-tests`, E2E, Supabase local ni Docker como requisito de esta PR. Esas pruebas se exigirán en la **futura PR con RPC real**. No se registra salida de comandos que el revisor no ejecutó; el autor declaró `7/7` de verify-fichas y `diff --check` limpio.


---

## Ronda 2 — comprobación independiente del documento corregido

- **SHA exacto inspeccionado:** `79389ea830cc1c63636ffd06c35cefeafabdad6e`.
- **Diferencia desde commit de revisión R1:** solo `docs/contracts/CC-033.md`, `docs/tasks/T-376.md`, `docs/implementation-plan.md`.
- **Resultado ejecutado:** 16/16 aserciones documentales **PASS** sobre texto obtenido de GitHub en el SHA anterior; todas las condiciones se contrastaron además con las cláusulas completas.
- **Corrección del verificador preliminar:** la búsqueda inicial de «no se delega» marcó falso negativo porque la redacción dice «ni se delega». Corregí esa aserción y la reejecuté sobre el contenido exacto: PASS. No modifiqué la documentación para satisfacer el verificador.
- **Alcance:** ninguna aserción ejecuta SQL, valida RLS, crea una sesión Postgres ni demuestra las carreras; esas obligaciones serán verificadas en la PR de implementación de CC-033.

### Script reproducible completo para los controles documentales de la ronda 2

Se puede guardar íntegro en `/tmp/cc033-r2-check.cjs` y ejecutar desde la raíz del checkout en el **SHA `79389ea830cc1c63636ffd06c35cefeafabdad6e`** con `node /tmp/cc033-r2-check.cjs`. Usa solamente Node y `fs`. No modifica archivos. Los resultados se comparan contra el SHA del autor, no contra el commit de revisión.

```js
'use strict';
const fs = require('node:fs');
const cc = fs.readFileSync('docs/contracts/CC-033.md', 'utf8');
const task = fs.readFileSync('docs/tasks/T-376.md', 'utf8');
const plan = fs.readFileSync('docs/implementation-plan.md', 'utf8');
const row = plan.split('\n').filter(l => l.startsWith('| T-376 |'));
const checks = [
 ['H01 lock courier + vehicle_type', cc.includes('select profile_id, status, vehicle_type from public.couriers where profile_id = auth.uid() for update')],
 ['H01 elegibilidad', cc.includes("status in ('pending', 'approved') and vehicle_type is not null")],
 ['H01 estado de onboarding incompleto', cc.includes('vehicle_type is null` → `INVALID_STATE_TRANSITION')],
 ['H01 backend no solo UI', cc.includes('ni se\n   delega en la UI') && task.includes('la regla la sostiene la RPC')],
 ['H01 locks ordenados', cc.includes('`couriers FOR UPDATE` → `profiles FOR SHARE` → `courier_documents FOR UPDATE`')],
 ['H01 pgTAP futura', cc.includes("`vehicle_type = 'moto'`") && cc.includes('`vehicle_type = null` → `INVALID_STATE_TRANSITION` sin documento nuevo ni')],
 ['H01 DoD y plan', task.includes('con el onboarding completo') && row.length === 1 && row[0].includes('con el onboarding completo')],
 ['H01 decision A', cc.includes('(decisión A de la ronda 1 de #436) — Lautaro073, 2026-10-20')],
 ['H02 sesiones reales', cc.includes('dos sesiones PostgreSQL reales e independientes')],
 ['H02 carreras', cc.includes('**alta/alta**') && cc.includes('**alta/suspensión**')],
 ['H02 sin sleeps/mocks', cc.includes('sin `sleep` ni mocks de la capa de base')],
 ['H02 suite futura', cc.includes('`supabase/tests/integration/cc033_concurrency.mjs` (nueva')],
 ['H02 mutacion', cc.includes('**mutación RED** en la PR de implementación')],
 ['H03 antes y despues', cc.includes('**Antes de desplegar T-376**') && cc.includes('**Después de T-376:**')],
 ['H03 secuencia UI-RPC', cc.includes('primero se despliega una UI') && cc.includes('recién después, si hace falta, una migración nueva forward-only ejecuta')],
 ['H03 documentos y auditoria', cc.includes('persisten los documentos vigentes, sus estados de revisión y el `audit_log`')]
];
let fails = 0;
for (const [name, pass] of checks) {
 console.log((pass ? 'PASS' : 'FAIL') + ' ' + name);
 if (!pass) fails++;
}
console.log('RESULTADO ' + (checks.length - fails) + '/' + checks.length);
process.exitCode = fails ? 1 : 0;
```

**Registro de esta sesión:** la lógica del bloque anterior se ejecutó mediante un verificador JavaScript sobre las versiones de los documentos recuperadas del SHA de autor, y dio **16 PASS**. El envoltorio `fs.readFileSync` se incluye para reproducirlo en un checkout de la PR; **no se ejecutó un clon local**, porque este entorno no tenía resolución de DNS para clonar desde GitHub. No se hizo pasar el arnés por CI.

### Estado de CI al mirar (no usado como barrera para contenido documental)

En el commit del autor `79389ea830cc1c63636ffd06c35cefeafabdad6e` se observaron `audit`, `lint`, `build`, `typecheck` y `bundle-budget` en `success`; `unit` y `db-tests` estaban `in_progress` en la consulta inicial (run CI `39372401675`). `e2e-preview` constaba `pending`. No se afirma CI global verde ni se exige E2E/DB por los cambios de documentación.

**La ronda se declara sin bloqueantes documentales por inspección + controles propios; no se declara verificación ejecutable de la RPC futura.**
