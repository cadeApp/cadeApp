# Evidencia — PR #293

## Ronda 1

HEAD: `dfb5fb1cf9db5013a322c11129b97b063a6ded8b`.

R1 detectó PR293-H01: la ficha confiaba incorrectamente en `workflow_dispatch` como frontera de rama por defecto.

Decisiones de Lautaro073:

```text
0-B → repository_dispatch + e2e.mutation.requested + client_payload { target, mutation }
1-A → catálogo manifest/patches revisado en develop
2-A → next start en 127.0.0.1 dentro del runner
3-A → validación post-merge; reabrir/mantener #289 si no da RED_CONFIRMED
```

## Ronda 2

HEAD funcional: `92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952`.

### Sincronización

```text
develop = 64dfdf653219c6cf08a223c0df829353d9d9d8f1
HEAD    = 92a9f5ee3d5f16b3f4304cfbefb0e0ff5ba80952
ahead   = 3
behind  = 0
```

Desde el commit de revisión R1 `79401ee71fc11644e0ced9a1811b5fc899754f5d`:

```text
docs/implementation-plan.md
docs/tasks/T-347.md
docs/tasks/log/T-347.md
```

No se tocó `docs/revision-pr/**`.

### Barrido del trigger

En `docs/tasks/T-347.md`:

```text
Objetivo: repository_dispatch
Disparo: on: repository_dispatch
type: e2e.mutation.requested
client_payload: target + mutation
Frontera trusted: rama por defecto
DoD estructural: solo repository_dispatch
DoD estructural: sin workflow_dispatch
```

Las únicas menciones actuales de `workflow_dispatch` en la ficha son para prohibirlo.

La bitácora conserva la descripción vieja en la entrada inicial, como exige append-only, y la entrada de R1 documenta la corrección.

### Plan

La fila T-347 de `docs/implementation-plan.md` usa el mismo primer DoD de la ficha:

```text
Workflow trusted e2e-mutation disparado por repository_dispatch
(e2e.mutation.requested), con control plane de la rama por defecto
y target/mutation tratados como datos...
```

### CI exact-head — run 37576612007

```text
lint          success
typecheck     success
build         success — Compiled successfully in 21.2s
unit          success — 123/123 files, 1941/1941 tests
verify-fichas success — 7/7
workflows     success — 57/57
ADR           success — 6/6
db-tests      success — Files=19, Tests=1853, Result=PASS
db types      success — git diff --exit-code sin drift
audit         success
bundle-budget success (advisory)
```

Vercel: success.  
e2e-preview: success.

`approval-policy` falló antes de cerrar R2 porque el body aún contenía el informe R1 con `Resultado: CON BLOQUEANTES`.

## Resultado

PR293-H01 queda `arreglado-verificado` en `92a9f5e`.

No quedan bloqueantes, mejoras ni decisiones pendientes.
