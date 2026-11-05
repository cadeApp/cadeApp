# Lecciones · PR #610 (T-422)

No se asigna un número AG nuevo solo por esta ronda. Se aplican patrones existentes y se deja el caso para análisis transversal.

1. **P08 / identidad de la evidencia:** comprobar `head_sha` contra una PR abierta no equivale a comprobar que **ese CI** validó **esa PR**. El vínculo `workflow_run.pull_requests` debe verificarse positivamente, incluso si existe otra PR con el mismo commit. Hallazgo `H02` (prueba RED de escenario staging/develop).
2. **P08 / frontera de credenciales:** un test que afirma «secretos solo en el step de E2E» no protege un build que comparte ese step. La granularidad del control debe ser por **operación** (build sin privilegios; runtime/seed con privilegios mínimos). Hallazgo `H01`.
3. **P06 / recursos compartidos:** cualquier cambio de semántica de cola debe enumerar **todos** los workflows que usan el mismo `concurrency.group`. Aquí son `e2e-preview` y `e2e-mutation`; cambiar uno solo no prueba el contrato global. Mejora `H03`, autorizada por D03=B.

**Autocrítica y límite:** no se presenta el CI anterior como prueba real de `workflow_run`, ni mutación estática como ejecución de E2E con base remota. No se numeró un AG nuevo porque todavía no se justificó una regla general adicional distinta de P08/P06.
