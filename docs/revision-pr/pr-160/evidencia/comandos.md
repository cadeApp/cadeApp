# Evidencia y comandos — PR #160

## Ronda 1

**SHA revisado:** `803632187079aab355b3cadb8d20477a50ef274d`

La evidencia completa de Ronda 1 se conserva en el historial de este archivo y en `revisiones/ronda-1.md`.

## Ronda 2

**SHA revisado:** `e268f5c2f4e72fdcb2592996b50b027062e2464a`  
**develop:** `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`

### Sincronización

```bash
git fetch origin
git rev-parse origin/feat/T-303-main-flow
git rev-parse origin/develop
git merge-base origin/develop origin/feat/T-303-main-flow
git rev-list --left-right --count origin/develop...origin/feat/T-303-main-flow
```

Observado:
- head: `e268f5c2f4e72fdcb2592996b50b027062e2464a`
- develop: `f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`
- merge-base: `9e232d0e4ef003ca0535b11e5a962b4cf603189a`
- detrás de develop: **25**
- por delante: 7

### H01 — desaparición de mocks integrales

```bash
git grep -n "route.fulfill\|page.route\|context.route" e268f5c2f4e72fdcb2592996b50b027062e2464a -- e2e/specs/main-flow.spec.ts
```

Por inspección del archivo actual: no quedan mocks de página/RPC en `main-flow.spec.ts`. H01 pasa a `arreglado-sin-verificar`, no a verificado.

### H02 — oráculo incompleto de concurrencia

```bash
git show e268f5c2f4e72fdcb2592996b50b027062e2464a:e2e/specs/main-flow.spec.ts | sed -n '58,116p'
```

Se observa:
- clicks dentro de `Promise.all`;
- `alreadyMatchedAlert` es cualquier `role=alert`;
- única afirmación: `hasAlert1 || hasAlert2`;
- después de `tab1.reload()` no hay aserción de cantidad/estado final.

### R01 — escenario del piso incompatible con fixture

```bash
git show e268f5c2f4e72fdcb2592996b50b027062e2464a:e2e/fixtures/roles.ts
git show e268f5c2f4e72fdcb2592996b50b027062e2464a:src/server/e2e/staging-seed.ts
git show e268f5c2f4e72fdcb2592996b50b027062e2464a:e2e/specs/main-flow.spec.ts | sed -n '205,244p'
```

Cadena estática:
1. `createOffersForFirstRequest: true`.
2. seed crea offer pending de Courier 0 para la primera request.
3. floor test hace `loginAsCourier(0)`.
4. `getAvailableRequests` calcula `hasMyOffer=true`.
5. `RequestCard` no renderiza “Ofertar” cuando `hasMyOffer`.

Si `offerButton.first()` existe, proviene de otra request de staging y el caso deja de estar aislado.

### R02 — cleanup no cubre writes de UI

```bash
git show e268f5c2f4e72fdcb2592996b50b027062e2464a:e2e/specs/main-flow.spec.ts | sed -n '119,203p'
git show e268f5c2f4e72fdcb2592996b50b027062e2464a:src/server/e2e/staging-seed.ts | sed -n '618,744p'
git show origin/develop:supabase/migrations/20260922031435_schema_v1.sql | sed -n '83,150p'
```

Prueba estructural:
- submit de publicación crea una request real nueva;
- el spec no agrega su ID a `createdRequestIds`;
- cleanup borra solo IDs trackeados;
- `delivery_requests.merchant_id` y `offers.request_id` no tienen `ON DELETE CASCADE`.

Consecuencia: puede quedar una request/offer E2E viva y fallar el borrado del merchant/request en teardown.

### H04/H05 — evidencia contradictoria

La bitácora de 02:45 atribuye RED/GREEN al SHA `464084a`, pero los commits que implementan el arreglo son posteriores:
- `a102cc4` — extensión seed;
- `c5c211c` — spec/Page Objects;
- `e268f5c` — docs de cierre.

La misma entrada dice que Playwright fue bloqueado por fail-closed y que falta la ejecución staging. El body, aun así, marca el DoD como `[x]`.

También faltan en el body salidas de:
```bash
pnpm test
pnpm test:db
```

### H07 — constructs prohibidos añadidos

Extraídos del diff `464084a...e268f5c`:
- `createdRequestIds[0]!`
- `couriers[0]!.id`
- `couriers[1]!.id`
- `builder as any`
- nuevos `as any` y `[0]!/[1]!` en `staging-seed.test.ts`.

### Ejecución de esta revisión

No se ejecutaron checks locales ni CI. Esta ronda se cierra por inspección estática porque ya hay bloqueantes previos a la etapa de aprobación. No se inventa GREEN ni se reusa la evidencia del autor como verificación independiente.
