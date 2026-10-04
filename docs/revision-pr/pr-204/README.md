# PR #204 — T-305 — E2E de autorización

- **PR:** #204
- **Tarea:** T-305 / issue #37
- **Rama:** `feat/T-305-authorization-e2e`
- **Base:** `develop`
- **Ronda actual:** 6
- **SHA funcional revisado (Ronda 1):** `8eeee50c4a7412734075ea0d07a4bb2d5dc5e82c`
- **SHA funcional Ronda 2:** `328e63ad9ba44f3fd2281fb8bc758b95533d3429`
- **SHA funcional Ronda 3:** `b20d7cb4f5d1199e06610d6b9ed604ab07f172d8`
- **SHA funcional Ronda 4:** `dd29da076a1d8d7194f90568c8a1ae53e1ad5c72`
- **SHA funcional Ronda 5:** `39aa7f642a106dfa50c243f88137ffd712847ff0`
- **SHA funcional Ronda 6:** `206a29bfbc99bd215200367264039b7aefa02607`
- **HEAD documental al cierre:** `006b70510bdeb688cc9543dadd44b870fa7ae932`
- **SHA decisiones P1:** `23cf11f8e86a6c9ff7f5387f9ab673a328397de1` + `b9e2a05847cfd273076025aad45400a8398531c4`
- **Resultado:** **SIN BLOQUEANTES**
- **Fecha:** 2026-10-04
- **Revisor:** revisión independiente solicitada por Lautaro073

## Estado

Al iniciar la ronda, `develop` estaba en `6577d9e427c5efc0a79a2c374f0f74d847732f4d` y la rama funcional estaba 38 commits detrás. Esos commits incluyen el gate `e2e-preview` vigente.

Decisiones P1 ya registradas en Issue #37 y en `docs/tasks/T-305.md`:
1. `authorization.spec.ts` debe ejecutarse en `e2e-preview`; T-305 puede tocar solo ese workflow para agregar el spec.
2. El «o» del DoD es literal: RED auténtico rompiendo la guarda; `submit_offer` se prueba GREEN contra Supabase Develop y no se muta la RPC compartida.
3. Por bootstrap de `repository_dispatch`, #204 puede quedar apta para merge sin haber corrido remotamente `authorization.spec.ts` en ese mismo PR. **T-305/#37 sigue abierta** hasta observar en una PR posterior un `e2e-preview` GREEN que incluya ese spec; #204 debe usar `Refs #37`, no `Closes #37`.

## Estado Ronda 6

**SIN BLOQUEANTES.** La rama está sincronizada con `develop` (behind 0), GitHub la reporta mergeable y T-305 fue revalidada después de integrar T-334.

Evidencia funcional final:
- SHA `206a29bfbc99bd215200367264039b7aefa02607`;
- e2e-preview `37184438349`, job `111383374009`;
- `authorization.spec.ts`: los 4 casos T-305 quedaron GREEN;
- typecheck/lint/audit/build/db/bundle del mismo SHA: GREEN;
- el único unit rojo corresponde al baseline T-336 ficha/plan, fuera de T-305.

Los commits posteriores `7dcb71a` y `006b705` son solo documentación de T-305. El HEAD documental actual sigue 0 commits detrás y mergeable.

Residual no bloqueante:
- H02: la bitácora muestra la mutación RED real corregida y GREEN restaurado, pero el reviewer no pudo reproducir ese harness localmente por limitación de red del entorno. No se declara verificación runtime independiente.
- Flake compartida de `LoginPage.login()`: el primer caso T-305 necesitó retry por timeout en `waitForURL`; se separó como issue **#250** porque el mismo síntoma ya apareció fuera de T-305.

## Revisiones

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `revisiones/ronda-3.md`
- `revisiones/ronda-4.md`
- `revisiones/ronda-5.md`
- `revisiones/ronda-6.md`
