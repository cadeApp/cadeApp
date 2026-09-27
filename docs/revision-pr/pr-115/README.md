# PR #115 — CC-012 · Contrato de incidentes

> 🔴 **Ronda 1 — CON BLOQUEANTES (5)**

| | |
|---|---|
| PR | #115 |
| Rama | `cc/CC-012-incidents` → `develop` |
| SHA funcional revisado | `c4b8734e55b46bbdc0cf35d905ee7191dd7c0b03` |
| Base | `develop@5772cb3b1eef7a91a5d0a5a61d2d8cbb0fa5ae28` |
| Estado | Draft |
| CI | typecheck ✅ · lint ✅ · unit ✅ · build ✅ · audit ✅ · bundle-budget ✅ · db-tests ❌ |
| Resultado | 5 bloqueantes; no mergear todavía |

## Decisiones ya resueltas

Se validan las decisiones de T-124 que originaron el CC:

- D05-A: merchant dueño reporta en `matched`, `in_transit` y hasta 24 h post-`delivered`; courier asignado solo en `matched`/`in_transit`; admin no reporta.
- D06-A: `preventive_suspension` se ejecuta dentro de `admin_resolve_incident` y deriva el courier server-side.
- D07-A: un único CC cubre resolución, RLS/RPC y keyset estable.
- D08: no se exige visto bueno P2/P3 para una PR de Lautaro073.

No quedan decisiones humanas pendientes en esta ronda.

## Lo correcto del SHA revisado

La implementación SQL de `report_incident`, `admin_resolve_incident`, RLS y `admin_list_incidents` coincide en lo sustancial con D05-A/D06-A/D07-A. Los pgTAP nuevos de `rls_matrix.sql`, `rpc_admin.sql` y `rpc_requests.sql` pasan en CI.

El problema está en compatibilidad de la suite completa, evidencia obligatoria y fidelidad del fake de dominio.

## Bloqueantes

- **H01:** `structure.sql` conserva `kind='delay'`; rompe el nuevo constraint canónico y hace fallar `db-tests`.
- **H02:** las mutaciones M1–M5 exigidas por la revisión siguen sin evidencia RED→GREEN.
- **H03:** el fake permite que un courier reporte solo por `assignedCourierId`, sin una oferta `accepted` real.
- **H04:** el fake no aplica el gate de consentimiento CC-007 a `report_incident`, y falta un control focal de esa regresión.
- **H05:** el fake convierte timestamps a `Date`/milisegundos y pierde la precisión de microsegundos que el SQL preserva para el keyset.

## Estado de T-124

Durante esta revisión se corrigió metadata del issue #27: quedó `P1 · fase-1 · bloqueada` mientras CC-012 siga abierto. No se tocó código del autor para hacerlo.

No se aprueba ni mergea PR #115 en esta ronda. T-124 permanece bloqueada.

Detalle: [revisiones/ronda-1.md](revisiones/ronda-1.md)
