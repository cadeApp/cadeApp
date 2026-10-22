# PR #122 — T-205 — Ronda 7

**Fecha:** 2026-09-29  
**HEAD revisado:** `014f82f2c0fbf5c418964f07ef8189b4a0d77d14`  
**Resultado:** **CON BLOQUEANTE (1)**

## 1. Decisión explícita de P1 sobre H03

Lautaro073 eligió la opción **B**: no bloquear el merge de T-205 por verificaciones que requieren staging real.

Esto no convierte H03 en “verificado”. Se registra como **aceptado** por decisión de P1.

La decisión es coherente con el plan vigente:

### T-300 — promoción inicial a staging

`docs/tasks/T-300.md` define como checkpoint obligatorio:

- promover `develop → staging`;
- correr `migrate-staging`;
- verificar drift de tipos;
- deployment de staging accesible;
- `/api/health` 200.

El issue #96 está abierto y marcado `lista`.

### T-301 — arnés E2E

Está bloqueado por T-300 y define Playwright, reduced motion, fixtures y E2E en staging.

### T-309 — accesibilidad E2E

`docs/tasks/T-309.md` incluye explícitamente:

```text
axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding
```

El issue #41 está abierto/bloqueado.

### Lighthouse

No aparece asignado explícitamente en otra ficha de Fase 3.

Por eso se conserva como **residual explícito de H03** para ejecutarse en staging antes del release. No se modifica T-309 ni se finge que Lighthouse ya fue ejecutado.

## 2. CI final del HEAD actual

Al dejar H03 aceptado por decisión, correspondía revisar CI.

Workflow:

- Run CI #586
- SHA: `014f82f2c0fbf5c418964f07ef8189b4a0d77d14`

Resultados:

- typecheck ✅
- lint ✅
- db-tests ✅
- audit ✅
- build ✅
- bundle-budget ✅
- **unit ❌**

El job unit falla en:

`src/app/route-integrity.test.ts`

Resumen real:

```text
Test Files  1 failed | 101 passed (102)
Tests       1 failed | 1376 passed (1377)
```

Error:

```text
src/features/requests/evidence/T-205/browser-audit.tsx
referencia una ruta interna inexistente en el filesystem: /style.css
```

## 3. PR122-R08 — CI roto por artefacto introducido por instrucción incorrecta del reviewer

**Severidad:** alta  
**Categoría:** proceso / CI  
**Patrón:** P15-entregable-declarado-pero-no-ejecutable

Causa raíz:

En Ronda 4 el reviewer pidió incorrectamente versionar un harness auxiliar que, según el protocolo, debía permanecer en `/tmp`.

Ese archivo:

`src/features/requests/evidence/T-205/browser-audit.tsx`

contiene la ruta literal `/style.css`.

La prueba canónica de integridad de rutas recorre referencias internas y la considera un destino inexistente, haciendo fallar CI.

Esto no debe imputarse al autor como defecto original de T-205; es consecuencia directa de una instrucción incorrecta del reviewer.

## 4. Corrección exacta

Eliminar de la rama los artefactos auxiliares introducidos por esa instrucción:

```text
src/features/requests/evidence/T-205/browser-audit.tsx
src/features/requests/evidence/T-205/vitest.config.ts
```

y retirar de:

`src/features/courier-onboarding/index.ts`

solo estos dos exports auxiliares:

```ts
export { IdentityForm as CanonicalIdentityForm } from './components/identity-form';
export { VehicleForm as CanonicalVehicleForm } from './components/vehicle-form';
```

No tocar:

- componentes funcionales;
- PNG de evidencia T-205;
- tests existentes;
- `docs/tasks/T-205.md`;
- `docs/revision-pr/**`;
- dependencias.

## 5. RED / GREEN

RED ya reproducido en CI del SHA revisado:

```text
src/app/route-integrity.test.ts
1 failed
Error: ... browser-audit.tsx referencia ... /style.css
```

Después de eliminar exclusivamente los artefactos auxiliares, debe pasar:

```bash
pnpm exec vitest run src/app/route-integrity.test.ts
pnpm test:coverage
```

No crear un test nuevo para “hacer pasar” el caso.

## 6. Estado

- H03: aceptado por decisión P1; residual staging documentado.
- R08: único bloqueante vigente.
- No aprobar ni mergear hasta CI verde.
