# Lecciones de PR #742 — Ronda 1

Esta ronda documental no crea numeración AG nueva: existen `pr-82/AG-97` y ramas paralelas; no se consultó el máximo de *todas* las refs remotas. Se evita colisionar como pasó con `pr-63/AG-64`, `pr-68/AG-65` y `pr-75/AG-64`.

1. **Elegibilidad nueva implica mecanismo de reparación.** PR742-H01: comprobar que un estado bloqueado conserve una transición autorizada para corregir la causa, sin rebajar el requisito de seguridad. No basta con especificar un predicado fail-closed; hay que enumerar productores/consumidores y transiciones accesibles. Conecta con `pr-63/AG-64`, pero aquí la dependencia es entre RPCs de documentos y reinstatement.
2. **Los datos disponibles en UI no se presumen por la presencia de un listado.** PR742-H02: el contrato promete `purged_at IS NULL` mientras la proyección admin omite esa columna. La fuente autoritativa es la base; el reflejo necesita información completa y tests de query. Refuerza `pr-82/AG-77` y `pr-62/AG-59` (paridad entre implementaciones).
3. **Cada acción visible necesita su propia mutación.** PR742-H03: una mutación de Aprobar no demuestra que Rehabilitar esté protegida. Refuerza `pr-64/AG-62`, `pr-64/AG-63` y `pr-82/AG-76`.
4. **Selección automática ≠ consentimiento humano.** PR742-H04: la procedencia de decisiones debe sobrevivir en contrato, ficha, plan y comentario. D4-C/D5-A/D6-A fueron elegidas automáticamente; nadie puede señalarlas como aprobaciones personales. Distinguir `seleccionada automáticamente` de `ratificada` evita implementar como si se hubiera autorizado una ampliación.
5. **Un fixture que viola un índice no prueba la guarda de la RPC.** PR742-H05: si el caso falla antes del código bajo prueba, la señal RED no acredita esa guarda. Relacionado con `pr-63/AG-68` y `pr-68/AG-75`.
6. **No elevar un riesgo teórico a defecto demostrado.** PR742-H06: el cron no comparte lock, pero falta demostrar fila vigente con `purge_after` vencido. Corresponde proponer prueba de alcanzabilidad, no exigir refactor indiscriminado.

**Proceso:** revisión hecha con herramientas de GitHub y probes documentales en memoria; sin clon local, sin db-tests reproducidos. Las verificaciones no se inflan con el conteo de tests que declara el autor.
