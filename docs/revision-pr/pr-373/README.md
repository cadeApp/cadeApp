# PR #373 — CC-026 · Reconciliación transaccional de expiraciones

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/373 |
| Responsable / issue | @Lautaro073 · CC-026 / #371 |
| Tarea dependiente | @KiraK72 · T-366 / #355, `bloqueada` |
| Rama | `cc/CC-026-reconciliacion-expiraciones` → develop |
| HEAD código R4 inspeccionado | `23e394f828df3872a5681c4cdadf2da9eb3db399` |
| Resultado | R4 sin nuevos bloqueantes técnicos; A01/A02 ratificadas como D1-A/D2-A; no merge |

## Historial de rondas

- [R1](revisiones/ronda-1.md) · `eadaf545` · H01–H04.
- [R2](revisiones/ronda-2.md) · `f62a385` · H05–H10.
- [R3](revisiones/ronda-3.md) · `f30193d` · H11–H12.
- [R4](revisiones/ronda-4.md) · `23e394f` · H01–H12 corregidos por inspección y CI verde, sin pruebas propias ejecutadas; **A01/A02 decisiones pendientes**.

[Hallazgos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

**CI SHA `23e394f`:** lint/typecheck/build/unit/audit/db-tests/bundle-budget SUCCESS; CC-026 pgTAP 54/54, full pgTAP 2259 tests, 2348 unit tests, harness de dos conexiones y tipos generados consistentes. E2E Preview queda deliberadamente BLOCKED por migración pendiente en Develop; approval-policy FAIL por informe sin bloqueantes aún pendiente.

**Pendiente:** decidir explícitamente ratificación D1 y D2. PR sigue Draft; CC #371 no se cierra; issue T-366 #355 conservó Kira y fue restaurado a `bloqueada`.

## Cierre de alcance R4 — decisiones ratificadas

[Lautaro073 autorizó explícitamente **D1-A y D2-A**](https://github.com/cadeApp/cadeApp/pull/373#issuecomment-6199481008), enlazado también [en issue #371](https://github.com/cadeApp/cadeApp/issues/371#issuecomment-6199481799). Se conservan el runner de CI de CC-026 y la corrección puntual de `docs/master-plan.md:98` ya implementados y verdes en HEAD técnico `23e394f`.

- [Anexo de cierre de R4](revisiones/ronda-4-cierre-decisiones.md) · **A01 y A02 aceptados (alcance resuelto)**; no hay nuevos bloqueantes técnicos probados en R4.
- CI de implementación verificada mediante logs, no ejecución local independiente; E2E Preview sigue bloqueado por migración aún no desplegada en Develop y no debe presentarse como PASS.
- `approval-policy` necesitaba el informe completo en el cuerpo de la PR. No usar el nombre T-366 sin acotar a la dependencia CC-026. Sin merge, sin aprobación y T-366 queda `bloqueada` con @KiraK72.
