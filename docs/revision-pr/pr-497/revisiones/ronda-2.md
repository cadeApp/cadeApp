# Informe de revisión — PR #497 / CC-036 · Ronda 2

**Fecha:** 2026-10-21 (AR)  
**HEAD verificado documentalmente:** `74ba30a0e46ceda4f1c093c6e0ccbe7922d0d738`  
**Base:** `develop@824c4fdb8a4277220e14b575eaf6a15e40df8406`  
**Resultado: SIN BLOQUEANTES documentales nuevos.**

## Comparación desde ronda 1

| Hallazgo | Estado en esta ronda | Evidencia concreta |
|---|---|---|
| **PR497-H01** — caso 49 omitido | **Corregido** | CC-036 `Impacto exacto` y T-390 `Archivos permitidos` y DoD listan los casos **46, 49, 50, 51**, así como la modificación de `plan()` y de la aserción posterior de mensaje. La fila T-390 de §8 incluye el caso 49. |
| **PR497-H02** — fichas T-408/409 sin fila | **Corregido mediante traslado a #489** | Los archivos `docs/tasks/T-408.md` y `T-409.md` ya no están en #497; la PR #489, HEAD `be515ec74e9f0da54e4f5f709c247250251db8406`, sí incorpora ambos archivos y sus filas en Fase 4. Comparé allí primer DoD y fila: **2/2 idénticos**. |
| **PR497-H03** — DoD desincronizado | **Corregido** | Leí T-390, T-391 y §8 del plan desde `74ba30a0e46ceda4f1c093c6e0ccbe7922d0d738` y ejecuté una comparación exacta de cada primer checkbox con su celda del plan: **2/2 coinciden**. |

El agente resolvió H02 mejor que la sugerencia inicial de integrar PR #489 a esta rama: dejó T-408/T-409 en la PR que posee la Fase 4, evitando duplicaciones y el acoplamiento entre ambos cambios de documentación.

## Sin hallazgos nuevos

La PR #497 ahora contiene CC-036, las fichas T-390 y T-391, las dos filas correspondientes de §8 y los archivos de revisión. No modifica SQL, políticas en ejecución ni código productivo. El contrato incluye la revocación de INSERT/UPDATE/DELETE/TRUNCATE y la eliminación de las cuatro políticas de escritura; queda una tarea independiente T-390 para llevarlo a base y demostrar RED→GREEN con pgTAP. No presento un test SQL como ejecutado en esta ronda.

**Nota PostgreSQL:** `REVOKE` a nivel tabla también revoca los permisos correspondientes de columna; ver https://www.postgresql.org/docs/current/sql-revoke.html. Se retiró ese falso positivo de ronda 1.

## CI y limitaciones

En el instante de esta lectura, los checks de `74ba30a0e46ceda4f1c093c6e0ccbe7922d0d738` muestran `typecheck`, `lint`, `audit`, `build` y `bundle-budget` **success**; `unit` y `db-tests` aún **in_progress**. `approval-policy` sigue rojo porque el informe completo SIN BLOQUEANTES debe publicarse también en el **cuerpo de la PR** (ver `.github/workflows/approval-policy.mjs:23-51`). No corrí tests locales, Docker ni Supabase. No confundí análisis estático con ejecución del producto. No aprobé, no mergeé ni cambié políticas de seguridad.

**Veredicto documental:** SIN BLOQUEANTES. **Condición externa antes del merge:** los checks de código/DB pertinentes deben cerrar verdes sobre el SHA implementado y `approval-policy` debe recibir el informe en el body. Los commits puramente documentales de revisión no requieren una nueva corrida verde por sí solos (regla del proyecto).

## No tocar / fase siguiente

- La implementación de CC-036, corrección real de casos 46/49/50/51 en pgTAP y la prueba de ausencia de privilegios pertenece a T-390, no a esta PR de contrato.
- Las fichas T-408/T-409 y sus filas están en #489; se revisan junto con esa PR por separado.
- No quedan decisiones 🔵 nuevas: la aceptación de riesgo de Fase 4 ya está documentada en la bitácora T-312 de PR #491.

**Archivos de esta ronda:** solo `docs/revision-pr/pr-497/**`. Sin ediciones a los archivos de la tarea.
