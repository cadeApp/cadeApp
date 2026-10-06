# Comandos reproducibles — PR #273

Los comandos siguientes reproducen los hallazgos de proceso desde un checkout con `origin/develop` actualizado.

## PR273-A01 · alcance calculado desde el base

```bash
git fetch origin
git diff --name-only origin/develop...origin/feat/T-342-courier-feed-privacy

git show origin/develop:docs/tasks/T-342.md | grep -F "e2e/pages/courier.page.ts" || echo "NO AUTORIZADO EN DEVELOP"
git show origin/develop:docs/tasks/T-342.md | grep -F "e2e/specs/main-flow.spec.ts" || echo "NO AUTORIZADO EN DEVELOP"
```

- **En `502e46952640aa526ed441333d513ca68f6085da`:** ambos archivos aparecen en el diff y ninguno aparece en la ficha de `origin/develop`.
- **Arreglo esperado:** después de mergear la ampliación documental y rebasar, ambos grep deben encontrarlos en el base.

## PR273-H02 · contrato del body

```bash
node .github/workflows/approval-policy.mjs
```

En CI, `approval-policy` evalúa la sección `### Informe de revisión de agy` y exige los marcadores definidos por `hasCompleteReport()`. El body actual no los contiene.

## Batería observada en CI sobre el HEAD revisado

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- Vercel ✅
- e2e-preview ✅
- audit ❌ — advisories de dependencias no modificadas por T-342

La revisión independiente no ejecutó una batería local en esta sesión; usó los resultados de CI y la inspección remota del diff.
