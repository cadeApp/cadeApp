# Ronda 2 — PR #204 / T-305

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `328e63ad9ba44f3fd2281fb8bc758b95533d3429`  
**Resultado:** **CON BLOQUEANTES (2)**

## Sincronización

Al comenzar la ronda:
- `develop`: `721f6e0b0fcbab466ce97812c2a31694a2fbff88`
- head PR: `328e63ad9ba44f3fd2281fb8bc758b95533d3429`
- ahead: 13
- behind: 20
- merge-base: `cb4111273da663f7591aec370a44767c4e677b82`
- GitHub informa la PR como mergeable, pero el SHA revisado no contiene los 20 commits más nuevos de develop.

Esos 20 commits no tocan `e2e/specs/authorization.spec.ts`; sí incluyen cambios de contratos/tipos y deben integrarse antes de la validación final para que typecheck/CI prueben T-305 sobre la base actual.

## Ronda 1 — estado de H01–H05

### PR204-H01 — corregido en árbol, runtime pendiente por 3-A

El spec ya no usa service-role como actor de `admin_suspend_courier`. Crea un admin E2E transitorio, lo registra para cleanup, eleva una sesión real a AAL2 con TOTP y llama la RPC con ese cliente.

Inspección adicional:
- `trackEntityForCleanup(..., 'user', adminUserId)` existe y cleanup elimina profiles/auth users.
- no se agregó dependencia TOTP; usa `node:crypto`.
- el fallo MFA es fail-closed; no hay fallback a service-role.

No se marca `arreglado-verificado` porque el workflow confiable de develop todavía no ejecuta `authorization.spec.ts` pre-merge y el reviewer no tiene acceso de red para clonar/ejecutar la suite. Por decisión P1 3-A, esto no agrega por sí solo un bloqueo pre-merge nuevo.

### PR204-H02 — evidencia corregida, sin reproducción runtime independiente

Se eliminó `guardBypassSimulation`. La bitácora ahora muestra una mutación real de la implementación:

```text
Expected: redirect
Received: allow
```

y luego GREEN tras restaurar. La forma de la evidencia es coherente con la mutación pedida. El reviewer intentó reproducirla, pero el entorno de revisión no puede resolver `github.com`, por lo que no se declara verificación runtime independiente.

### PR204-H03 — corregido en workflow

La rama agrega condicionalmente `e2e/specs/authorization.spec.ts` al array del gate. El `repository_dispatch` real del SHA revisado usó el workflow confiable de develop y, como prevé 3-A, **no ejecutó authorization** todavía.

El e2e-preview del SHA `328e63a` quedó RED por un fallo preexistente de **T-303 Flujo 4**, no por T-305:
- 8 tests pasaron;
- Flujo 4 falló/reintentó;
- `authorization.spec.ts` no fue invocado por el workflow confiable actual.

Eso queda como residual post-merge de T-305/#37, no como defecto nuevo de #204.

### PR204-H04 — corregido

Los dos `getByText` fueron reemplazados por headings accesibles:
- pending → `Estamos revisando tus datos`
- suspended → `Cuenta suspendida temporalmente`

## BLOQUEANTES

### PR204-H05 — El body sigue dando evidencia que no tiene y el rollback no revierte T-305

**Severidad:** medio · **Categoría:** conventions/evidencia  
**Dónde:** body de PR #204

El body mejoró: ahora usa `Refs #37`, copia las secciones principales del template y deja DoD 1–3 sin marcar. Pero todavía tiene tres problemas:

1. marca `[x] Cada prueba nueva se demostró fallando al romper la regla`, aunque la bitácora solo demuestra la mutación real del caso de guarda (DoD 4); por decisión 2-A no se mutó `submit_offer` y no hay evidencia equivalente de DoD 1–3;
2. en “Informe de revisión de agy” pegó el Markdown de `ronda-1.md`, no el formato literal requerido por la skill que comienza con `Informe revisar-pr — T-305 — ...`;
3. el rollback dice `git revert 328e63a...`, pero ese commit **solo cambia una línea de la bitácora** (`TBD` → `1bae33d`). Revertirlo no elimina el spec ni la modificación del gate.

Además, “Evidencia de checks” omite el `pnpm test`/run exact-head aunque CI #914 sí lo ejecutó: 113/113 archivos y 1678/1678 tests GREEN.

**Qué debe pasar:** dejar sin marcar el checkbox de “cada prueba nueva” y explicar el alcance real de 2-A/3-A; pegar el informe literal de esta Ronda 2; citar CI #914 / run `37047363108` como evidencia de typecheck/lint/unit/db; y describir un rollback real (“revertir el merge/squash commit final de PR #204” o eliminar el spec + revertir el hunk del gate), no el commit docs-only.

### PR204-H06 — El caso de redirecciones no puede cambiar de merchant a courier en la misma sesión

**Severidad:** alto · **Categoría:** test-coverage/correctness  
**Dónde:** `e2e/specs/authorization.spec.ts:292-321`

El test hace:

```ts
await loginAsMerchant(page);
// ... merchant sigue autenticado ...
await loginAsCourier(0, page);
```

`loginAsCourier` llama `LoginPage.navigate()` → `/login`. Pero `evaluateRouteGuard('/login', sessionMerchant)` redirige inmediatamente a `/merchant/dashboard`. Por lo tanto el segundo helper no llega a ver los inputs de login y no puede iniciar sesión como courier.

Esto no es teórico: el propio gate E2E actual mostró en T-303 un fallo análogo dentro de `LoginPage.login` al intentar un cambio de sesión en un flujo largo.

**Qué debe pasar:** aislar el segundo rol antes de `loginAsCourier`. La corrección mínima es limpiar el estado de autenticación del browser context antes del segundo login, por ejemplo cookies (y storage si corresponde), y recién entonces invocar `loginAsCourier(0, page)`. No simular la sesión ni saltarse el middleware.

## MEJORA

### PR204-M01 — La descripción del status del gate volvió a enumerar specs y ya quedó menos precisa que develop

El `develop` actual usa:
- `trusted E2E gate GREEN contra el Preview`
- `trusted E2E gate RED contra el Preview`

La rama vuelve a `smoke + main-flow + authorization`, aunque el mismo workflow ya soporta specs condicionales como `request-states`. Conviene conservar la descripción genérica de develop y solo agregar `authorization.spec.ts` al array condicional.

No bloquea por sí sola, pero se corrige junto con la resincronización para no degradar el mensaje del gate.

## Checks exact-head observados

CI #914 / run `37047363108` sobre `328e63a`:
- typecheck ✅
- lint ✅
- build ✅
- audit ✅
- bundle-budget ✅
- unit: **113/113 archivos · 1678/1678 tests** ✅
- verify-workflows: **47/47** ✅
- ADR: **6/6** ✅
- db-tests: **14 archivos · 1645 tests · PASS** ✅

E2E Preview / run `37047498248`:
- target SHA correcto: `328e63a`
- Supabase Develop target ✅
- health ✅
- e2e-preview ❌ por T-303 Flujo 4
- `authorization.spec.ts` no se ejecutó, coherente con bootstrap 3-A.

## Resultado

**CON BLOQUEANTES (2).** H01–H04 quedaron corregidos en el árbol/evidencia y no se reabren. Antes de una Ronda 3:
1. integrar `origin/develop` actual;
2. corregir H06;
3. corregir el body/rollback de H05;
4. conservar la descripción genérica actual de develop para el status;
5. push normal y CI exact-head nuevo.

No aprobar ni mergear todavía.
