# Ronda 6 — PR #204 / T-305

**Fecha:** 2026-10-04  
**SHA funcional final verificado:** `206a29bfbc99bd215200367264039b7aefa02607`  
**HEAD documental observado:** `006b70510bdeb688cc9543dadd44b870fa7ae932`  
**Resultado:** **SIN BLOQUEANTES**

## Sincronización

Al cierre:
- base develop: `59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`;
- rama: ahead 29 / behind 0;
- GitHub: `mergeable=true`.

La integración de develop incluyó T-334. Después de esa integración se volvió a ejecutar la suite T-305 completa.

## E2E final de T-305

Run confiable: `37184438349`  
Job: `111383374009`  
SHA probado: `206a29bfbc99bd215200367264039b7aefa02607`

El log ejecuta `pnpm exec playwright test --project=chromium --workers=1` y muestra:

```text
✓ T-305 — Un pending recibe el error del servidor aunque fuerce la llamada (retry #1)
✓ T-305 — Un suspendido pierde sus ofertas pending al instante
✓ T-305 — Merchant en (courier) y courier en (admin) son redirigidos
✓ T-305 — Falla al desactivar el chequeo de submit_offer o la guarda
```

Resultado del proyecto chromium: 23 passed + 1 flaky contabilizado por retry; global-settings: 3 passed; status final del gate: success.

Con esta corrida posterior a T-334 quedan verificados por runtime:
- PR204-H01;
- PR204-H03;
- PR204-H04;
- PR204-H06;
- PR204-H07.

## CI funcional

CI run `37184369942` sobre el mismo SHA funcional:
- typecheck ✅
- lint ✅
- audit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- unit ❌ únicamente por `tools/verify-fichas.test.ts`: **T-336** desincronizada con `docs/implementation-plan.md`.

Ese fallo no pertenece a T-305 y está presente en el baseline incorporado desde develop.

El HEAD documental posterior volvió a mostrar:
- unit ❌ por la misma T-336;
- build ❌ una vez por `next/font` (`TypeError: Cannot read properties of null (reading '1')`).

Ese build no se atribuye a T-305 porque:
1. `7dcb71a` solo modifica `docs/tasks/log/T-305.md`;
2. el mismo código funcional `206a29b` compiló GREEN en CI `37184369942`;
3. no hubo cambios de código, dependencias ni fuentes entre ambos.

## H02 — residual explícito no bloqueante

La evidencia histórica falsa fue corregida. La bitácora muestra la mutación real de implementación:
- RED: `Expected redirect / Received allow`;
- restauración;
- GREEN.

El reviewer no pudo ejecutar ese harness localmente porque su entorno no resuelve `github.com`; por eso H02 conserva estado `arreglado-sin-verificar`, sin fingir verificación independiente.

Esto no bloquea el cierre porque:
- la mutación documentada ya tiene la forma correcta exigida;
- el árbol entregado no contiene la mutación;
- el comportamiento normal quedó validado en el Preview real.

## Flake de LoginPage — fuera de T-305

El primer caso de authorization falló inicialmente por:

```text
TimeoutError: page.waitForURL: Timeout 30000ms exceeded.
at e2e/pages/login.page.ts:37
```

y pasó en `retry #1`.

El mismo síntoma ya había ocurrido en otros specs. Como `LoginPage.login()` es infraestructura compartida fuera del alcance de T-305, se abrió issue **#250 — [QA] Estabilizar LoginPage.login: waitForURL flaky en E2E**. No se aumenta timeout ni se debilitan assertions dentro de T-305.

## Body y DoD

- `Closes #37` es correcto.
- DoD 1–4 están respaldados por el run remoto.
- `docs/tasks/T-305.md` fue actualizado para marcar el DoD verificado.
- rollback real presente.
- no hay diff propio de T-305 en `.github/workflows/e2e-preview.yml`.

## Resultado final

**SIN BLOQUEANTES.**

La PR #204 está apta para merge desde la revisión independiente. No se aprueba ni mergea automáticamente; la decisión de merge queda en Lautaro073.
