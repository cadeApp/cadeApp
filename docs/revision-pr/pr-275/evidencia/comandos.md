# Evidencia y comandos reproducibles — PR #275

## Ronda 4 — SHA `44f61124f5fa5e2c1a5b62b58f772cb283e84254`

### Alcance desde ronda 3

```bash
git diff --name-only 76bd49aa5bb3d84d11e97736e1bf70e3a7dbeea4..44f61124f5fa5e2c1a5b62b58f772cb283e84254
```

Resultado:

```text
docs/tasks/log/T-343.md
src/server/rpc/cc007.test.ts
tools/verify-scaffold.test.ts
```

### H04-A — propiedad inspeccionada

`executeMutation()` resuelve el archivo con:

```ts
const filePath = path.join(mutationWorktree, relativeFilePath);
```

y el Vitest hijo usa:

```ts
cwd: mutationWorktree
```

No hay escritura de archivos mutantes en `repoRoot`.

Evidencia del autor, registrada en bitácora:

```text
cc007.test.ts + guards.test.ts → 100 passed
git diff --exit-code sobre guards/queries/actions/migración → exit 0
pnpm test #1 → exit 0 · Test Files 121 passed (121) · Tests 1921 passed (1921)
pnpm test #2 → exit 0 · Test Files 121 passed (121) · Tests 1921 passed (1921)
```

### H04-B — propiedad inspeccionada

`verify-scaffold.test.ts` tiene una sola llamada a `eslint.lintFiles` en `beforeAll` y cada caso consulta `resultFor(FILES.x)`. Las assertions de reglas y cantidad de mensajes permanecen.

### CI independiente del mismo SHA

CI run `37413116003`, job `unit`:

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
Duration   64.15s
```

DB job:

```text
Files=18, Tests=1811
Result: PASS
```

E2E run `37413211750`:

```text
courier-feed-vocabulary.spec.ts ... PASS
33 passed
3 passed
```

Approval-policy run `37414360623`:

```text
Informe de revisar-pr completo y sin bloqueantes.
```

### Audit

El job `audit` queda rojo por advisories de dependencias:

- `tinypool` vía `vitest`;
- `source-map-js` vía `@vitest/coverage-v8`.

El propio workflow lo reporta como “Auditoria de dependencias (no bloquea hasta contracts-v1)”. T-343 no modifica `package.json` ni `pnpm-lock.yaml`.
