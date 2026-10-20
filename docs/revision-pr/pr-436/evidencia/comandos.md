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
