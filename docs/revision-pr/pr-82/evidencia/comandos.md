# Evidencia y comandos reproducibles — PR #82 (Ronda 1)

- **SHA verificado:** `a2ab69a01eaec4b6b6a918e7298023cfa03ea373`
- **Rama:** `feat/T-204-realtime-tanstack`
- **Base (`origin/develop`):** `9ab71cb`

---

## 1. Verificación de alcance y diff contra `origin/develop`

### Comando
```bash
git log --oneline origin/develop..origin/feat/T-204-realtime-tanstack
git diff origin/develop...origin/feat/T-204-realtime-tanstack --stat
```

### Salida
```text
a2ab69a docs(T-204): update session log with PR #82 reference [T-204]
75c50da chore(T-204): start task [T-204]
 docs/tasks/T-204.md                                |   8 +-
 docs/tasks/log/T-204.md                            |  13 ++
 .../offers/hooks/use-available-requests.test.tsx   | 122 +++++++++++++++++
 .../requests/hooks/use-request-offers.test.tsx     | 150 +++++++++++++++++++++
 src/features/trips/hooks/use-trip.test.tsx         |  95 +++++++++++++
 src/lib/hooks/use-realtime-invalidation.test.tsx   | 135 +++++++++++++++++++
 6 files changed, 517 insertions(+), 6 deletions(-)
```

---

## 2. Ejecución de `pnpm typecheck` (`PR82-H02`)

### Comando
```bash
pnpm typecheck
```

### Salida (código de salida `2`)
```text
> cadeapp@0.1.0 typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json

src/features/offers/hooks/use-available-requests.test.tsx(5,38): error TS2307: Cannot find module './use-available-requests' or its corresponding type declarations.
src/features/offers/hooks/use-available-requests.test.tsx(109,42): error TS7006: Parameter 'r' implicitly has an 'any' type.
src/features/requests/hooks/use-request-offers.test.tsx(96,11): error TS2353: Object literal may only specify known properties, and 'fetcher' does not exist in type 'UseRequestOffersOptions'.
src/features/trips/hooks/use-trip.test.tsx(5,25): error TS2307: Cannot find module './use-trip' or its corresponding type declarations.
src/lib/hooks/use-realtime-invalidation.test.tsx(5,41): error TS2307: Cannot find module './use-realtime-invalidation' or its corresponding type declarations.
ELIFECYCLE Command failed with exit code 2.
```

---

## 3. Ejecución de `pnpm lint`

### Comando
```bash
pnpm lint
```

### Salida (código de salida `0`)
```text
✔ No ESLint warnings or errors
```

---

## 4. Ejecución de las suites de `T-204` y demostración en vivo de `PR82-H04` (`AG-76`)

### Comando
```bash
pnpm vitest run src/lib/hooks/use-realtime-invalidation.test.tsx src/features/requests/hooks/use-request-offers.test.tsx src/features/offers/hooks/use-available-requests.test.tsx src/features/trips/hooks/use-trip.test.tsx
```

### Salida resumida
- `src/lib/hooks/use-realtime-invalidation.test.tsx`: **FAIL** (`Failed to resolve import "./use-realtime-invalidation"`)
- `src/features/offers/hooks/use-available-requests.test.tsx`: **FAIL** (`Failed to resolve import "./use-available-requests"`)
- `src/features/trips/hooks/use-trip.test.tsx`: **FAIL** (`Failed to resolve import "./use-trip"`)
- `src/features/requests/hooks/use-request-offers.test.tsx`: **1 failed | 2 passed (3)**:
  - `× DoD: Con el push apagado, la oferta nueva aparece al volver a la app (refetchOnWindowFocus)` → `AssertionError: expected [ { id: 'offer-initial-1', …(11) } ] to have a length of 2 but got 1`
  - `✓ DoD: al desmontar la pantalla se cierra el canal`
  - `✓ DoD: Realtime no escribe la caché a mano, solo invalida queries` (**PASA EN VERDE sobre el `use-request-offers.ts` de T-113 que NO usa TanStack Query y muta `offers` a mano con `setOffers`, porque `invalidateSpy` en la línea 130 nunca se afirma**).
