# Lecciones · PR #610 (T-422)

No se asigna un número AG nuevo solo por esta ronda. Se aplican patrones existentes y se deja el caso para análisis transversal.

1. **P08 / identidad de la evidencia:** comprobar `head_sha` contra una PR abierta no equivale a comprobar que **ese CI** validó **esa PR**. El vínculo `workflow_run.pull_requests` debe verificarse positivamente, incluso si existe otra PR con el mismo commit. Hallazgo `H02` (prueba RED de escenario staging/develop).
2. **P08 / frontera de credenciales:** un test que afirma «secretos solo en el step de E2E» no protege un build que comparte ese step. La granularidad del control debe ser por **operación** (build sin privilegios; runtime/seed con privilegios mínimos). Hallazgo `H01`.
3. **P06 / recursos compartidos:** cualquier cambio de semántica de cola debe enumerar **todos** los workflows que usan el mismo `concurrency.group`. Aquí son `e2e-preview` y `e2e-mutation`; cambiar uno solo no prueba el contrato global. Mejora `H03`, autorizada por D03=B.

**Autocrítica y límite:** no se presenta el CI anterior como prueba real de `workflow_run`, ni mutación estática como ejecución de E2E con base remota. No se numeró un AG nuevo porque todavía no se justificó una regla general adicional distinta de P08/P06.

## Ronda 2 — cierre y alcance de la evidencia (2026-11-04 ART)

En `ce259f7e4c272aa3ebb74b4abbe7bef9f5fd16b7` se reprodujo el caso negativo de H02 con el helper de producción: donde `7c3f6a0` retornaba `match` para un CI de staging con el SHA compartido, `ce259f7` retorna `skip`. Los controles de secretos por step y de concurrencia en ambos workflows dieron GREEN y sus mutaciones independientes dieron RED (27/27 resultados esperados).

No se crea una nueva regla AG: H01 y H02 confirman P08, H03 refuerza P06. **Límite de seguridad:** mover el build a otro *step del mismo job* reduce el acceso directo a variables secretas durante `pnpm build`; **no aísla código potencialmente malicioso de un step posterior del mismo runner**. El modelo actual permite ejecutar código de PR interna en un job de E2E que usa credenciales privilegiadas; requiere confianza en contributors internos, una limitación previa y no una regresión introducida en R2. Si cambia el modelo de amenazas, separar runners/trusted fixture code es una tarea de seguridad diferente.
