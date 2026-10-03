# PR #233 — T-331 · El pipeline E2E descubre las specs por proyecto de Playwright

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/233 |
| **Tarea** | T-331 · Issue #232 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-331-e2e-spec-autodiscovery` → `develop` |
| **SHA funcional/documental revisado** | `12397b19d64f48b7e97ac44b82d92517e84a6ede` |
| **SHA restaurado tras sonda R2** | `f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6` |
| **Estado** | SIN BLOQUEANTES · LISTA PARA MERGE |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `7e1108626972bf4036924fc2a329142cc9ab49d9` | 1 bloqueante medio: PR233-H01 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6` | SIN BLOQUEANTES · H01 verificado | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR233-H01 | medio | arreglado-verificado | El guard ahora compara el descubrimiento efectivo de Playwright y detecta cualquier narrowing del proyecto. |

## Resultado final

- Rama **behind=0** respecto de `develop@3cec65f3a6390ba901ffc6a03aa9099307e7f97c`.
- La implementación de workflows se mantiene:
  - preview: `chromium` → `global-settings`;
  - staging: solo `chromium`;
  - `--workers=1`;
  - sin rutas de spec hardcodeadas.
- La reparación de H01 solo toca `.github/workflows/verify-workflows.test.mjs` y documentación T-331.
- El guard nuevo usa el `--list --reporter=json` real de Playwright y compara el conjunto efectivo, por archivo y proyecto, con una línea base sin filtros.
- No hardcodea los nombres de specs actuales.

### Sonda independiente R2

Mutación exacta exigida:

```ts
testMatch: /smoke\.spec\.ts$/,
```

agregada al proyecto `chromium`, sin tocar los tests.

Commit:

```text
8ba6199e8812e3c3af32c377bf27e763e3334ec2
```

CI `37107968761`:

```text
Vitest: 114 archivos / 1738 tests GREEN
verify-workflows:
  tests 49
  pass 48
  fail 1
```

Falló exactamente el guard nuevo y mostró que desaparecieron:

```text
chromium|main-flow.spec.ts
chromium|request-states.spec.ts
```

mientras `smoke.spec.ts` seguía presente.

Restauración normal:

```text
f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6
```

Comparación `12397b1...f09c7ad6`: **0 archivos de diferencia**.

### GREEN posterior

CI `37108153451`:

- typecheck ✅
- lint ✅
- build ✅
- bundle-budget ✅
- unit ✅ — **114 archivos / 1738 tests**
- verify-workflows ✅ — **49/49**
- DB ✅ — **17 archivos / 1807 tests**
- database.types.ts ✅ sin diff
- audit ❌ — advisory externo conocido de `braces`

Vercel del SHA `12397b1` llegó a READY; el redeploy posterior a la sonda/restauración fue limitado por cuota de builds. Como `12397b1` y `f09c7ad6adf8363425d5ccff84f8d9cb2aeeb5d6` tienen el mismo árbol de archivos, no es un defecto de T-331.

**PR #233 queda SIN BLOQUEANTES y lista para merge.**
