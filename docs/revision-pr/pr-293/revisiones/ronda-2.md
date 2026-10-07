# Informe de revisión — PR #293 / T-347 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/293  
**HEAD funcional revisado:** `92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952`  
**Base:** `develop` @ `64dfdf653219c6cf08a223c0df829353d9d9d8f1`  
**Fecha:** 2026-10-07

## Resultado

**SIN BLOQUEANTES.**

No quedan decisiones 🔵 ni mejoras pendientes.

## Sincronización y alcance

Al iniciar Ronda 2:

```text
develop = 64dfdf653219c6cf08a223c0df829353d9d9d8f1
HEAD    = 92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952
ahead   = 3
behind  = 0
```

Desde el commit de revisión de Ronda 1 `79401ee71fc11644e0ced9a1811b5fc899754f5d` hubo un solo commit funcional:

`92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952 — docs(T-347): switch trigger to repository_dispatch and record decisions [T-347]`

Ese commit modifica únicamente:

- `docs/tasks/T-347.md`;
- `docs/tasks/log/T-347.md`;
- `docs/implementation-plan.md`.

No toca `docs/revision-pr/**` ni implementa `.github/**`, `e2e/**` o `src/**`.

## PR293-H01 — arreglado-verificado

Ronda 1 detectó que la ficha confiaba en `workflow_dispatch` como si garantizara el control plane de la rama por defecto.

El SHA de Ronda 2 corrige toda la clase relevante:

### Objetivo y trigger

La ficha ahora define:

- `on: repository_dispatch`;
- type único `e2e.mutation.requested`;
- `client_payload { target, mutation }`;
- control plane ejecutado desde la rama por defecto;
- `target` y `mutation` tratados como datos no confiables.

### Separación trusted / target

La ficha exige que la PR objetivo nunca pueda aportar ni reescribir:

- `e2e-mutation.yml`;
- `e2e-mutation.mjs`;
- `e2e/mutations/manifest.json`;
- patches del catálogo.

El SHA objetivo aporta únicamente código de aplicación y el spec que se ejecutará.

### Validación de target

Para una PR:

- `state=open`;
- mismo repositorio;
- base `develop`;
- SHA completo de 40 hex.

Para `target=develop`, se usa la punta vigente de `develop`.

Un mutation id inexistente se rechaza.

### DoD estructural

El DoD ahora exige explícitamente:

- solo `repository_dispatch`;
- único type `e2e.mutation.requested`;
- ausencia de `workflow_dispatch`;
- parser, manifest y patches desde la rama por defecto, nunca desde el target SHA.

La única aparición de `workflow_dispatch` en la ficha actual es normativa: “queda prohibido” / “sin workflow_dispatch”.

Las menciones antiguas de `workflow_dispatch` en la primera entrada de la bitácora se conservan correctamente porque la bitácora es append-only; la segunda entrada explica la corrección.

**Estado H01:** arreglado-verificado.

## Decisiones P1

Las cuatro decisiones de Ronda 1 quedaron incorporadas literalmente en la ficha:

- **0-B:** `repository_dispatch` + `e2e.mutation.requested` + payload `{ target, mutation }`;
- **1-A:** catálogo `manifest.json + *.patch` versionado y revisado en `develop`;
- **2-A:** control/mutante con `pnpm build` + `pnpm start -H 127.0.0.1`, nunca Vercel;
- **3-A:** validación punta a punta post-merge; ante `MUTANT_SURVIVED`, `CONTROL_NOT_GREEN`, `UNEXPECTED_FAILURE` o infraestructura inválida, #289 permanece/reabre.

No quedan decisiones pendientes.

## Defensa en profundidad MFA/DNI

La ficha conserva correctamente el riesgo observado en T-302:

- MFA AAL2 también se protege en PostgreSQL;
- `dni_hmac` mantiene unicidad en DB;
- una mutación limitada a `src/**` puede sobrevivir.

Si ocurre:

- no se cambia el spec;
- no se muta Supabase Develop;
- no se relaja `expectedFailure`;
- se frena y consulta a Lautaro073.

Esto evita fabricar evidencia RED.

## Plan y bitácora

`docs/implementation-plan.md` quedó alineado con el primer DoD de la ficha: `repository_dispatch`, control plane trusted, payload como dato, build en `127.0.0.1`.

`docs/tasks/log/T-347.md` agregó una sesión append-only con:

- PR293-H01;
- decisiones 0-B / 1-A / 2-A / 3-A;
- corrección documental;
- aclaración de que T-347 todavía no está implementada;
- siguiente paso: Ronda 2.

## CI exact-head

Sobre `92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952`, CI run `37576612007`:

| Check | Resultado |
|---|---|
| lint | ✅ |
| typecheck | ✅ |
| build | ✅ — Compiled successfully in 21.2s |
| unit | ✅ — 123/123 archivos, 1941/1941 tests |
| verify-fichas | ✅ — 7/7 |
| verify-workflows | ✅ — 57/57 |
| ADR | ✅ — 6/6 |
| db-tests | ✅ — 19 archivos / 1853 tests |
| tipos DB | ✅ — sin drift |
| audit | ✅ |
| bundle-budget | ✅ advisory |
| Vercel | ✅ |
| e2e-preview | ✅ |

El bundle advisory conserva la deuda preexistente de rutas admin/`login/mfa`; esta PR documental no modifica el bundle.

`approval-policy` estaba rojo únicamente porque el body seguía conteniendo el informe de Ronda 1 “CON BLOQUEANTES”. Se corrige al publicar este cierre.

## Cierre

La ficha queda internamente consistente y suficientemente específica para implementar T-347 sin volver a decidir arquitectura.

#289 debe permanecer abierto después de mergear esta PR porque la implementación todavía no existe.

La revisión independiente no aprobó ni mergeó la PR.
