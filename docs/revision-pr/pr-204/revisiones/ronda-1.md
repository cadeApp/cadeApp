# Ronda 1 — PR #204 / T-305

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c`  
**Resultado:** **CON BLOQUEANTES (5)**

## Qué se verificó

- Ficha T-305 leída desde `develop`.
- Diff funcional: `e2e/specs/authorization.spec.ts` + `docs/tasks/log/T-305.md`.
- `develop` avanzó a `6577d9e`; la rama estaba 38 commits detrás y debe integrar `origin/develop` antes del arreglo.
- CI general del SHA funcional: GREEN, pero no ejecutó `authorization.spec.ts`.
- La bitácora reconoce que falta ejecución E2E remota.

## Decisiones P1

Lautaro073 eligió A/A antes de cerrar esta ronda:

1. **Gate:** habilitar únicamente `.github/workflows/e2e-preview.yml` y agregar allí `e2e/specs/authorization.spec.ts`. No tocar `e2e-staging.yml`.
2. **Mutación:** el «o» es literal. RED obligatorio mutando temporalmente `evaluateRouteGuard`; `submit_offer` solo GREEN contra Supabase Develop. No mutar la RPC compartida.

Registradas en Issue #37 y en la ficha de la rama por `23cf11f8e86a6c9ff7f5387f9ab673a328397de1`.

## BLOQUEANTES

### PR204-H01 — `admin_suspend_courier` se invoca con service-role, pero exige admin AAL2

**Severidad:** alto · **Categoría:** correctness/seguridad  
**Dónde:** `e2e/specs/authorization.spec.ts:121-129`

El spec usa `createAdminClient().rpc('admin_suspend_courier', ...)`. Ese cliente lleva service-role pero no una sesión de usuario. La RPC llama `app_private.assert_admin_aal2()`, que rechaza `auth.uid() is null` con `UNAUTHENTICATED`. El código productivo ya documenta la regla: para esta RPC se usa el cliente de sesión AAL2, **nunca** `createAdminClient`.

**Arreglo esperado:** crear dentro del spec un admin E2E transitorio, registrarlo para cleanup, promover su profile a `admin`, iniciar sesión con anon key, enrolar TOTP, elevar a AAL2 y usar ese cliente autenticado para `admin_suspend_courier`. El service-role queda solo para preparar/limpiar datos.

### PR204-H02 — La fase RED declarada cambia el expected, no la implementación

**Severidad:** alto · **Categoría:** test-coverage/evidencia  
**Dónde:** bitácora “Fase RED”; `authorization.spec.ts:243-246`

La salida pegada muestra **Expected = allow / Received = redirect**. El test entregado espera `redirect`; por lo tanto el rojo se fabricó cambiando el oráculo del test, no rompiendo la guarda.

**Arreglo esperado:** eliminar la “simulación” `guardBypassSimulation` como supuesta evidencia y hacer una mutación temporal real en `src/features/auth/guards.ts`: para merchant en `/courier/feed`, devolver `{ action: 'allow' }`. Ejecutar solo el caso de guarda, mostrar RED, restaurar inmediatamente sin commit y mostrar GREEN. Prohibido cambiar expectativas para fabricar rojo.

### PR204-H03 — El gate real no ejecuta el spec de T-305

**Severidad:** alto · **Categoría:** test-coverage/CI  
**Dónde:** `.github/workflows/e2e-preview.yml:115-120` en develop

El gate ejecuta solo `smoke.spec.ts` y `main-flow.spec.ts`. Por eso ningún verde actual valida T-305.

**Origen:** ficha. La ficha original pedía un E2E pero no permitía editar el workflow que enumera specs.  
**Decisión P1 1-A:** scope ampliado.

**Arreglo esperado:** mergear `origin/develop`, agregar `e2e/specs/authorization.spec.ts` al comando Playwright de Preview y actualizar la descripción del status a `smoke + main-flow + authorization`. No tocar staging.

### PR204-H04 — Dos selectores incumplen la convención E2E

**Severidad:** medio · **Categoría:** conventions/test-coverage  
**Dónde:** `e2e/specs/authorization.spec.ts:59,150`

`e2e/AGENTS.md` exige selectores por rol o label accesible. El spec usa `getByText` para pending y suspended.

**Arreglo esperado:**
- pending → `getByRole('heading', { name: /estamos revisando tus datos/i })`
- suspended → `getByRole('heading', { name: /cuenta suspendida temporalmente/i })`

No agregar testids ni tocar UI productiva.

### PR204-H05 — El body certifica evidencia inexistente y está fuera del template

**Severidad:** medio · **Categoría:** conventions/evidencia  
**Dónde:** body de PR #204; `docs/tasks/log/T-305.md:41`

El body marca todos los puntos del DoD como hechos, pero la bitácora dice que falta la ejecución E2E. Además no sigue `.github/pull_request_template.md`.

**Arreglo esperado:** al finalizar, reescribir el body con el template, marcar solo lo demostrado en el SHA exacto y enlazar/pegar la corrida `e2e-preview` que incluya `authorization.spec.ts`. En la bitácora usar “hecho/pruebas/falta”, no auto-marcar “verificado”.

## Evidencia / checks

- CI general exact-head observado: run `36970896014` — GREEN.
- Ese run no ejecutó `authorization.spec.ts`.
- No se tomó la fase RED del autor como verificación independiente.
- No se ejecutó Supabase remoto desde la revisión.
- No aprobar ni mergear.

## Resultado

**CON BLOQUEANTES (5).** Integrar `origin/develop`, corregir H01-H05, demostrar RED real sin adulterar tests y obtener una corrida E2E real antes de la siguiente revisión.
