# Evidencia reproducible — PR #429 / ronda 2

Árbol funcional revisado: `c07ee34feb75649e2e399676a77371c2c6054d9d`. Base: `59fb3daa82eb1c0394dca9bad143d7fd246ec34b`.

## Alcance y diff

```powershell
git fetch origin
git diff --stat origin/develop...c07ee34feb75649e2e399676a77371c2c6054d9d
git diff --check origin/develop...c07ee34feb75649e2e399676a77371c2c6054d9d
git diff --find-renames origin/develop...c07ee34feb75649e2e399676a77371c2c6054d9d
```

Resultado: dos archivos documentales, 62 inserciones; `diff --check` limpio. Desde la ronda 1: dos archivos, tres inserciones y una eliminación.

## Cierre mecánico de H01/H02

```powershell
pnpm vitest run tools/verify-fichas.test.ts
```

Resultado: 1 archivo PASS, 7/7 tests PASS, duración 2,05 s. Incluye la ruta `docs/revision-pr/**`, la existencia de la fila del plan y la igualdad del primer DoD.

Se extrajeron además ambas cadenas y se compararon con igualdad ordinal tras retirar únicamente el `CR` de fin de línea de la lectura cruda: `LITERAL_EQUAL=True`.

## Batería local

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

Resultados:

- typecheck: exit 0;
- lint: exit 0, sin warnings ni errores;
- test: exit 0; Vitest 148 archivos / 2890 tests PASS; workflow tests 79/79 PASS; ADR 6/6 PASS.

Los mensajes `Not implemented: navigation` y el error sintético de carga dinámica pertenecen a casos negativos esperados de jsdom; el proceso terminó con exit 0 y los contadores completos en verde.

`pnpm test:db` no aplica porque la PR no toca `supabase/` ni `src/server/`. No se accedió a Supabase remoto ni se ejecutaron comandos de Vercel.

## Estado remoto observado antes de publicar el informe

```powershell
gh pr checks 429
```

- PASS: typecheck, lint, unit, build, audit, bundle-budget, Vercel y comentarios de preview.
- PENDING: db-tests y e2e-preview.
- SKIPPED: Supabase Preview.
- FAIL esperado: approval-policy, todavía evaluando el informe anterior con bloqueantes.

No se aprobó ni mergeó la PR.
