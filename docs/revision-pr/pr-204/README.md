# PR #204 — T-305 — E2E de autorización

- **PR:** #204
- **Tarea:** T-305 / issue #37
- **Rama:** `feat/T-305-authorization-e2e`
- **Base:** `develop`
- **Ronda actual:** 3
- **SHA funcional revisado (Ronda 1):** `8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c`
- **SHA funcional Ronda 2:** `328e63ad9ba44f3fd2281fb8bc758b95533d3429`
- **SHA funcional Ronda 3:** `b20d7cb4f5d1199e06610d6b9ed604ab07f172d8`
- **SHA decisiones P1:** `23cf11f8e86a6c9ff7f5387f9ab673a328397de1` + `b9e2a05847cfd273076025aad45400a8398531c4`
- **Resultado:** **CON BLOQUEANTES (2)**
- **Fecha:** 2026-10-02
- **Revisor:** revisión independiente solicitada por Lautaro073

## Estado

Al iniciar la ronda, `develop` estaba en `6577d9e427c5efc0a79a2c374f0f74d847732f4d` y la rama funcional estaba 38 commits detrás. Esos commits incluyen el gate `e2e-preview` vigente.

Decisiones P1 ya registradas en Issue #37 y en `docs/tasks/T-305.md`:
1. `authorization.spec.ts` debe ejecutarse en `e2e-preview`; T-305 puede tocar solo ese workflow para agregar el spec.
2. El «o» del DoD es literal: RED auténtico rompiendo la guarda; `submit_offer` se prueba GREEN contra Supabase Develop y no se muta la RPC compartida.
3. Por bootstrap de `repository_dispatch`, #204 puede quedar apta para merge sin haber corrido remotamente `authorization.spec.ts` en ese mismo PR. **T-305/#37 sigue abierta** hasta observar en una PR posterior un `e2e-preview` GREEN que incluya ese spec; #204 debe usar `Refs #37`, no `Closes #37`.

## Estado Ronda 3

H01–H04 continúan corregidos por árbol/evidencia. H06 quedó corregido por aislamiento real de sesión en el mismo Page y M01 quedó corregida restaurando la descripción genérica del status.

Bloqueantes actuales:
- **PR204-H05:** el body sigue sin pegar el informe en el formato literal de la skill; además su evidencia exact-head quedará obsoleta al sincronizar.
- **PR204-H07:** `develop` avanzó 4 commits con T-329 y cambió el mismo `e2e-preview.yml`; la rama está detrás y el merge ref observable todavía no contiene el gate `global-settings`. Hay que integrar `origin/develop` y revalidar el nuevo SHA antes de cerrar.

## Revisiones

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `revisiones/ronda-3.md`
