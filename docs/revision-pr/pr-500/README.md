# PR #500 — T-390 / CC-036: ofertas solo por RPC

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/500 |
| Autor | Lautaro073 (P1) |
| Rama → base | `feat/T-390-offers-rpc-only` → `develop` |
| Base revisada | `3db48fbcf9fdebf58648411f8e312a2d94298af3` |
| SHA principal | `e343f3456f540bfdb8195edb57dbc3c171d3d7c8` |
| Tamaño | 4 archivos de tarea, más esta revisión |
| Ronda 1 | **SIN BLOQUEANTES de implementación por inspección; CI de base pendiente de cierre al escribir** |
| Merge | **NO aprobado ni ejecutado** |

## Rondas

- [Ronda 1](revisiones/ronda-1.md) — Inspección de `fdafd1b`, detección de H01 y revalidación de su corrección en `e343f34`.
- [Hallazgos estructurados](hallazgos.jsonl) · [Evidencia y harness](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Estado

| ID | Estado | Verificación |
|---|---|---|
| PR500-H01 | **arreglado-sin-verificar** | Corrección inspeccionada y mutaciones semánticas JS propias; no se ejecutó mutación SQL pgTAP independiente |

No hay nuevas decisiones pendientes. **D01=A fue elegida por Lautaro073**: aceptación explícita del bloqueo `e2e-preview` premerge, manteniendo el gate sin falsos éxitos. Es obligatorio ejecutar `e2e-staging` sobre el SHA realmente desplegado, tras integrar y aplicar la migración en staging y **antes de producción**.

**Atención:** una excepción funcional de la revisión NO anula las reglas de protección de GitHub. Si `e2e-preview` es requerido para merge, hace falta utilizar una excepción oficialmente autorizada; prohibido falsificar un status `success` o apagar el gate. No queda acreditado E2E staging por esta ronda.

**Siguiente paso:** confirmar el `db-tests` del último HEAD, atender el estado de `approval-policy`, y realizar el merge únicamente cuando Lautaro073 lo ordene expresamente y las reglas de GitHub lo permitan. No exigir CI de nuevo *solo* por este commit documental.
