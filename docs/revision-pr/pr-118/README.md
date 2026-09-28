# Revisión independiente — PR #118 · T-206

- **PR:** #118 · `feat/T-206-cableado-push` → `develop`
- **Tarea:** T-206 · Issue #92
- **Ronda actual:** 1
- **SHA de producto revisado:** `f1d2d096cdcddc68633270c5b8b5805b4daff035`
- **develop comparado:** `57badabc28fd3bd8e913674bd80b30feb8828414`
- **Estado:** **CON BLOQUEANTES**
- **Decisión humana:** D01 = **1-A**. Cancelación/expiración notifican solo a actores afectados por esa transición; no a couriers históricos.
- **Aprobación/merge:** no realizados.

## Hallazgos abiertos

- **PR118-H01 · alto · correctness:** `accept_offer` reenvía push en replay `idempotent:true`.
- **PR118-H02 · alto · correctness:** `cancel_request` incluye merchant y todos los couriers históricos.
- **PR118-H03 · alto · correctness:** `request_expired` vuelve a consultar todas las ofertas en vez de usar las filas realmente expiradas.
- **PR118-H04 · alto · test-coverage:** los tests de destinatarios no protegen predicados exactos ni destinatarios extra.
- **PR118-H05 · medio · test-coverage:** falta evidencia de mutaciones RED semánticas sobre el GREEN, incluida la mutación de orden exigida por la ficha.
- **PR118-M01 · medio · conventions:** bitácora/PR dicen `test:db n.a.` aunque la PR toca `src/server/**`; CI db-tests sí pasó.

## Lo que quedó bien por inspección

- Los eventos se construyen con IDs y los contratos de T-203; no se agregan teléfono, dirección, DNI, selfie ni otros datos personales.
- Los call sites principales ejecutan el side effect después de una respuesta de negocio exitosa.
- Las purgas de logout/suspensión/rechazo/suspensión preventiva están ubicadas después del éxito de negocio y son best-effort.
- El sweep conserva la guarda de expiración sobre las filas de solicitudes realmente actualizadas.

## Evidencia de infraestructura

Por política de revisión no se levantó Supabase/Docker local. Se inspeccionó el job `db-tests` de CI asociado al head/merge ref: **Files=12, Tests=1601, Result: PASS**.

La siguiente ronda debe revalidar los arreglos sobre el nuevo SHA y agregar mutaciones independientes nuevas.
