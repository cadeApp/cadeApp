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

---

# Evidencia — PR #233 / Ronda 2

## Reparación H01

```text
repair commit: aa47e0b2812e929f3900d42ed3909b6c45e0915d
requested head: 12397b19d64f48b7e97ac44b82d92517e84a6ede
```

CI reparación `37107580778`:

```text
unit: 114 files / 1738 tests PASS
verify-workflows: 49/49 PASS
db-tests: 17 files / 1807 tests PASS
typecheck/lint/build/bundle: PASS
audit: braces advisory externo
```

## Sonda independiente exacta

Mutación:

```text
commit 8ba6199e8812e3c3af32c377bf27e763e3334ec2
playwright.config.ts:
+ testMatch: /smoke\.spec\.ts$/,
```

No se modificó `verify-workflows.test.mjs`.

Run:

```text
37107968761
```

Resultado:

```text
Vitest: 114/114 files, 1738/1738 tests PASS

verify-workflows:
49 tests
48 pass
1 fail
```

Test fallido:

```text
the chromium and global-settings projects effectively discover every spec of e2e/specs, with no narrowing
```

Diferencia detectada:

```text
missing chromium|main-flow.spec.ts
missing chromium|request-states.spec.ts
present chromium|smoke.spec.ts
present global-settings|subscription.global-settings.spec.ts
```

## Restauración y GREEN

Revert normal:

```text
f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6
```

Comparación contra el HEAD pedido:

```text
12397b19...f09c7ad
files: []
```

CI posterior:

```text
run 37108153451
typecheck success
lint success
build success
bundle-budget success
unit success — 1738/1738
verify-workflows success — 49/49
db-tests success — 1807/1807
database.types.ts sin diff
audit failure — braces externo
```
