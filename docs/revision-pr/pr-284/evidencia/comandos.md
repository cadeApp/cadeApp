# Evidencia — PR #284

SHA funcional revisado: `da5f00f472663a931043e504a5f47a31ff754092`.

## Alcance

Diff funcional:

```text
docs/implementation-plan.md
docs/tasks/T-346.md
docs/tasks/log/T-346.md
```

Base y target al revisar:

```text
develop = 5c7febf6c2a4cba97d29148cc797e373103bd838
HEAD    = da5f00f472663a931043e504a5f47a31ff754092
```

La base del PR coincide con el `develop` actual.

## Advisory reproducido por CI

Comando del job `audit`:

```bash
pnpm audit --audit-level=high
```

Salida relevante:

```text
high  sharp : Vulnerability in librsvg dependency
Package  sharp
Paths    .>next>sharp
More info https://github.com/advisories/GHSA-wq5f-xc86-pv6w
3 vulnerabilities found
Severity: 1 moderate | 2 high (1 ignored)
Process completed with exit code 1
```

## Árbol actual de dependencias

El lockfile de `develop` contiene:

```text
next@15.5.26
  optionalDependencies:
    sharp: 0.35.4

sharp@0.35.4
  optionalDependencies:
    @img/sharp-libvips-linux-x64: 1.3.3
    ...
```

La implementación de T-346 debe verificar después del cambio:

```bash
pnpm audit --audit-level=high
pnpm why sharp
```

Resultado exigido por la ficha: audit exit 0 y solo `sharp@0.35.5` en el árbol.

## Rango declarado por Next.js

Verificación de los `package.json` upstream:

```text
next v15.5.26 -> optionalDependencies.sharp = "^0.34.3 || ^0.35.4"
next v15.5.27 -> optionalDependencies.sharp = "^0.34.3 || ^0.35.4"
```

`0.35.5` satisface ese rango.

## CI exact-head

```text
typecheck      success
lint           success
unit           success — Test Files 121 passed (121), Tests 1921 passed (1921)
verify-fichas  success — 7 tests
build          success
bundle-budget  success
db-tests       success — Files=1 Tests=10 PASS; Files=18 Tests=1811 PASS
Vercel         success
e2e-preview    success
audit          failure — GHSA-wq5f-xc86-pv6w, esperado por T-346
```

No hubo hallazgos que requieran batería de mutaciones en esta ronda.
