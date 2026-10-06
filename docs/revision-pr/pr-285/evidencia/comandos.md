# Evidencia — PR #285

SHA funcional revisado: `6d9a4afb6ff247848da976c485ac6671aa9ccd09`.

## Sincronización y alcance

```text
develop = 228de182b6980526966a74446a2fc222cc8616ee
HEAD    = 6d9a4afb6ff247848da976c485ac6671aa9ccd09
ahead   = 2
behind  = 0
```

Diff funcional:

```text
docs/tasks/log/T-346.md
package.json
pnpm-lock.yaml
```

Historial previo de `docs/revision-pr/pr-285/**`: vacío.

## RED independiente

CI del commit `ff887ffb8aff7920c701d1e53521beba00a70454`.

Se comprobó primero que sus blobs de dependencias son exactamente los mismos que la base de #285:

```text
package.json     01e8a38966a4cb2435e162b35cec452e599f5d4e
pnpm-lock.yaml   47abcb1947febc031b6cf30d5d9b4f62f9d1f0e6
```

En ambos árboles.

Salida del job `audit`:

```text
sharp : Vulnerability in librsvg dependency
Package: sharp
Paths: .>next>sharp
GHSA-wq5f-xc86-pv6w
3 vulnerabilities found
Severity: 1 moderate | 2 high (1 ignored)
Process completed with exit code 1
```

## GREEN exact-head

CI run `37537462241`.

### Audit

```text
pnpm audit --audit-level=high
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
```

Job result: success.

### Unit / coverage

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
All files  83.2 stmts | 78.51 branch | 78.48 funcs | 83.73 lines
workflows: tests 57 / pass 57
ADR:       tests 6 / pass 6
```

### DB

```text
Files=1, Tests=10
Result: PASS

Files=18, Tests=1811
Result: PASS
```

El job también ejecutó el drift check de `src/types/database.types.ts`.

### Build

```text
Compiled successfully in 20.2s
```

### E2E Preview

Run `37537611725`:

```text
Running 37 tests using 1 worker
37 passed

Running 3 tests using 1 worker
3 passed
```

Total: **40/40 PASS**.

## Lockfile

Inspección del lockfile del HEAD:

```text
sharp@0.35.4 -> 0 ocurrencias
sharp@0.35.5 -> package entry + snapshot
next snapshot -> sharp: 0.35.5
```

El patch completo limita los demás cambios a `@img/sharp-*` y `@img/sharp-libvips-*`.

No hubo hallazgos que requirieran mutaciones independientes.
