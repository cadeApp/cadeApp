# Ronda 6 — PR #175 / T-323

**Fecha:** 2026-10-02  
**SHA funcional:** `97cc60791ab6d8f589d2f0cb83388d5c68dc6426`  
**Resultado:** **APTO PARA MERGE A DEVELOP — SIN BLOQUEANTES**

## H07 — arreglado-verificado

Verificación independiente:
- PR body comienza con `Refs #171`, no `Closes/Fixes/Resolves`.
- PR body muestra bloque `⚠️ ACCIÓN MANUAL PENDIENTE — POST-MERGE`.
- `docs/tasks/T-323.md` define que #175 puede mergear a develop pero T-323/#171 permanece abierta/en-curso hasta staging GREEN.
- `docs/tasks/log/T-323.md` agrega entrada append-only corrigiendo la interpretación de 2-A.
- issue #171 está abierto y conserva label `en-curso`.
- issue #171 también muestra el gate manual y establece `merge != tarea terminada`.

El residual de R5 queda cerrado.

## Revalidación técnica

- `develop...HEAD`: ahead, 0 behind.
- `src/ui/map.tsx` y `src/ui/map.test.tsx`: sin diff contra develop.
- cambios propios de T-323 limitados a onboarding, tests y documentación/revisión.
- PR mergeable.

## CI exact-head 36959413505

- typecheck: success
- lint: success
- unit: 110 files / 1604 tests
- build: success
- audit: success
- db-tests: 13 files / 1614 tests
- bundle-budget: success
- workflow tests: 31
- ADR tests: 6
- `/merchant/onboarding`: 147 kB OK
- `/merchant/requests/new`: 163 kB OK
- `/design-system`: 184 kB warning preexistente

DB tuvo rate-limit transitorio de Docker Hub; los reintentos terminaron PASS.

## Cierre

Todos los hallazgos H01…H07 están arreglados y verificados.

**PR #175 puede mergearse a develop.**

Después del merge, T-323 permanece abierta. Debe ejecutarse promoción `develop → staging` y gate manual; solo GREEN habilita cierre de #171.
