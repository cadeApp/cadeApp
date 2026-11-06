# PR #631 — CC-046 · Sheet side="right" apoyado en el borde derecho

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/631 |
| Contrato | CC-046, issue #630; dependencia T-405 / PR #629 |
| Autor | @Lautaro073 |
| Rama | cc/CC-046-sheet-lado-derecho → develop |
| SHA funcional revisado | 83deda5662462550816c579d49dfe9dfbccb9d7c |
| Base funcional original | fbd751aace5bcd476400ddad6ec40b29864c610f |
| Aprobación P2 registrada | a7eb631573010f05984703ae1d4040287d24255f (solo documentación) |
| Tamaño del diff funcional | 4 archivos, +174 / -1 |
| Resultado ronda 1 | CON BLOQUEANTES (3); NO APROBADO |

## Rondas

| Ronda | SHA de código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | 83deda5662462550816c579d49dfe9dfbccb9d7c | 3 bloqueantes | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | f54dc9344c69769474b01d845747591b6e68b503 | H01–H03 corregidos por inspección; CI bloqueado por T-424 externo | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Prioridad | Estado | Síntesis |
|---|---|---|---|
| PR631-H01 | medio, bloqueante | arreglado-sin-verificar | Falta demostrar el foco recuperado después de Escape |
| PR631-H02 | medio, bloqueante | arreglado-sin-verificar | Falta comprobación geométrica a 390 px |
| PR631-H03 | medio, bloqueante | arreglado-verificado (API) | Falta bitácora de CC-046 exigida por #630 |

Detalle: [hallazgos.jsonl](hallazgos.jsonl) · evidencia y harness: [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## CI del SHA funcional y dependencia externa

- CI oficial 42182058746: success (build, typecheck, lint, unit, db-tests, audit y bundle-budget).
- Unit: 194 archivos y 3657 tests pasados según log oficial.
- Gate e2e-preview 42183187374: failure; 117 passed, 1 failed (T-410/admin-trips, strict locator duplicado), 1 flaky (T-407/admin-audit-filters, strict locator duplicado). Los dos tests de admin-nav-mobile pasaron.
- La relación causal entre esas fallas externas y este diff NO está demostrada. El gate global no es verde. Lautaro073 indicó que investigará antes de ronda 2.
- Develop avanzó después del SHA base; al cierre GitHub informó mergeable y las diferencias nuevas de develop no coincidían con los cuatro archivos funcionales.

## Decisiones tomadas por Lautaro073 (2026-11-06)

- D01: Lautaro073 cumple efectivamente los roles P1/P2/P3; aprobación de P2 en CC-046 registrada como aprobación propia, no como excepción.
- D02=B: crear docs/tasks/log/CC-046.md para la evidencia de implementación; es tarea del autor, no debe inventarla la revisión.

## Secuencia

1. Autor hace git pull de esta revisión antes de trabajar; sin rebase/force/amend.
2. Corrige PR631-H01/H02, escribe la bitácora real PR631-H03 y reproduce RED→GREEN; no toca docs/revision-pr/**.
3. Nueva ronda independiente sobre nuevo SHA funcional; comprobar E2E y causa del gate rojo. Sin aprobación ni merge hasta entonces.

## Ronda 2 (2026-11-06)

- HEAD funcional: `f54dc9344c69769474b01d845747591b6e68b503`. R1 → R2: solo `src/ui/sheet.test.tsx`, `e2e/specs/admin-nav-mobile.spec.ts` y `docs/tasks/log/CC-046.md`; la carpeta de revisión no fue modificada por el autor.
- **0 bloqueantes nuevos propios de CC-046 por inspección.** H01/H02 implementados, con `src/ui/sheet.test.tsx` **4/4 GREEN en CI**; E2E 390 y foco todavía no verificado en Playwright trusted, pues el CI no llegó al gate.
- **Bloqueo externo de CI:** `unit` rojo en el merge virtual `40270757786435c6261b1db9f3e74ebe8be761e7`: `tools/verify-fichas.test.ts` falla dos casos de T-424 heredado de develop; el CI de develop también estaba rojo. Seguimiento #637. El resultado del gate nuevo sigue **sin ejecutarse** por CI rojo: no es un resultado verde.
- QA externo: T-410 se sigue en #585 (actualizado), T-407 en #636 (creado). No modificar esas suites dentro de CC-046.
- **No mergear ni aprobar** hasta corregir T-424 en un PR separado, integrar develop en CC-046 y obtener CI y E2E reales satisfactorios o una decisión explícita sobre el fallo externo.
