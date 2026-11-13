# Lecciones de PR #742 — Ronda 1

Esta ronda documental no crea numeración AG nueva: existen `pr-82/AG-97` y ramas paralelas; no se consultó el máximo de *todas* las refs remotas. Se evita colisionar como pasó con `pr-63/AG-64`, `pr-68/AG-65` y `pr-75/AG-64`.

1. **Elegibilidad nueva implica mecanismo de reparación.** PR742-H01: comprobar que un estado bloqueado conserve una transición autorizada para corregir la causa, sin rebajar el requisito de seguridad. No basta con especificar un predicado fail-closed; hay que enumerar productores/consumidores y transiciones accesibles. Conecta con `pr-63/AG-64`, pero aquí la dependencia es entre RPCs de documentos y reinstatement.
2. **Los datos disponibles en UI no se presumen por la presencia de un listado.** PR742-H02: el contrato promete `purged_at IS NULL` mientras la proyección admin omite esa columna. La fuente autoritativa es la base; el reflejo necesita información completa y tests de query. Refuerza `pr-82/AG-77` y `pr-62/AG-59` (paridad entre implementaciones).
3. **Cada acción visible necesita su propia mutación.** PR742-H03: una mutación de Aprobar no demuestra que Rehabilitar esté protegida. Refuerza `pr-64/AG-62`, `pr-64/AG-63` y `pr-82/AG-76`.
4. **Selección automática ≠ consentimiento humano.** PR742-H04: la procedencia de decisiones debe sobrevivir en contrato, ficha, plan y comentario. D4-C/D5-A/D6-A fueron elegidas automáticamente; nadie puede señalarlas como aprobaciones personales. Distinguir `seleccionada automáticamente` de `ratificada` evita implementar como si se hubiera autorizado una ampliación.
5. **Un fixture que viola un índice no prueba la guarda de la RPC.** PR742-H05: si el caso falla antes del código bajo prueba, la señal RED no acredita esa guarda. Relacionado con `pr-63/AG-68` y `pr-68/AG-75`.
6. **No elevar un riesgo teórico a defecto demostrado.** PR742-H06: el cron no comparte lock, pero falta demostrar fila vigente con `purge_after` vencido. Corresponde proponer prueba de alcanzabilidad, no exigir refactor indiscriminado.

**Proceso:** revisión hecha con herramientas de GitHub y probes documentales en memoria; sin clon local, sin db-tests reproducidos. Las verificaciones no se inflan con el conteo de tests que declara el autor.

## Ronda 2 — Nuevas lecciones (sin asignar AG-YY no verificados)

- **R2-L01 (PR742-R01):** cuando un estado está excluido, no prometer una transición de reparación que las RPC anteriores bloquean. Comprobar CC-043/050, no solo el nuevo writer. En D7-A la cuenta original DNI liberado queda fuera de T-437.
- **R2-L02 (PR742-R02):** una RPC puede tener **dos controles visuales distintos**. Se necesitan targets reales (`Reactivar repartidor` / `Reconsiderar aprobación`), mutaciones y RED para **ambos**; no solo un nombre genérico «Rehabilitar». Refuerza `pr-64/AG-62` y `pr-82/AG-76`.
- **R2-L03 (PR742-R03):** registrar qué chequea Storage (`is_courier` = rol/carpeta) y qué chequea la RPC (`consent_status` = active); no atribuirle al helper un control que no hace.
- **Proveniencia:** D7-A fue selección automática del agente; D8-B reconoce incapacidad del agente de ratificar por Lautaro073. D1-A…D7-A siguen sin ratificación humana explícita.
- **No exagerar checks:** CI cancelada, 123 tests declarados solo por el autor; 7/7 mutaciones de documentación RED sí comprobadas por revisión; no valida SQL ni React.

## Ronda 3 — Errata de revisión y buenas prácticas

- **R3-L01 / PR742-R03: retractación.** La lección R2-L03 se basó en la función **anterior** `is_courier()` de `rls_v1.sql`. **CC-007 la redefinió con rol y consentimiento activo** y ninguna de las 47 migraciones posteriores revierte esa guarda. El hallazgo R03 fue un falso positivo **del revisor**, no del autor. Queda en el histórico con `falso_positivo:true`, no usarlo para imputar fallas al agente. Para revisar SQL, reconstruir la definición **vigente por orden de migraciones**, nunca leer solo la primera ocurrencia.
- **R3-L02 / H03/R02:** una RPC compartida puede tener tres botones con handlers, estados y labels separados. El manifest tiene una prueba por entrada: exigir mutante por rama y RED real de `toBeDisabled`.
- **R3-L03 / H04:** D7-A y D1-A…D6-A siguen como elecciones automáticas; D8-B es constancia de no ratificación. Sin casillas aprobadas, ningún agente autoriza merge.
- **R3-L04 / alcance de evidencia:** 123 tests son declaración de bitácora; los probes del revisor son textuales y no prueban pgTAP, E2E, transacciones ni seguridad en runtime.
- **R3-L05 / datos:** `origen` es enum sin categoría «error del revisor»; se mantiene por compatibilidad con el analizador y se añade `falso_positivo: true` y `rectificado_por: revisor`. Excluir R03 de cálculos de culpa hasta que el agregador admita rectificaciones.
