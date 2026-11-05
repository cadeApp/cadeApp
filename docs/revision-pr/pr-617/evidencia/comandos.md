# Evidencia — PR #617 / ronda 1

**SHA por inspección:** `8116e2397d9a28504024850be4ae31913d35abdc`. **Tests ejecutados por el revisor:** ninguno. No declarar RED, GREEN ni CI verificado a partir de esta evidencia.

## Referencias estáticas

- `src/features/admin/audit-format.ts:26,50-55`: tono positivo incondicional de incidente.
- `supabase/migrations/20260927120000_cc012_incidents_contract.sql`: `p_decision='no_action' → dismissed`, restantes → `resolved`, guardados en `after.status`.
- `src/features/admin/queries.ts:811-812`: página sin filas cancela ambos indicadores de navegación.
- `src/features/admin/components/audit-log-table.tsx:294-305`: no hay fallback de cursor vacío.
- El autor reportó M1/M2/M3 y 109 GREEN restaurados; no fueron reproducidos por el revisor.

## Harness completo propuesto para la próxima ronda

Se ejecuta **después del arreglo** sobre un SHA pusheado, en worktree descartable. No modifica el árbol del usuario; el contenido temporal de cada archivo se restaura **desde memoria** en `finally`, nunca mediante `git checkout`. No se ejecutó en esta ronda. Si el objetivo exacto no existe, falla **SIN OBJETIVO**; no cuenta como mutación roja.

Copiar **solo el siguiente bloque** a `/tmp/cadeapp-pr617-r1-harness.sh`, `bash -n /tmp/cadeapp-pr617-r1-harness.sh` y, desde el repo, `bash /tmp/cadeapp-pr617-r1-harness.sh <SHA-CORREGIDO>`.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SHA="$1"
if [ -z "$SHA" ]; then echo "Pasar SHA"; exit 1; fi
TEMP="$(mktemp -d)"
WT="$TEMP/wt"
cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1 || true
  rm -rf "$TEMP"
}
trap cleanup EXIT
git -C "$ROOT" worktree add --detach "$WT" "$SHA" >/dev/null
cd "$WT"
pnpm install --frozen-lockfile > "$TEMP/install.log" 2>&1 || { tail -n 30 "$TEMP/install.log"; exit 1; }
node - <<'NODE'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const paths = ['src/features/admin/audit-format.test.ts','src/features/admin/components/audit-log-table.test.tsx'];
function run(name) {
  const r = spawnSync('pnpm',['exec','vitest','run',...paths],{encoding:'utf8'});
  const sum = ((r.stdout||'')+'\n'+(r.stderr||'')).split(/\r?\n/).filter(x=>/Test Files |Tests /.test(x)).slice(-2);
  console.log(name+': '+(sum.join(' | ')||'sin resumen'));
  return r.status === 0;
}
if (!run('BASELINE')) throw new Error('Baseline RED: no iniciar mutaciones');
const mutations = [
 {id:'H01: dismissed tratado como positive',
  file:'src/features/admin/audit-format.ts',
  needle:"export function auditActionTone(item: Pick<AuditLogItem, 'action' | 'changes'>): AuditActionTone {",
  replacement:"export function auditActionTone(item: Pick<AuditLogItem, 'action' | 'changes'>): AuditActionTone {\n  if (item.action === 'admin_resolve_incident') return 'positive';"},
 {id:'H02: ocultar retorno desde cursor vacío',
  file:'src/features/admin/components/audit-log-table.tsx',
  needle:'filters.cursor !== undefined && result.items.length === 0',
  replacement:'false /* mutación: se anuló el fallback */'}
];
for (const m of mutations) {
  const original=fs.readFileSync(m.file,'utf8');
  const matches=original.split(m.needle).length-1;
  if (matches !== 1) throw new Error(m.id+': SIN OBJETIVO ('+matches+'), actualizar harness');
  try {
    fs.writeFileSync(m.file,original.replace(m.needle,m.replacement));
    if (run(m.id+' MUTADO')) throw new Error(m.id+': SOBREVIVIÓ, el control no detectó el defecto');
  } finally { fs.writeFileSync(m.file,original); }
  if (!run(m.id+' RESTAURADO')) throw new Error(m.id+': no recuperó GREEN');
}
console.log('Dos mutaciones detectadas; inspeccionar que los RED son aserciones de comportamiento, no setup');
NODE
```

**Comprobación obligatoria:** las pruebas mutadas deben fallar por la aserción de `dismissed` o por la ausencia del link `Volver al inicio`, no por error de import, timeout o sintaxis. Una mutación en rojo por otro motivo no verifica el hallazgo.

## Chequeos al estar sin bloqueantes

```bash
git fetch origin
git merge-tree --write-tree origin/develop origin/feat/T-407-auditoria-a06
pnpm typecheck > /tmp/t407-typecheck.log 2>&1
pnpm lint > /tmp/t407-lint.log 2>&1
pnpm exec vitest run src/features/admin/audit-format.test.ts src/features/admin/components/audit-log-table.test.tsx > /tmp/t407-unit.log 2>&1
grep -E 'Test Files|Tests ' /tmp/t407-unit.log | tail -n 3
node docs/revision-pr/analizar.mjs verificacion
```

CI oficial y `e2e-preview`: verificar su SHA y log real recién cuando la ronda esté sin bloqueantes. No usar Supabase ni Docker local ni secretos.
