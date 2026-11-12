# Evidencia reproducible — PR #711, R1

**Verificación documental GitHub, no ejecución local de Supabase.** SHA de código: `6beb2104`; SHA inspeccionado: `0d6ee1fc`. Base `develop@c41129d3`. Sin clon local (el contenedor disponible no resuelve github.com); no se ejecutaron `pnpm`, `git merge-tree`, Docker, Supabase ni E2E. La evidencia SQL se contrasta con los logs del runner oficial y los scripts independientes son *inspección*, no pgTAP.

## Comprobaciones de GitHub

- `GET /repos/cadeApp/cadeApp/pulls/711`: head `0d6ee1fc4b395bd7e2a560e131700a04e1e51704`, base `c41129d3`, 48 archivos, 15 commits; mergeable=true en el snapshot.
- `GET /repos/cadeApp/cadeApp/actions/runs/43196349049/jobs` + logs `db-tests`, `unit`: RED, fallo SQL al no existir `consume_courier_application_attempt()`; Vitest 41 failed / 3865 passed.
- `GET /repos/cadeApp/cadeApp/actions/runs/43200528662/jobs` + logs `db-tests`, `unit`: GREEN, pgTAP `cc050_courier_dni_hardening.sql .... ok`, `Files=47, Tests=3932, Result: PASS`, `Tests 3926 passed (3926)`. job `db-tests` genera tipos locales y ejecuta `git diff --exit-code -- src/types/database.types.ts` correctamente. Job typecheck, lint, build, audit, bundle-budget exitosos.
- Mutaciones SQL (PR #712–#726) jobs db-tests de runs `43200566691, 43200581098, 43200593834, 43200608192, 43200621374, 43200635604, 43200649732, 43200666399, 43200682412, 43200697703, 43200713142, 43200722416, 43200738407, 43200756081, 43200769706`: 15/15 failure; logs confirman ids de pruebas 18,19,22,27; 26; 36,39; 47,49; 29,30; 45; 54; 56,57; 67,68,72; 11,22,23; 64–72; excepción UUID; 61,62; excepción de columna; 67. Excepción SQL aborta algunos tests: no equipararla con aserción específica.
- Mutaciones TS locales del autor: resultados anotados en `docs/tasks/log/T-434.md`, **no reproducidas por revisor**.
- H04: `GET /repos/cadeApp/cadeApp/commits/f9741d3439b15b96218e64b051bc3bd99f0d9891` (autor/committer Lautaro Emanuel Jimenez, 5 documentos); `GET .../commits/5baba42f1926f2179b09c41dc6f52286870c758b` (dos padres: `2989aaeb`, `f9741d34`). Retiro de H04 respaldado.

## Arnés independiente completo, para copiar a /tmp y ejecutar sobre el checkout del SHA

**No ejecutar scripts dentro de `docs/revision-pr/**`**. Este bloque crea el arnés en `/tmp`. `--expect-red` exige los cinco invariantes faltantes en el SHA de R1. Sin esa bandera exige que los cinco pasen, para R2. También verifica tres mutaciones del detector en memoria. No escribe archivos del repo.

```bash
cat >/tmp/pr711-r1-static.mjs <<'NODE'
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.argv[2];
assert.ok(root && fs.existsSync(path.join(root, 'src')), 'Pasá la raíz del checkout');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const sql = read('supabase/migrations/20261113120000_cc050_courier_dni_hardening.sql');
const detail = read('src/features/admin/components/applicant-detail-view.tsx');
const disputes = read('src/features/admin/components/dispute-candidates.tsx');
const page = read('src/app/(admin)/admin/applicants/disputes/page.tsx');
const fake = read('src/domain/testing/rpc-fake.ts');
function body(name) {
  const start = sql.indexOf('create or replace function public.' + name + '(');
  if (start < 0) return '';
  return sql.slice(start).split('$$;')[0];
}
const decide = body('admin_decide_courier');
const resolver = body('admin_find_courier_dni_reservation');
const pred = {
  H01_SQL: decide.includes('application_submitted') && decide.includes('for update') &&
           /not\s+v_application_submitted/i.test(decide),
  H01_UI: detail.includes('applicant.applicationSubmitted'),
  H02_POST: !disputes.includes('method="get"') &&
            !page.includes('searchParams') && /onSubmit/.test(disputes),
  H03_RPC: resolver.includes('assert_admin_aal2') &&
           resolver.includes('dni_hmac') &&
           resolver.includes('audit_log') &&
           /revoke all on function public\.admin_find_courier_dni_reservation/i.test(sql),
  H05_FAKE: !fake.includes('doc.courierId === courierId && doc.isCurrent') &&
            sql.includes('exists (select 1 from public.courier_documents d where d.courier_id = c.profile_id)')
};
for (const [k,v] of Object.entries(pred)) console.log(k + ': ' + (v?'PASS':'RED'));
const wantRed = process.argv.includes('--expect-red');
assert.equal(Object.values(pred).every(x => x === !wantRed), true,
  'Los predicados no concuerdan con el estado esperado');
const sensitivity = [
  ['H01', "if v_courier_status <> 'pending' then", "if v_courier_status <> 'pending' or not v_application_submitted then", x => /not v_application_submitted/.test(x)],
  ['H02', '<form method="get"', '<form method="post"', x => /method="post"/.test(x)],
  ['H05', 'doc.courierId === courierId && doc.isCurrent', 'doc.courierId === courierId', x => /doc\.courierId === courierId(?! && doc\.isCurrent)/.test(x)]
];
for (const [name,original,mutated,check] of sensitivity) {
  assert.equal(check(original), false, name + ' original');
  assert.equal(check(mutated), true, name + ' mutant');
  console.log('SENSIBILIDAD ' + name + ': baseline RED, mutada PASS');
}
NODE
node /tmp/pr711-r1-static.mjs "$PWD" --expect-red
```

**Resultado inspección dirigida sobre el head (datos leídos mediante GitHub):**

```text
RED H01_SQL
RED H01_UI
RED H02_POST
RED H03_RPC
RED H05_FAKE
SENSIBILIDAD H01: baseline=false, mutada=true
SENSIBILIDAD H02: baseline=false, mutada=true
SENSIBILIDAD H05: baseline=false, mutada=true
```

Limitación: el modo `--expect-red` confirma ausencia de predicados en R1. El arnés no simula ejecución de PostgreSQL; las mutaciones funcionales solicitadas en el informe deben producir verdaderos fallos de pgTAP/Vitest en la rama corregida.

## Reproducciones funcionales a exigir para R2

1. **H01**: pgTAP antes y después de quitar guarda en `admin_decide_courier` (dos decisiones, 0 updates y 0 audits); no basta afirmar que la UI oculta botones.
2. **H02**: tests DOM y, postmerge de migración, E2E garantizan POST y que el teléfono no aparece en URL; mutar a GET obliga al test a fallar.
3. **H03**: pgTAP con HMAC conocido, rol courier/aal1/aal2/anon, resultado exacto, audit sin PII, no auto-release. Mutantes contra cada propiedad y pruebas de action con secreto mockeado (nunca imprimir secreto real).
4. **H05**: test fake con sólo históricos; `documentsCount=0`; mutar elegibilidad a `isCurrent` falla.
5. Checks finales: `pnpm typecheck && pnpm lint && pnpm test`, `pnpm exec vitest run tools`, `node --test .github/workflows/verify-workflows.test.mjs`; `test:db` + comparación de tipos a cargo del CI ya existente. Mantener E2E Develop para después de migración del entorno.

**Validación estructural:** todas las líneas de `hallazgos.jsonl` deben parsear con `JSON.parse`; al tener checkout local completo, ejecutar también `node docs/revision-pr/analizar.mjs verificacion`.
