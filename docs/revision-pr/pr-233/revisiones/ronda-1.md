# Informe de revisión — PR #233 / T-331 — Ronda 1

**SHA restaurado revisado:** `7e1108626972bf4036924fc2a329142cc9ab49d9`  
**SHA autor:** `4db1ddca9a303c4dc2d1fdab0c2bc71d9654cfba`  
**Base:** `develop@3cec65f3a6390ba901ffc6a03aa9099307e7f97c`  
**Fecha:** 2026-10-03

## Resultado

**CON 1 BLOQUEANTE: PR233-H01 (medio).**

La implementación de los workflows es correcta en el estado actual. El hallazgo está en la cobertura de regresión que debe garantizar el objetivo de T-331.

## Alcance

Los 8 archivos de la PR están autorizados por la ficha:

```text
.github/workflows/e2e-preview.yml
.github/workflows/e2e-staging.yml
.github/workflows/verify-workflows.test.mjs
docs/implementation-plan.md
docs/runbooks/e2e-preview.md
docs/tasks/T-331.md
docs/tasks/log/T-331.md
e2e/AGENTS.md
```

La excepción a la regla raíz de no tocar `.github/**` está explícita en T-331.

## Implementación actual

Preview:

```bash
pnpm exec playwright test --project=chromium --workers=1
pnpm exec playwright test --project=global-settings --workers=1 --pass-with-no-tests
```

Staging:

```bash
pnpm exec playwright test --project=chromium --workers=1
```

Config actual:

```ts
{
  name: 'chromium',
  testIgnore: /global-settings\.spec\.ts$/,
}
{
  name: 'global-settings',
  testMatch: /global-settings\.spec\.ts$/,
  fullyParallel: false,
}
```

Esto cumple la intención de T-331 en el HEAD actual.

## Seguridad / confianza

No se detectó cambio lateral en:

- resolución del SHA interno;
- environment `develop`;
- secrets del step Playwright;
- environment `staging`;
- `concurrency`;
- gate de migraciones;
- `--workers=1`.

La PR amplía el descubrimiento según una decisión explícita de T-331, no modifica el mecanismo que decide qué SHA interno puede ejecutar el gate.

## PR233-H01 · MEDIO · BLOQUEANTE
### El test no garantiza “todos los specs de chromium”

El helper nuevo afirma:

> chromium takes every spec except `*.global-settings.spec.ts`

pero sus aserciones solo comprueban:

1. `testDir: './e2e/specs'`;
2. presencia de `testIgnore: /global-settings.../`;
3. comando exacto `--project=chromium --workers=1`.

Eso no impide un filtro adicional que reduzca el conjunto.

### Mutación demostrativa

Se agregó temporalmente, sin tocar tests:

```ts
{
  name: 'chromium',
  testIgnore: /global-settings\.spec\.ts$/,
  testMatch: /smoke\.spec\.ts$/,
}
```

Commit:

```text
72888b06d8ed40e8a4a845b85e6ff39a3b19c629
```

El comportamiento efectivo queda reducido a `smoke.spec.ts`, contradiciendo directamente el DoD:

> todo `e2e/specs/*.spec.ts` salvo `*.global-settings.spec.ts`

Sin embargo CI `37106701096` dio:

```text
unit: success
verify-workflows:
  # tests 48
  # pass 48
  # fail 0
```

Por lo tanto el control no cubre lo que declara.

### Restauración

Revert normal:

```text
7e1108626972bf4036924fc2a329142cc9ab49d9
```

`4db1ddca...7e110862`:

```text
files: []
```

La rama quedó restaurada exactamente al contenido funcional previo a la sonda.

### Corrección esperada

Reforzar `.github/workflows/verify-workflows.test.mjs` para validar el conjunto efectivo de descubrimiento.

La solución más robusta es comparar la salida de Playwright `--list` por proyecto contra los `*.spec.ts` presentes bajo `e2e/specs/`:

- `chromium` debe incluir todos salvo `*.global-settings.spec.ts`;
- `global-settings` debe incluir exactamente los `*.global-settings.spec.ts`.

No es obligatorio usar esa implementación concreta si se consigue una garantía equivalente.

Como mínimo, el control debe detectar filtros que puedan estrechar el conjunto (`testMatch`, `grep`, `grepInvert` o equivalentes), tanto a nivel global como del proyecto.

### RED obligatorio de reparación

Repetir **exactamente** la mutación:

```ts
testMatch: /smoke\.spec\.ts$/,
```

en `chromium`, con los tests de T-331 intactos.

Esperado:

```text
verify-workflows RED
```

Luego revert normal y GREEN.

## CI del HEAD autor

Run `37106123022`:

```text
typecheck      success
lint           success
unit           success — 114 / 1738
verify         success — 48/48
build          success
db-tests       success — 17 / 1807
bundle-budget  success
audit          failure — braces advisory externo
```

## Conclusión

**NO MERGEAR PR #233 todavía.**

No encontré un segundo defecto funcional en el cambio actual. El único bloqueo es que la protección automática de autodiscovery todavía puede quedar verde ante una regresión que reduce `chromium` a un subconjunto.
