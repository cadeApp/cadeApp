# Evidencia y reproducciones — PR #122

## Ronda 7 — decisión P1 + CI final

### Decisión P1

Lautaro073 eligió opción B:

```text
Completar post-merge en staging las verificaciones de H03 que requieren entorno real.
```

Esto se registra como decisión de alcance, no como verificación técnica.

### Tareas de staging existentes

`docs/tasks/T-300.md`

- promoción `develop → staging`;
- migrate-staging;
- deployment staging;
- health 200.

Issue #96: abierto, label `lista`.

`docs/tasks/T-301.md`

- Playwright;
- `reducedMotion: 'reduce'`;
- fixtures/seed en staging;
- E2E staging;
- bloqueado por T-300.

`docs/tasks/T-309.md`

DoD:

```text
axe AA en login, crear solicitud, lista del repartidor, viaje y onboarding
```

Issue #41: abierto/bloqueado.

No se encontró una ficha de Fase 3 que nombre Lighthouse móvil explícitamente. Se conserva como residual H03 previo al release/T-312.

## CI #586 — SHA `014f82f2c0fbf5c418964f07ef8189b4a0d77d14`

### Jobs

```text
typecheck       success
lint            success
db-tests        success
audit           success
build           success
bundle-budget   success
unit            failure
```

### Unit

Job `109286277017`.

Resumen Vitest:

```text
Test Files  1 failed | 101 passed (102)
Tests       1 failed | 1376 passed (1377)
```

Fallo:

```text
FAIL src/app/route-integrity.test.ts
T-118: Integridad de Rutas, Shells y Navegación Canónica
DoD 4 ...

AssertionError: expected [Function] to not throw an error but
Error: src/features/requests/evidence/T-205/browser-audit.tsx
referencia una ruta interna inexistente en el filesystem: /style.css
```

### Causa

El archivo:

`src/features/requests/evidence/T-205/browser-audit.tsx`

fue agregado por una instrucción incorrecta del reviewer en una ronda previa.

El protocolo correcto exigía mantener scripts auxiliares en `/tmp`.

### Corrección mínima esperada

Eliminar:

```text
src/features/requests/evidence/T-205/browser-audit.tsx
src/features/requests/evidence/T-205/vitest.config.ts
```

y quitar de:

`src/features/courier-onboarding/index.ts`

solo:

```ts
export { IdentityForm as CanonicalIdentityForm } from './components/identity-form';
export { VehicleForm as CanonicalVehicleForm } from './components/vehicle-form';
```

No tocar PNG, tests existentes ni ficha T-205.

### RED / GREEN

RED ya existe en CI #586.

GREEN mínimo:

```bash
pnpm exec vitest run src/app/route-integrity.test.ts
pnpm test:coverage
pnpm typecheck
pnpm lint
```

Luego push normal y esperar CI completo.

No crear un test nuevo, no editar `route-integrity.test.ts`, no bajar controles y no excluir `browser-audit` de la auditoría: el archivo auxiliar debe salir de la rama.

## Ronda 8 — GREEN final

SHA corregido: `01227903ec78a48df748491ef93725ae0648e2d9`.

CI #588:

```text
typecheck       success
lint            success
unit            success
db-tests        success
audit           success
build           success
bundle-budget   success
```

Unit:

```text
src/app/route-integrity.test.ts  51 passed
Test Files  102 passed (102)
Tests       1377 passed (1377)
```

DB:

```text
Files=12, Tests=1601
Result: PASS
```

Rutas T-205 dentro de presupuesto:

```text
/courier/feed                    157 kB
/courier/offers                  157 kB
/courier/onboarding/identity     173 kB
/courier/onboarding/status       173 kB
/courier/onboarding/vehicle      173 kB
/courier/profile                 173 kB
/courier/profile/notifications   105 kB
/merchant/dashboard              164 kB
/merchant/history                164 kB
/merchant/onboarding             147 kB
/merchant/plan                   156 kB
/merchant/requests/[id]          164 kB
/merchant/requests/new           164 kB
/trips/[id]                      162 kB
```

Todos los valores del alcance T-205 son <= 180 kB.
