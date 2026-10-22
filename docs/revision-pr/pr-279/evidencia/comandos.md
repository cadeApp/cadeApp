# Evidencia y comandos reproducibles — PR #279

## Ronda 1 — SHA revisado `320938f01b3a71c278f7c51a995e74e1e2e94e37`

### Sincronización

Equivalente local:

```bash
git fetch origin
git rev-parse origin/develop
git rev-parse origin/feat/T-344-audit-vitest4
git merge-base origin/develop origin/feat/T-344-audit-vitest4
git diff --name-only origin/develop...origin/feat/T-344-audit-vitest4
```

Resultado remoto observado:

```text
develop: f3d00ed435bbbcaec448f7afc6ac356fb8494960
head:    320938f01b3a71c278f7c51a995e74e1e2e94e37
ahead_by: 2
behind_by: 0
merge_base: f3d00ed435bbbcaec448f7afc6ac356fb8494960
changed_files: 7
```

### Alcance de la ficha

```bash
git diff f3d00ed435bbbcaec448f7afc6ac356fb8494960...320938f01b3a71c278f7c51a995e74e1e2e94e37 -- docs/tasks/T-344.md
```

La ampliación está limitada a:

```text
src/server/rpc/offers.test.ts — aislamiento de spies, decisión 1-A
vitest.config.ts              — maxWorkers: 4, decisión 2-A
```

### RED del audit — base develop

CI run `37417103453`, job `audit`:

```text
pnpm audit --audit-level=high
7 vulnerabilities found
Severity: 3 moderate | 2 high (1 ignored) | 2 critical
```

### GREEN del audit — T-344

CI del primer commit `b52677b75d3587b13be21f178b724f07109e751f`, run `37417781433`, job `audit`:

```text
2 vulnerabilities found
Severity: 1 moderate | 1 high (1 ignored)
```

CI final `37419295817` repite el mismo resultado.

Comandos que exige la ficha:

```bash
pnpm audit --audit-level=high
pnpm why tinypool
pnpm why source-map-js
```

El lockfile final no contiene `tinypool@1.1.1` y resuelve `source-map-js@1.2.2`.

### RED del aislamiento de spies

CI del primer commit, run `37417781433`, job `unit`:

```text
FAIL src/server/rpc/offers.test.ts
AssertionError: expected "createAdminClient" to not be called at all, but actually been called 4 times
Test Files 1 failed | 120 passed (121)
Tests      1 failed | 1920 passed (1921)
```

### GREEN final

CI run `37419295817`, job `unit`:

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
Duration   65.14s
All files  83.2 | 78.51 | 78.48 | 83.73
```

DB job:

```text
T321_PRESERVE_EXISTING GREEN
Files=1, Tests=10
Result: PASS
Files=18, Tests=1811
Result: PASS
```

Lint:

```text
✔ No ESLint warnings or errors
```

E2E preview run `37419420307`: `e2e-preview` success.

### Fallo preexistente de build

Base `f3d00ed`, build run `37417103453`:

```text
An error occurred in next/font.
TypeError: Cannot read properties of null (reading '1')
... Montserrat ... src/app/layout.tsx
```

Primer commit de T-344: mismo fallo. HEAD final: build success sin cambios en fuentes/layout.

### Verificación externa de los parches

- GitHub Advisory Database, GHSA-68fv-2mgg-jv7q: `source-map-js <1.2.2` afectado; `1.2.2` parcheado.
- GitHub Advisory Database, GHSA-82fw-gwwq-j7x9: `vitest` / `@vitest/mocker <4.1.11` afectado; `4.1.11` parcheado.
- Vitest 4 docs: `maxWorkers` acepta un número y limita workers concurrentes.
- Vitest docs: `vi.restoreAllMocks()` restaura las implementaciones originales de spies creados con `vi.spyOn`.

### Limitación local de esta revisión

Intento de checkout:

```text
git clone https://github.com/cadeApp/cadeApp.git
fatal: unable to access ... Could not resolve host: github.com
```

Por eso no se afirma haber ejecutado `pnpm test` localmente desde esta sesión. La evidencia ejecutable independiente usada para cerrar la ronda son los jobs de CI del SHA revisado y los jobs históricos que reproducen los RED.
