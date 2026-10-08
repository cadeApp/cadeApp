# Evidencia reproducible — PR #300, ronda 1

## Fuente y diff

```text
GET /repos/cadeApp/cadeApp/pulls/300
HEAD: 783640ab7db0550cd6efe9a9ece0d54734644136
develop: cd023e3453ead76983d54982df1548cb97aa57eb
compare develop...HEAD: ahead 4, behind 0, mergeable true
changed files:
  docs/implementation-plan.md
  docs/tasks/T-349.md
  docs/tasks/log/T-349.md
```

## Contraste del helper vigente en develop

```text
src/server/rpc/cc007.test.ts:104-171
  beforeAll git worktree add --detach
  executeMutation:
    filePath = path.join(mutationWorktree, relativeFilePath)
    fs.writeFileSync(filePath, mutated)
    spawnSync('pnpm', testArgs, { cwd: mutationWorktree })
    finally fs.writeFileSync(filePath, original)
```

Targets A-D observados: guards.ts; queries.ts; actions.ts; 20260925170000_cc007_consent_enforcement.sql.

Referencia de arreglo previo: `docs/revision-pr/pr-275/revisiones/ronda-4.md`.

## CI exact-head

```text
CI run 37693862892: success
build 20.4s: Compiled successfully
unit: 123 test files / 1941 tests PASS
verify-fichas: 7/7 PASS
verify-workflows: 75/75 PASS
ADR: 6/6 PASS
db-tests: Files=19, Tests=1854, Result=PASS
db types: generated, no diff
lint, typecheck, audit, bundle-budget: success
Vercel commit status: success
```

Audit: 2 vulnerabilidades (1 moderada, 1 alta ignorada). Bundle advisory con admin/login >180 kB, fuera de alcance y preexistente.

## Gate E2E

```text
HEAD status original: e2e-preview = error
run: 37694034304
attempt 1: e2e-preview job 113041139068 cancelled
resolve-preview: success, PR interna #300 contra develop, Preview listo
report-preview-status: success; publicó estado error tras cancelled
```

La revisión invocó `rerun_workflow_job(113041139068)`, respuesta `success: true`. El attempt 2 quedó pendiente en la última comprobación de esta sesión. `success` del endpoint de rerun no equivale a GREEN del test.

`approval-policy` run 37693858024: fallo `Falta el informe completo de revisar-pr sin bloqueantes.` Debe pasar al cargar el informe y volver a dispararse.

## Decisiones de Lautaro073

```text
1-A: confirma ficha chica, solo control de regresión de aislamiento del worktree
2-A: confirma renumeración T-348 → T-349 para no colisionar con #301/#302
```

## Limitación

No se ejecutó `pnpm test` en un checkout local por parte de esta revisión. La evidencia de ejecución citada es CI sobre el SHA funcional exacto; esta PR aún no implementa el control nuevo ni su RED.

Resultado: SIN BLOQUEANTES técnicos; gate E2E pendiente hasta GREEN.
