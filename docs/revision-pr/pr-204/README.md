# PR #204 — T-305 — E2E de autorización

- **PR:** #204
- **Tarea:** T-305 / issue #37
- **Rama:** `feat/T-305-authorization-e2e`
- **Base:** `develop`
- **Ronda actual:** 1
- **SHA funcional revisado:** `8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c`
- **SHA decisiones P1:** `23cf11f8e86a6c9ff7f5387f9ab673a328397de1` + `b9e2a05847cfd273076025aad45400a8398531c4`
- **Resultado:** **CON BLOQUEANTES (5)**
- **Fecha:** 2026-10-02
- **Revisor:** revisión independiente solicitada por Lautaro073

## Estado

Al iniciar la ronda, `develop` estaba en `6577d9e427c5efc0a79a2c374f0f74d847732f4d` y la rama funcional estaba 38 commits detrás. Esos commits incluyen el gate `e2e-preview` vigente.

Decisiones P1 ya registradas en Issue #37 y en `docs/tasks/T-305.md`:
1. `authorization.spec.ts` debe ejecutarse en `e2e-preview`; T-305 puede tocar solo ese workflow para agregar el spec.
2. El «o» del DoD es literal: RED auténtico rompiendo la guarda; `submit_offer` se prueba GREEN contra Supabase Develop y no se muta la RPC compartida.
3. Por bootstrap de `repository_dispatch`, #204 puede quedar apta para merge sin haber corrido remotamente `authorization.spec.ts` en ese mismo PR. **T-305/#37 sigue abierta** hasta observar en una PR posterior un `e2e-preview` GREEN que incluya ese spec; #204 debe usar `Refs #37`, no `Closes #37`.

## Bloqueantes

- PR204-H01 — `admin_suspend_courier` usa service-role en vez de sesión admin AAL2.
- PR204-H02 — la fase RED declarada cambia el expected del test, no la guarda real.
- PR204-H03 — `e2e-preview` no ejecuta `authorization.spec.ts`.
- PR204-H04 — dos selectores `getByText` incumplen la regla E2E de rol/label accesible.
- PR204-H05 — body fuera del template y evidencia marcada como hecha aunque la bitácora dice que falta.

## Revisiones

- `revisiones/ronda-1.md`
