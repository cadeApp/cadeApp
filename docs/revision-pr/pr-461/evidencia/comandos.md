# Evidencia y reproducción — PR #461 / T-379

## Evidencia realmente consultada

- SHA de código revisado: `246c9d2e41fbe7a7bc838827e528c2701500f73b`.
- Workflow: https://github.com/cadeApp/cadeApp/actions/runs/39470528570
- `unit`: `Test Files 152 passed (152)`; `Tests 3004 passed (3004)`.
- `db-tests`: `Files=34, Tests=3019`, `Result: PASS` y comprobación de tipo DB sin diferencias.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: success en el mismo SHA.
- E2E RED de `develop`, GREEN del Preview y mutaciones M1-M8: **documentadas únicamente por el autor** en `docs/tasks/log/T-379.md`. No las atribuimos a ejecución independiente.

## Harness independiente — reproducible cuando exista clon con dependencias

**Estado:** preparado para reproducir en un clon real; **NO EJECUTADO** desde este entorno (el acceso Git del contenedor no resuelve github.com). Los mutantes de abajo son nuevos e independientes de las ocho mutaciones de la bitácora.

Guardá **todo el bloque** siguiente como `/tmp/review-pr461.sh` y ejecutá `bash /tmp/review-pr461.sh` desde la raíz del repo (con `pnpm` y `node_modules` instalados). No leer, mostrar ni modificar secretos, ni conectar Supabase remoto. No cambia la rama original: crea un worktree desechable, guarda los originales en memoria, los restaura desde memoria (no `git checkout`) y destruye el worktree. Si la batería falla o no puede correr, **no** declarar RED/GREEN ni verificado.

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
SHA="246c9d2e41fbe7a7bc838827e528c2701500f73b"
TEMP="$(mktemp -d /tmp/review-pr461.XXXXXX)"
cleanup() {
  git -C "$ROOT" worktree remove --force "$TEMP/wt" >/dev/null 2>&1 || true
  rm -rf "$TEMP"
}
trap cleanup EXIT
test -d "$ROOT/node_modules" || { echo "Faltan node_modules; instalar dependencias primero"; exit 2; }
git -C "$ROOT" cat-file -e "$SHA^{commit}"
git -C "$ROOT" worktree add --detach "$TEMP/wt" "$SHA"
ln -s "$ROOT/node_modules" "$TEMP/wt/node_modules"
cat > "$TEMP/harness.cjs" <<'NODE'
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const tests = [
  'src/features/offers/queries.test.ts',
  'src/features/offers/components/my-offers-list.test.tsx',
  'src/features/trips/components.test.tsx',
];
const mutations = [
  { id: 'REV-M1', file: 'src/features/offers/components/my-offers-list.tsx',
    from: "label: OFFERS_COPY.requestDeliveredLabel", to: "label: OFFERS_COPY.requestCancelledLabel" },
  { id: 'REV-M2', file: 'src/features/offers/components/my-offers-list.tsx',
    from: "tripHref: `/trips/\${offer.requestId}`", to: "tripHref: null" },
  { id: 'REV-M3', file: 'src/features/offers/components/my-offers-list.tsx',
    from: "(offer.requestStatus === 'matched' || offer.requestStatus === 'in_transit')",
    to: "(offer.requestStatus === 'matched' || offer.requestStatus === 'published')" },
  { id: 'REV-M4', file: 'src/features/offers/queries.ts',
    from: "requestStatus: parseRequestStatus(req?.status),",
    to: "requestStatus: null," },
  { id: 'REV-M5', file: 'src/features/offers/queries.ts',
    from: "status: off.status as CourierOfferItem['status'],",
    to: "status: 'accepted' as CourierOfferItem['status']," },
  { id: 'REV-M6', file: 'src/features/trips/components/trip-merchant-view.tsx',
    from: "isDelivered ? 'Viaje finalizado' : 'Viaje en curso'",
    to: "isDelivered ? 'Viaje en curso' : 'Viaje en curso'" },
];
const originals = new Map(mutations.map(({file})=>[file,fs.readFileSync(file,'utf8')]));
function run(id) {
  const x=spawnSync('pnpm',['exec','vitest','run',...tests],{
    env:{...process.env,CI:'true'}, encoding:'utf8', maxBuffer:20*1024*1024,
  });
  const all=(x.stdout || '')+'\n'+(x.stderr || '');
  const lines=all.split('\n').filter(x=>/Test Files|Tests\s+\d+|FAIL|Error/.test(x));
  console.log(id, 'exit='+x.status, lines.slice(-5).join(' | ').replace(/\x1b\[[0-9;]*m/g,''));
  return x.status;
}
try {
  if (run('BASE-GREEN') !== 0) throw Error('No hay control GREEN inicial');
  for (const m of mutations) {
    const original=originals.get(m.file);
    if (original.split(m.from).length !== 2) throw Error(m.id+' tiene objetivo ausente o múltiple');
    fs.writeFileSync(m.file,original.replace(m.from,m.to));
    try {
      if (run(m.id+'-RED') === 0) throw Error(m.id+' sobrevivió: control insuficiente');
    } finally {
      fs.writeFileSync(m.file,original);
    }
  }
  if(run('FINAL-GREEN') !== 0) throw Error('No se recuperó el GREEN');
  console.log('REV-M1..REV-M6 detectadas; originales restaurados');
} finally {
  for(const [file,original] of originals) fs.writeFileSync(file,original);
}
NODE
(cd "$TEMP/wt" && node "$TEMP/harness.cjs")
git -C "$TEMP/wt" diff --exit-code
echo 'OK: worktree limpio y batería terminada'
```

El script de arriba **no es evidencia de ejecución** hasta que se conserve su salida completa con SHA, casos RED y control GREEN. Las mutaciones no deben guardarse, subirse ni usarse para adulterar expectativas. No se corren mutaciones de seguridad E2E fuera del workflow autorizado `e2e-mutation`.

## Gate final solicitado

Tras publicar la ronda, **no cancelar `e2e-preview` del último HEAD**; verificar en GitHub `e2e-preview`, `approval-policy` y los checks oficiales requeridos. Un commit exclusivamente documental no justifica inventar otra ejecución completa de tests del SHA funcional anterior, pero el gate oficial de integración debe pasar antes del merge.
