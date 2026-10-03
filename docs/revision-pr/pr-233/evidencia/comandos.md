# Evidencia — PR #233 / Ronda 1

## Base y HEAD

```text
develop: 3cec65f3a6390ba901ffc6a03aa9099307e7f97c
author head: 4db1ddca9a303c4dc2d1fdab0c2bc71d9654cfba
restored review head: 7e1108626972bf4036924fc2a329142cc9ab49d9
behind: 0
```

## CI del autor

Run: `37106123022`

```text
unit success
  Test Files 114 passed
  Tests 1738 passed
  verify-workflows 48/48
  ADR 6/6

db-tests success
  Files=17, Tests=1807
  Result: PASS
  database.types.ts generated without committed diff

typecheck success
lint success
build success
bundle-budget success

audit failure:
  braces
  GHSA-vfj7-8cjw-p6xm
  Severity: 2 moderate | 1 high
```

## Mutación H01

Commit:

```text
72888b06d8ed40e8a4a845b85e6ff39a3b19c629
```

Cambio único:

```diff
 {
   name: 'chromium',
   testIgnore: /global-settings\.spec\.ts$/,
+  testMatch: /smoke\.spec\.ts$/,
 }
```

Tests de T-331 intactos.

Run:

```text
37106701096
```

Resultado relevante:

```text
unit success
verify-workflows:
# tests 48
# pass 48
# fail 0
```

La mutación reduce el proyecto `chromium` a un solo spec pero el guard permanece GREEN.

## Restauración

```text
7e1108626972bf4036924fc2a329142cc9ab49d9
```

Comparación:

```text
4db1ddca9a303c4dc2d1fdab0c2bc71d9654cfba
...
7e1108626972bf4036924fc2a329142cc9ab49d9

files: []
```

La sonda no dejó cambios funcionales.
