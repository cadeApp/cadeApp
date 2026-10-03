# PR #204 — T-305 — E2E de autorización

- **PR:** #204
- **Tarea:** T-305 / issue #37
- **Rama:** `feat/T-305-authorization-e2e`
- **Base:** `develop`
- **Ronda actual:** 4
- **SHA funcional revisado (Ronda 1):** `8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c`
- **SHA funcional Ronda 2:** `328e63ad9ba44f3fd2281fb8bc758b95533d3429`
- **SHA funcional Ronda 3:** `b20d7cb4f5d1199e06610d6b9ed604ab07f172d8`
- **SHA funcional Ronda 4:** `dd29da076a1d8d7194f90568c8a1ae53e1ad5c72`
- **SHA decisiones P1:** `23cf11f8e86a6c9ff7f5387f9ab673a328397de1` + `b9e2a05847cfd273076025aad45400a8398531c4`
- **Resultado:** **CON BLOQUEANTES (1)**
- **Fecha:** 2026-10-03
- **Revisor:** revisión independiente solicitada por Lautaro073

## Estado

Al iniciar la ronda, `develop` estaba en `6577d9e427c5efc0a79a2c374f0f74d847732f4d` y la rama funcional estaba 38 commits detrás. Esos commits incluyen el gate `e2e-preview` vigente.

Decisiones P1 ya registradas en Issue #37 y en `docs/tasks/T-305.md`:
1. `authorization.spec.ts` debe ejecutarse en `e2e-preview`; T-305 puede tocar solo ese workflow para agregar el spec.
2. El «o» del DoD es literal: RED auténtico rompiendo la guarda; `submit_offer` se prueba GREEN contra Supabase Develop y no se muta la RPC compartida.
3. Por bootstrap de `repository_dispatch`, #204 puede quedar apta para merge sin haber corrido remotamente `authorization.spec.ts` en ese mismo PR. **T-305/#37 sigue abierta** hasta observar en una PR posterior un `e2e-preview` GREEN que incluya ese spec; #204 debe usar `Refs #37`, no `Closes #37`.

## Estado Ronda 4

H05 quedó corregido y validado contra el body vivo de GitHub: `Refs #37`, checkbox de mutaciones sin marcar, secciones literales requeridas y rollback real.

Único bloqueante actual:
- **PR204-H07:** la rama está 49 commits detrás de `develop` y GitHub la reporta `mergeable_state=dirty`. Desde T-331, `develop` ya no enumera specs: ejecuta todos los specs `chromium` automáticamente. Por lo tanto T-305 debe integrar `origin/develop` y resolver el conflicto quedándose con el workflow nuevo de `develop`, sin conservar un diff propio en `.github/workflows/e2e-preview.yml`.

T-331 también vuelve obsoleta la mecánica de 1-A/3-A: una vez sincronizada la rama, el gate confiable puede ejecutar `authorization.spec.ts` **pre-merge**. Si un run exact-head muestra los cuatro tests T-305 GREEN, el residual de 3-A desaparece y #37 puede pasar de `Refs` a `Closes`.

## Revisiones

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `revisiones/ronda-3.md`
- `revisiones/ronda-4.md`
