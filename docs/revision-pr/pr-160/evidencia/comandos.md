# Evidencia y comandos — PR #160

## Ronda 5

**SHA revisado:** `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c`

### Criterio de merge vs cierre

P1 aclaró que una tarea E2E no queda terminada al entrar a `develop`.

Gate de cierre:
`develop → staging → deploy/migraciones → E2E real → Hecha`.

La corrida staging de `main-flow.spec.ts` es por lo tanto post-merge y no un bloqueante previo a `develop`.

### Sincronización

Al comienzo del trabajo del autor la rama llegó a estar sincronizada con:
`develop=1457072a7cac1ae9e2a8a92abe9253d45b745082`.

Durante Ronda 5 develop avanzó a:
`01f8fb20587beb5b43b606103051deb49e1c01d1`.

Comparación actual:
- ahead: 24
- behind: **9**
- merge-base: `1457072a7cac1ae9e2a8a92abe9253d45b745082`

Cambios nuevos relevantes de develop:
- `docs/contracts/CC-014.md`
- `src/ui/map.tsx`
- `src/ui/map.test.tsx`

El mapa participa del formulario de publicación cubierto por T-303, por lo que se exige resincronización antes de aprobar.

### Carpeta de revisión

Comparación `92f3eb2...d8c3ae3`:
- ningún archivo bajo `docs/revision-pr/pr-160/**` fue modificado por el autor.

### CI exacto del SHA revisado

Workflow: **CI #788**  
Run: **36956593490**  
SHA: `d8c3ae3eb8252ca111e869c9f1dba4a5fb313e4c`  
Conclusión: **success**

#### unit

Resumen de Vitest:

```text
Test Files  110 passed (110)
Tests       1602 passed (1602)
```

Además:
- tests de workflows: 31;
- tests ADR: 6;
- `src/server/supabase/clients.test.ts`: 10 tests verdes.

#### db-tests

Primera verificación T-321:
```text
Files=1, Tests=10
Result: PASS
```

Suite completa:
```text
All tests successful.
Files=13, Tests=1614
Result: PASS
```

El job continuó con:
```text
node tools/db-types.mjs --local
git diff --exit-code -- src/types/database.types.ts
```

y concluyó success.

#### Otros jobs

- typecheck: success
- lint: success
- build: success
- bundle-budget: success
- audit: success

### H10

Código actual:
- concurrencia usa `context.newPage()` sobre la fixture `context`;
- Flow 5 toma `testInfo.project.use.baseURL`;
- falla cerrado si no es string/no existe;
- `browser.newContext({ baseURL })`.

### H11

Código actual:
- `formatPhone(sentinelPhone)`;
- compara sentinel literal/crudo/formateado;
- normaliza cada línea visible;
- normaliza cada `href` por separado.

### Gate staging post-merge

`.github/workflows/e2e-staging.yml` actual ejecuta solo:

```bash
pnpm exec playwright test e2e/specs/smoke.spec.ts --project=chromium
```

Ese smoke no valida T-303.

Después de la promoción de T-303 a staging debe ejecutarse explícitamente:

```bash
pnpm exec playwright test e2e/specs/main-flow.spec.ts --project=chromium
```

contra el staging desplegado. Hasta entonces el primer DoD y el estado Hecha permanecen abiertos.
