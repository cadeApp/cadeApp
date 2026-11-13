# PR #742 — T-437 · CC-052 · B-05

| Dato | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/742 |
| Autor | @Lautaro073 (selecciones documentadas por agente, **no ratificadas personalmente**) |
| Rama | `feat/T-437-b05-verified-documents` → `develop` |
| Base | `22dff3fa93df5c79b88d8021c1267389b2055666` |
| HEAD documental revisado en R3 | `b9bad8bc61b66486b9cf31d01e11013023241ce8` |
| Resultado actual | **0 bloqueantes técnicos; PR742-H04 decisión pendiente** |
| Merge/approval | **NO** |

## Rondas

| Ronda | SHA inspeccionado | Resultado | Informe |
|---|---|---|---|
| 1 | `a8166b5b0f037c561e8652142e90768cda698b37` | 4 bloqueantes + 2 mejoras | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5c8095cb42441245e4d12c45456d496bb4c27b73` | 2 bloqueantes nuevos, 1 mejora | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `b9bad8bc61b66486b9cf31d01e11013023241ce8` | **Sin bloqueantes técnicos; decisión pendiente** | [ronda-3.md](revisiones/ronda-3.md) |

## Estado vigente

- **H01/H02/H05/H06:** arreglados-verificados de contrato/documentación en R2; H05 savepoint afinado en R3. H06 continúa hipótesis para tests de la implementación.
- **H03 y R02:** arreglados-verificados documentalmente en R3: tres mutaciones reales (Aprobar, Reactivar, Reconsiderar).
- **R01:** arreglado-verificado documentalmente en R3: DNI liberado impide subsanación, re-onboarding y rehabilitación de la cuenta original; pruebas negativas descritas.
- **R03:** **falso positivo del revisor en R2, retractado en R3**; la redefinición vigente `CC-007` ya exigía consentimiento en `is_courier()`. CC aclara migraciones y exige chequeo propio de RPC.
- **H04:** **DECISIÓN-PENDIENTE** por ratificación humana de D1-A…D7-A. No es aprobación del agente.
- **M3:** mensaje actualizado para aprobar o rehabilitar.

**D1-A, D2-A, D3-A, D4-C, D5-A, D6-A y D7-A son selecciones automáticas del agente con la opción recomendada, sin aprobación personal explícita de Lautaro073; ratificación pendiente. D8-B: el agente no puede ratificarlas en nombre de Lautaro073.**

En esta PR, «arreglado-verificado» se limita a **comprobaciones de documentación con probes independientes**, no a SQL/E2E ejecutados. R03 conserva su ID histórico y lleva anotación de falso positivo para no ocultar el error de revisión.

## Registro

- [Ronda 1](revisiones/ronda-1.md) · [Ronda 2](revisiones/ronda-2.md) · [Ronda 3](revisiones/ronda-3.md)
- [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md)

La carpeta la escribe la revisión independiente, nunca el agente autoral. La bitácora `docs/tasks/log/T-437.md` pertenece al autor.
