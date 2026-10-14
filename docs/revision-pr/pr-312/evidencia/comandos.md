# Evidencia real y reproducción — PR #312

## RED y GREEN observados (GitHub Actions)

```sh
# RED del SHA sin parche (PR #310)
gh api repos/cadeApp/cadeApp/actions/jobs/113556847199/logs
# GREEN del SHA con parche (PR #312)
gh api repos/cadeApp/cadeApp/actions/jobs/113559274651/logs
gh api repos/cadeApp/cadeApp/commits/52eb1c508496471fa910aac87cdc5f2d942be415/check-runs
```

RED: `pnpm audit --audit-level=high` exit 1 por 2 críticas (`GHSA-8r5x-fm3f-whwj`, `GHSA-p8wg-vrv2-v86f`). GREEN en GitHub: `audit success`, y log `4 vulnerabilities found; Severity: 3 moderate | 1 high (1 ignored)` — **no se cambió el ignore preexistente**.

## Diff exacto comprobable

```diff
# package.json
-      "handlebars": "4.7.9",
+      "handlebars": "4.7.10",
# pnpm-lock.yaml
-  handlebars: 4.7.9
+  handlebars: 4.7.10
-  handlebars@4.7.9:
+  handlebars@4.7.10:
-      handlebars: 4.7.9
+      handlebars: 4.7.10
-  handlebars@4.7.9:
+  handlebars@4.7.10:
```

La entrada SRI cambió de
`sha512-4E71E0rpOaQuJR2A3xDZ+GM1HyWYv1clR58tC8emQNeQe3RH7MAzSbat+V0wG78LQBo6m6bzSG/L4pBuCsgnUQ==`
a
`sha512-P5VJMVM7qgBn6vjXMw8WG9uVI+ncf2pi72j4de4yz5ZULLj2RGqLYaKOYGsgyrViQ0tePOVlN1tDCCXXtFqXKg==`.

Dos referencias externas consistentes:
- https://github.com/team-mirai/marumie/blob/830f7b57e452da50d5779b423e257f286e51178a/pnpm-lock.yaml
- https://github.com/shaftoe/pi-coding-agent-action/blob/0d8b7fff1277e25242a9a145cf59bc912a6bcb3e/pnpm-lock.yaml

Release: https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.10.

## Aserciones de comparación estática (receta para ejecutar en un clon)

```sh
git show d2ad331:package.json | grep -F '"handlebars": "4.7.9"'
git show 52eb1c5:package.json | grep -F '"handlebars": "4.7.10"'
git show 52eb1c5:pnpm-lock.yaml | grep -F 'handlebars: 4.7.10'
git show 52eb1c5:pnpm-lock.yaml | grep -F 'handlebars@4.7.10:'
git show 52eb1c5:pnpm-lock.yaml | grep -F 'sha512-P5VJMVM7qgBn6vjXMw8WG9uVI+ncf2pi72j4de4yz5ZULLj2RGqLYaKOYGsgyrViQ0tePOVlN1tDCCXXtFqXKg=='
git diff d2ad331..52eb1c5 --stat
```

Estos comandos de texto no sustituyen la comprobación dinámica con pnpm; esa fue aportada por CI. No se ejecutaron manualmente en un clon por este revisor.

## Último cierre requerido (verificar nuevo HEAD del informe, no el SHA anterior)

```sh
pnpm install --frozen-lockfile
pnpm audit --audit-level=high
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

El runner instala antes de cada job. `db-tests` y `e2e-preview` se verifican en GitHub, no mediante una corrida local. **No modificar umbrales, mocks, expectations ni la seguridad para conseguir GREEN**.
