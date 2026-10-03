# PR #233 — T-331 · El pipeline E2E descubre las specs por proyecto de Playwright

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/233 |
| **Tarea** | T-331 · Issue #232 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-331-e2e-spec-autodiscovery` → `develop` |
| **SHA restaurado revisado** | `7e1108626972bf4036924fc2a329142cc9ab49d9` |
| **SHA autor previo a sonda** | `4db1ddca9a303c4dc2d1fdab0c2bc71d9654cfba` |
| **Estado** | Draft · CON 1 BLOQUEANTE |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `7e1108626972bf4036924fc2a329142cc9ab49d9` | 1 bloqueante medio: PR233-H01 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR233-H01 | medio | abierto · bloqueante | El guard no detecta que `chromium` se reduzca a un subconjunto mediante `testMatch`. |

## Lo que sí quedó verificado

- T-331 autoriza explícitamente los 8 archivos modificados, incluidos `.github/**` y `e2e/AGENTS.md`.
- Rama: **behind=0**, mergeable.
- La implementación actual reemplaza correctamente las listas hardcodeadas:
  - preview: proyecto `chromium` y luego `global-settings`;
  - staging: solo `chromium`;
  - ambos con `--workers=1`;
  - `global-settings` usa `--pass-with-no-tests`.
- `playwright.config.ts` actual separa:
  - `chromium`: ignora `*.global-settings.spec.ts`;
  - `global-settings`: solo `*.global-settings.spec.ts`, `fullyParallel: false`.
- No cambian secrets, environments, concurrencia ni gate de migraciones.
- CI del HEAD autor `4db1ddca`, run `37106123022`:
  - typecheck ✅
  - lint ✅
  - unit ✅ — 114 archivos / 1738 tests
  - `verify-workflows` ✅ — 48/48
  - build ✅
  - DB ✅ — 17 archivos / 1807 tests
  - bundle-budget ✅
  - audit ❌ — advisory externo conocido de `braces`.

## Sonda de revisión

Mutación temporal:

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

Esto rompe el objetivo central de T-331: `chromium` deja de descubrir todos los specs y queda limitado a `smoke.spec.ts`.

Sin modificar los tests, CI run `37106701096` reportó:

```text
unit: success
verify-workflows:
  tests 48
  pass 48
  fail 0
```

La sonda fue restaurada con commit normal:

```text
7e1108626972bf4036924fc2a329142cc9ab49d9
```

Comparación `4db1ddca...7e110862`: **0 archivos de diferencia**.

**No mergear hasta resolver PR233-H01.**
