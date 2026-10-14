# Evidencia reproducible — PR #234

## Ronda 6 — integración final

- develop integrado: `f74c66bc1f18b1962e31c83a433ef995201765f3`
- SHA revisado: `5e341375459b1a0ab84db57ac2bbd99ab8593fc4`
- merge commit: `5e341375459b1a0ab84db57ac2bbd99ab8593fc4`
- estado de la PR tras integración: mergeable, 0 behind
- diff contra develop: solo T-332 + `docs/revision-pr/pr-234/**`

## CI

Run: **#1055 / 37149225848** — conclusion `success`.

```
typecheck       success
lint            success
unit            success
db-tests        success
build           success
bundle-budget   success
audit           success
```

### Unit

```
verify-fichas.test.ts: 7 tests passed
Test Files: 116 passed (116)
Tests: 1753 passed (1753)
verify-workflows: 49 tests
verify-adr: 6 tests
```

### Audit

```
pnpm audit --audit-level=high
3 vulnerabilities found
Severity: 2 moderate | 1 high (1 ignored)
```

## Mutaciones de H01

R5 dejó demostradas RED las diez mutaciones de trigger/contexto/job/step/script. La integración de R6 no modificó `tools/verify-audit-exceptions.test.ts` ni `.github/workflows/ci.yml`; no se repite una batería cuyo código no cambió. CI confirma el guard y el audit en el árbol integrado.
