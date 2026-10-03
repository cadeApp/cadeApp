# Informe de revisión — PR #233 / T-331 — Ronda 2

**SHA solicitado:** `12397b19d64f48b7e97ac44b82d92517e84a6ede`  
**SHA restaurado final:** `f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6`  
**Base:** `develop@3cec65f3a6390ba901ffc6a03aa9099307e7f97c`  
**Fecha:** 2026-10-03

## Resultado

**SIN BLOQUEANTES.**

PR233-H01 queda **arreglado-verificado**.

## Reparación revisada

Desde el commit de revisión de Ronda 1 `b062dcb1`, agy modificó únicamente:

```text
.github/workflows/verify-workflows.test.mjs
docs/tasks/T-331.md
docs/tasks/log/T-331.md
```

No tocó:

```text
playwright.config.ts
e2e/specs/**
.github/workflows/e2e-preview.yml
.github/workflows/e2e-staging.yml
docs/revision-pr/**
```

La reparación agrega un control de comportamiento efectivo:

1. crea una config temporal que importa `playwright.config.ts`;
2. elimina filtros de discovery (`testMatch`, `testIgnore`, `grep`, `grepInvert`, projects);
3. ejecuta `playwright test --list --reporter=json` para obtener la línea base;
4. enumera recursivamente los specs de `e2e/specs`;
5. comprueba que la línea base tiene tests en cada archivo;
6. construye el conjunto esperado:
   - `chromium`: todo salvo `*.global-settings.spec.ts`;
   - `global-settings`: exactamente `*.global-settings.spec.ts`;
7. compara ese conjunto con el `--list` real de la configuración vigente.

No depende de los nombres actuales `smoke`, `main-flow`, etc.

## Verificación independiente de PR233-H01

La revisión repitió exactamente la sonda pedida en Ronda 1:

```ts
{
  name: 'chromium',
  testIgnore: /global-settings\.spec\.ts$/,
  testMatch: /smoke\.spec\.ts$/,
}
```

Commit temporal:

```text
8ba6199e8812e3c3af32c377bf27e763e3334ec2
```

Los tests T-331 quedaron intactos.

### RED real

CI run `37107968761`:

```text
Vitest:
  Test Files 114 passed
  Tests 1738 passed

verify-workflows:
  tests 49
  pass 48
  fail 1
```

Falló:

```text
the chromium and global-settings projects effectively discover every spec of e2e/specs, with no narrowing
```

La diferencia reportada fue exactamente la regresión inducida:

```text
- chromium|main-flow.spec.ts
- chromium|request-states.spec.ts
  chromium|smoke.spec.ts
  global-settings|subscription.global-settings.spec.ts
```

El control ahora detecta que `chromium` dejó de descubrir todos los specs.

## Restauración

La mutación se revirtió con commit normal:

```text
f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6
```

Comparación:

```text
12397b19d64f48b7e97ac44b82d92517e84a6ede
...
f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6

files: []
```

No quedó ninguna modificación de la sonda.

## GREEN posterior

CI run `37108153451` sobre el SHA restaurado:

```text
typecheck       success
lint            success
build           success
bundle-budget   success
unit            success
db-tests        success
audit           failure — advisory externo
```

Unit:

```text
Test Files 114 passed (114)
Tests 1738 passed (1738)

verify-workflows:
tests 49
pass 49
fail 0

ADR:
tests 6
pass 6
fail 0
```

DB:

```text
Files=17, Tests=1807
Result: PASS
database.types.ts sin diff
```

Audit:

```text
braces
GHSA-vfj7-8cjw-p6xm
Severity: 2 moderate | 1 high
```

Es el advisory externo ya conocido; T-331 no cambia dependencias.

## Workflows / seguridad

Se mantiene lo verificado en Ronda 1:

- preview corre `chromium` y luego `global-settings`;
- staging corre solo `chromium`;
- global-settings no toca staging compartido;
- `--workers=1`;
- secrets privilegiados solo en el step Playwright correspondiente;
- resolución del SHA interno y gate de migraciones sin cambios;
- concurrencia sin cambios.

La modificación de `repository_dispatch` no puede autoejecutar la versión PR del workflow antes de merge porque GitHub usa el workflow de la rama por defecto. Por eso la validación pre-merge de T-331 descansa deliberadamente en el guard de workflows; ese guard ahora tiene sensibilidad RED demostrada sobre el comportamiento efectivo de Playwright.

## Vercel

El SHA solicitado `12397b1` tuvo Vercel READY.

El SHA restaurado posterior a la sonda recibió el límite externo de builds de la cuenta. Dado que `12397b1...f09c7ad` tiene **0 archivos de diferencia**, no se considera fallo del PR.

## Conclusión

**PR233-H01 → arreglado-verificado.**

**PR #233 queda SIN BLOQUEANTES y lista para merge.**

La revisión no mergea sin pedido explícito.
