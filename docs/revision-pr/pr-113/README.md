# PR #113 — T-124 · Incidentes

> 🔴 **Ronda 2 — CON BLOQUEANTES (2)**

| | |
|---|---|
| PR | #113 |
| Rama | `feat/T-124-incidentes` → `develop` |
| SHA funcional revisado | `32d56c44a67b83de782086e0f9e176490c088d88` |
| Base | `develop@aae504a218b8b76e2d6cd0f56d8b5189e5b8b4fd` |
| Estado | Draft · GREEN implementado |
| CI | typecheck ✅ · lint ✅ · unit ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ con warning |
| Unit | 92 archivos · 1225 tests PASS |
| DB | 12 archivos · 1601 tests PASS · db:types sin drift |
| Resultado | H01–H08 cerrados; H09–H10 bloquean el cierre |

## Decisiones ya resueltas

- **D05-A:** merchant dueño reporta en `matched`/`in_transit` y hasta 24 h post-`delivered`; courier asignado solo en `matched`/`in_transit`; admin no reporta.
- **D06-A:** `preventive_suspension` vive en `admin_resolve_incident`; la UI nunca envía `courierId`.
- **D07-A:** CC-012 mergeado en `aae504a` aporta resolución, seguridad RLS/RPC e índice/keyset estable.
- **D08:** el cruce de `src/app/trips/[id]/page.tsx` no requiere aprobación P2/P3 para Lautaro073.

## Ronda 2

Los ocho hallazgos de R1 quedaron corregidos y verificados:
- H01/H02 + DB de H06: resueltos por CC-012.
- H03: no existe camino separado de suspensión ni `courierId` de cliente.
- H04: Zod es fuente de verdad.
- H05: wiring real actor/estado/fecha.
- H06: cursor compuesto consumiendo `admin_list_incidents`.
- H07: happy path exacto de `adminResolveIncidentRpc`.
- H08: Dialog Escape/Cancelar+foco y loading/error funcionales.

Quedan dos bloqueantes nuevos:
- **H09:** el DoD visual está marcado como verificado pero PR/bitácora no contienen enlaces persistentes a las capturas, en contra de `docs/design/visual-task-directive.md §8`.
- **H10:** `/trips/[id]` subió de 187 kB en la fase RED previa al wiring GREEN a 194 kB final. Es una ruta comercio/repartidor y la Regla 25 fija 180 kB. R2 exige, como mínimo, eliminar el delta de T-124 y volver a ≤187 kB sin ampliar scope; idealmente ≤180 kB.

No aprobar ni mergear todavía.

Detalle: [revisiones/ronda-2.md](revisiones/ronda-2.md)
