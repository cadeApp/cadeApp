# PR #617 / T-407 — Ronda 3 de seguimiento (2026-11-05)

**SHA de implementación revisado:** `d0b408f03aa7ff3e88b82401be69d5b62834e77d` (commit de código/bitácora posterior al revisor `9139cc2b`). **Resultado: SIN BLOQUEANTES NI MEJORAS ABIERTAS EN CÓDIGO. CI Y E2E PENDIENTES DEL SHA.** No se aprueba ni mergea.

## Alcance exacto

- El HEAD de la PR se comprobó en `d0b408f03aa7ff3e88b82401be69d5b62834e77d`, abierta y `mergeable=true` según GitHub, sin inferir `git merge-tree` local.
- Diff desde el commit de revisión de ronda 2 `9139cc2b`: **tres archivos**, todos permitidos: `src/features/admin/copy.ts` (+5), `src/features/admin/audit-format.test.ts` (+15), `docs/tasks/log/T-407.md` (+13). `docs/revision-pr/**` se mantuvo intacto en la rama del autor.
- La corrección es exclusivamente de H03; el código de H01/H02 revisado en ronda 2 no se tocó. La decisión D01=B (nota de inmutabilidad diferida a T-408) sigue autorizada y no se reabre.

## PR617-H03 — arreglado-verificado (batería independiente acotada)

**Síntoma de ronda 2:** A06 mostraba `open`, `reviewing`, `resolved`, `dismissed` en inglés porque faltaban en `ADMIN_COPY.audit.values`.

**Cambio:** el mapa de `src/features/admin/copy.ts` contiene `open:'Abierto'`, `reviewing:'En revisión'`, `resolved:'Resuelto'`, `dismissed:'Cerrado sin sanción'`, iguales a `INCIDENTS_COPY.statuses` en A05. No cambia `auditActionLabel`, `auditActionTone`, RPC, BD ni componentes.

**Test del autor, inspeccionado:** `describeAuditChange` en `src/features/admin/audit-format.test.ts` cubre la transición `open→resolved` (Abierto→Resuelto) y `reviewing→dismissed` (En revisión→Cerrado sin sanción). No se debilitó el test existente de H01/H02, ni se introdujo lógica específica para test.

**Ejecución realmente hecha por el revisor:** conector GitHub trajo el SHA; se extrajeron **literalmente** los cuerpos de `describeAuditChange` y `formatAuditValue` del archivo y el mapa del mismo SHA, se ejecutaron en V8 en cuatro escenarios: `open→resolved`, `reviewing→dismissed`, `open→dismissed`, y estado `dismissed` solo en `after`. **4/4 GREEN**, más comparación exacta de los cuatro valores con el mapa canónico de A05.

**Mutaciones independientes del revisor (en memoria, sin modificar la rama):** (1) `dismissed:'Desestimado'`; (2) `resolved:'resolved'`; (3) omitir la entrada `dismissed`. Cada una cambia el resultado esperado y el oráculo detecta el defecto. La primera coincide en objetivo con la del autor pero aquí se volvió a ejecutar sobre la función real en un harness independiente; las otras dos son distintas.

**Reportado por el autor, no ejecutado por el revisor:** test antes del arreglo RED `expected { before: 'open', after: 'resolved' } …` → GREEN; suite admin `463 passed`, typecheck/lint OK; mutación `dismissed:'Desestimado'` RED `1 failed | 9 passed`, restaurada. La bitácora contiene estas líneas; no se atribuyen esas corridas de Vitest al revisor.

## Gates y seguimiento

- El CI oficial [run #42116063239](https://github.com/cadeApp/cadeApp/actions/runs/42116063239) del SHA `d0b408f03aa7ff3e88b82401be69d5b62834e77d` se observó **in_progress** al momento de documentar; sin conclusión. Los estados verdes de Vercel corresponden a deploy ignorado y no confirman E2E.
- `e2e-preview` del SHA aún sin GREEN confirmado: el autor reportó cola compartida y ejecución anterior del E2E del SHA `8116e239`; ese resultado antiguo **no** certifica el nuevo SHA.
- No hubo clon/local Vitest/Playwright ni uso de Docker/Supabase por el revisor. La ejecución V8 certifica los comportamientos de H03 que se extrajeron, pero no reemplaza los gates oficiales.
- El issue [#621](https://github.com/cadeApp/cadeApp/issues/621) queda como seguimiento de H03 hasta que la PR sea incorporada a `develop`; no conviene cerrar el issue solo por existir el fix en una rama no mergeada.

## Próximo paso

Al recibir el resultado del gate: comprobar CI completo y `e2e-preview` para `d0b408f03aa7ff3e88b82401be69d5b62834e77d` (incluyendo nuevo spec de auditoría), revisar conclusión/errores del run real y cualquier commit funcional posterior. Si todo está verde, actualizar documentación de cierre y dejar explícita la aptitud para merge sin efectuar merge ni aprobar la PR. Si falla, reportar defecto verificable sin alterar los tests ni su evidencia.
