# Ronda 5 — PR #175 / T-323

**Fecha:** 2026-10-02  
**SHA funcional:** `a846f90b91691e7b71301aa500e62ee30e2eba07`  
**Resultado:** **CON BLOQUEANTE (1)**

## Integración de CC-014

- PR #178 / CC-014 ya fue mergeado a develop.
- La rama T-323 hizo merge de origin/develop.
- `src/ui/map.tsx` y `src/ui/map.test.tsx` ya no aparecen en el diff contra develop.
- H06 queda **arreglado-verificado**.

## Código propio de T-323

`src/features/merchants/components/onboarding-form.tsx` conserva:
- bloqueo derivado de coordenadas efectivas reales;
- lat/lng descartadas a null no bloquean el fallback manual;
- submit vuelve a validar bounds antes de persistir.

La suite de onboarding cubre recuperación manual, coordenadas reales fuera de rango y corrección posterior. No se detectaron nuevos defectos funcionales.

## PR175-H07 — ALTO — la tarea se cerraría antes de staging

El body de PR #175 empieza con `Closes #171`. Si se mergea, GitHub cerrará automáticamente T-323/#171.

Además, el gate en el body, `docs/tasks/T-323.md` y la bitácora dice que la ausencia de evidencia visual post-merge no debe dejar T-323 abierta.

Flujo correcto:

1. PR #175 puede mergear a develop.
2. T-323/#171 sigue abierta y `en-curso`.
3. Promoción develop → staging.
4. Acción manual: validar visualmente el mapa y fallback real.
5. GREEN: recién ahí cerrar T-323/#171.
6. FAIL: mantener T-323 abierta y bloquear staging → main.

### Corrección requerida

1. Cambiar `Closes #171` por `Refs #171` o equivalente no autocerrable.
2. Corregir PR body, `docs/tasks/T-323.md`, `docs/tasks/log/T-323.md` e issue #171 para decir explícitamente que T-323 permanece abierta/en-curso tras merge de #175.
3. Mostrar de forma visible la acción manual pendiente post-merge.
4. Solo después de staging GREEN se puede marcar el gate como completado, cerrar #171 y considerar T-323 terminada.
5. Si staging falla, #171 permanece abierta y `staging → main` queda bloqueado.

## CI exact-head 36958099121

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

## Conclusión

**No mergear #175 todavía.**

No queda un defecto de producto abierto; queda corregir la semántica de cierre para que el merge a develop no marque T-323 como terminada antes del gate real de staging.
