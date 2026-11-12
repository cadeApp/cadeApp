# Revisión independiente — PR #698 / T-432 / CC-049

- **PR:** https://github.com/cadeApp/cadeApp/pull/698 · **Autor:** @Lautaro073
- **Rama:** `feat/T-432-sec07-push-hardening` → `develop` (base `28de2b98dd4f1bff6320a4b313748359293025b2`).
- **Ronda 1:** `e77beb59` → dos bloqueantes de cobertura, [informe](revisiones/ronda-1.md).
- **Ronda 2:** `69fdfd852873bb01bf7cc2411f3cf1a7bea091b8` → **H01/H02 corregidos y verificados con harness independiente aislado + CI unit**. [Informe de ronda 2](revisiones/ronda-2.md).
- **Estado global:** **SIN BLOQUEANTES DE CÓDIGO DE T-432 PENDIENTES, PERO NO APTO PARA MERGE: build falló en CI del SHA revisado** (`next/font` Montserrat, sin atribución causal a esta PR). `bundle-budget` skipped. Requiere CI GREEN posterior para cerrar el gate.

| ID | Hallazgo | Estado |
|---|---|---|
| PR698-H01 | Intento `blocked` sin `endpoint` en JSON de `/api/push/send` | **Arreglado-verificado** en `69fdfd85` (aislado, con límites declarados) |
| PR698-H02 | 3xx contado como fallo sin baja en emisor | **Arreglado-verificado** en `69fdfd85` (aislado, con límites declarados) |
| PR698-A01 / D01-A | Whitelist de `cc040-announcements.test.ts` | **Aceptada**; según bitácora, el agente la tomó automáticamente con autorización permanente declarada; **no fue elección expresa de Lautaro073 en esa sesión**. Fe de erratas respecto de ronda 1. |

**CI 69fdfd85:** [run 43172625497](https://github.com/cadeApp/cadeApp/actions/runs/43172625497) — unit **204/3864** PASS; db-tests **46/3858** PASS con preservación; typecheck, lint, audit PASS; **build FAIL** (`next/font`), bundle-budget SKIPPED. No se presume GREEN global.

**Evidencia propia:** un harness Node (script completo en [comandos.md](evidencia/comandos.md)) compiló fragmentos exactos de `POST` y `sendPushNotification` obtenidos de la fuente del SHA. Baseline GREEN, H01 leak RED, H02 cambio `<300`→`<400` RED solo en 300/302/399, restaurado GREEN. Es un ensayo de **funciones aisladas**, no Vitest local ni Next real. Los mutantes Vitest 1/54 y 3/52 son reportados por el autor en bitácora, no repetidos por el revisor.

**Próxima acción:** se disparará automáticamente CI nuevo por el commit de estos documentos. Revisar que `build` y `bundle-budget` terminen GREEN. Si vuelve a fallar `next/font`, reejecutar manualmente el job o investigar fuera del alcance de esta PR con autorización previa. No aprobar/mergear antes. Revisiones/documentación no deben alterar código de producto.

[Hallazgos estructurados](hallazgos.jsonl) · [Lecciones](lecciones.md) · [Evidencia y script completo](evidencia/comandos.md).
