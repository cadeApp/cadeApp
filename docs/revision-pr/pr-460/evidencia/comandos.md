# Evidencia y comandos reproducibles — PR #460 / T-383

**SHA revisado:** `73c26dd0d199af1377f0777b8823a6ae8618b512`. No hubo clon local en esta sesión: las fuentes se leyeron con el conector GitHub. No se ejecutó ningún E2E remoto desde la revisión ni se accedió a `.env*`. Los resultados de Playwright RED/GREEN fueron escritos por el autor en `docs/tasks/log/T-383.md`.

## Sondas independientes estáticas (ejecutadas en memoria con blobs de GitHub)

Estas **NO son mutaciones funcionales de Vitest**: aseguran propiedades textuales concretas y se rompen intencionalmente al alterar su fuente; el test de comportamiento real está en CI y en el E2E documentado. Se ejecutaron sobre los contenidos de `73c26dd0d199af1377f0777b8823a6ae8618b512`:

```text
S1-RPC sin upsert: baseline=PASS, mutación=DETECTED
S2-respuesta sin datos de cuenta: baseline=PASS, mutación=DETECTED
S3-lectura negativa RLS A: baseline=PASS, mutación=DETECTED
```

### Harness COMPLETO (copiar a /tmp y ejecutar desde la raíz del repositorio)

```bash
cat > /tmp/pr460-probes.cjs <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const route = fs.readFileSync(path.join(root, 'src/app/api/push/subscriptions/route.ts'), 'utf8');
const spec = fs.readFileSync(path.join(root, 'e2e/specs/push-user-activation.spec.ts'), 'utf8');
const post = s => s.split('export async function POST')[1]?.split('export async function DELETE')[0] ?? '';
const guards = [
  {
    name: 'S1-RPC sin upsert',
    src: route,
    mutate: s => s.replace('registerPushSubscriptionRpc(supabase, parsed.data)', "supabase.from('push_subscriptions').upsert(parsed.data)"),
    check: s => post(s).includes('registerPushSubscriptionRpc(supabase, parsed.data)') &&
      !post(s).includes(".from('push_subscriptions')")
  },
  {
    name: 'S2-respuesta sin datos de cuenta',
    src: route,
    mutate: s => s.replace('return NextResponse.json({ ok: true });', 'return NextResponse.json({ ok: true, userId: user.id });'),
    check: s => post(s).includes('return NextResponse.json({ ok: true });') &&
      !post(s).includes('userId:')
  },
  {
    name: 'S3-lectura negativa RLS A',
    src: spec,
    mutate: s => s.replace('expect(await endpointOwnersVisibleTo(courierA, browserSubscription.endpoint)).toEqual([]);', 'void courierA;'),
    check: s => s.includes('expect(await endpointOwnersVisibleTo(courierB, browserSubscription.endpoint)).toEqual([courierB.id]);') &&
      s.includes('expect(await endpointOwnersVisibleTo(courierA, browserSubscription.endpoint)).toEqual([]);')
  }
];
let failed = false;
for (const item of guards) {
  const baseline = item.check(item.src);
  const mutant = item.mutate(item.src);
  const detected = mutant !== item.src && !item.check(mutant);
  console.log(item.name + ': baseline=' + (baseline ? 'PASS' : 'FAIL') +
    ', mutación=' + (detected ? 'DETECTED' : 'ESCAPED'));
  if (!baseline || !detected) failed = true;
}
if (failed) process.exitCode = 1;
NODE
node /tmp/pr460-probes.cjs
```

El script no modifica el árbol; aplica mutaciones solo a cadenas en memoria. Las tres mutaciones son **propias de esta revisión**, distintas de M1-M3 del autor.

## Reproducción funcional que puede ejecutarse en un clon configurado (NO ejecutada aquí)

Siempre sobre un `git worktree` limpio del SHA, sin tocar la rama de trabajo y sin subir los mutantes:

```bash
git fetch origin
git worktree add --detach /tmp/pr460-wt 73c26dd0d199af1377f0777b8823a6ae8618b512
cd /tmp/pr460-wt
pnpm install --frozen-lockfile
pnpm exec vitest run src/app/api/push/subscriptions/route.test.ts
pnpm typecheck
pnpm lint
pnpm test
# El E2E requiere credenciales/entorno Develop ya configurados por quien lo ejecute.
# NO correrlo con credenciales de producción ni desde esta revisión.
```

Para demostrar nuevas mutaciones funcionales, usar una copia temporal del fichero dentro de ese worktree, alterar **una propiedad por vez**, correr el test, exigir que falle, y restaurar desde la copia en memoria/disco local (no `git checkout`); confirmar GREEN tras restauración. Mutaciones propuestas (no ejecutadas):
- F1: desviar `endpoint` antes de `registerPushSubscriptionRpc` → la expectativa `toHaveBeenCalledWith` debe fallar.
- F2: devolver `{ok:true,userId:user.id}` en éxito → los asserts de JSON exacto deben fallar.
- F3: retornar `{ok:true}` ante `!result.ok` → tests de códigos HTTP deben fallar.

No registrar F1–F3 como RED verificados hasta ejecutarlos realmente.

## CI comprobado y política de E2E

- [CI SHA revisado, run 39465072183](https://github.com/cadeApp/cadeApp/actions/runs/39465072183): `unit` 152/152 archivos, **3000/3000 tests**; `typecheck`, `lint`, `build`, `audit` y `bundle-budget` verdes. `db-tests` en progreso durante la consulta.
- [migrate-develop run 39400955715](https://github.com/cadeApp/cadeApp/actions/runs/39400955715): **success** para commit de merge T-386 `fee28dbd`.
- [Bitácora E2E](https://github.com/cadeApp/cadeApp/blob/73c26dd0d199af1377f0777b8823a6ae8618b512/docs/tasks/log/T-383.md): autor declara `RED develop 1 failed (500)` y `GREEN Preview 8cda7e4c 2 passed`. Es evidencia **local del autor**, no validación del revisor.
- `approval-policy` sin informe antes de esta ronda; `e2e-preview` deliberadamente diferido al último push funcional. No exigir otra corrida por cambios solo en bitácora/informe.

**No se realizó `git merge-tree`** ni se corrió `pnpm test:db` local; GitHub indicó `mergeable=true`, behind 0, y esta PR no toca esquema ni archivos `src/server/`.
