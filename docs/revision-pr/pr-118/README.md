# Revisión independiente — PR #118 · T-206

- **PR:** #118 · `feat/T-206-cableado-push` → `develop`
- **Tarea:** T-206 · Issue #92
- **Ronda actual:** 2
- **SHA de producto revisado:** `aba405dd4544af13d85cdd0b3e26a1f8bca8e07d`
- **develop comparado:** `57badabc28fd3bd8e913674bd80b30feb8828414`
- **Estado:** **CON BLOQUEANTES**
- **Decisión humana:** D01 = **1-A**, sin cambios.
- **Aprobación/merge:** no realizados.

## Estado de Ronda 1

- **H01:** implementación corregida por inspección; el test directo corre verde en CI. Pendiente mutación independiente/reproducible.
- **H02:** implementación corregida por inspección y matriz exacta de destinatarios agregada. El control de `audit_log` quedó incompleto dentro de H04.
- **H03:** reconsulta amplia eliminada y agrupación por filas actualizadas implementada. El arreglo introdujo PR118-R01: fallback condicional de `.select()`.
- **H04:** **parcial**. Publish/submit/accept y conjuntos exactos mejoraron, pero los predicados de `audit_log` siguen sin estar protegidos semánticamente.
- **H05:** **abierto**. La bitácora enumera mutaciones pero no registra las líneas reales RED/GREEN requeridas; la mutación de `decided_at` tampoco es reproducible semánticamente con el mock actual.
- **M01:** corregido; CI del nuevo SHA vuelve a confirmar db-tests PASS.

## Nuevos bloqueantes

- **PR118-H06 · alto · correctness:** un rechazo de `auth.getUser()` ocurre fuera del best-effort y evita `signOut()`.
- **PR118-H07 · alto · correctness:** `accept_offer` y `cancel_request` ignoran errores in-band de los lookups y pueden enviar a un conjunto parcial/incorrecto.
- **PR118-R01 · medio · test-coverage:** el arreglo de H03 agregó un fallback productivo que permite seguir sin `.select('request_id, courier_id')`.

## Mejora

- **PR118-M02:** el cuerpo de la PR quedó desfasado respecto de CI: dice 1254 tests y verify-workflows 21, pero el run del SHA revisado reporta 1255 y 22.

## CI del SHA revisado

Workflow `36380194256`: todos los jobs verdes.

- Unit: 92/92 files, 1255/1255 tests.
- verify-workflows: 22.
- verify-adr: 6.
- db-tests: Files=12, Tests=1601, Result: PASS.
- typecheck/lint/build/audit/bundle-budget: success.

CI verde no cierra los bloqueantes semánticos de esta ronda.
