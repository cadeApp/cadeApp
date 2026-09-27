# PR #113 — T-124 · Incidentes

> 🔴 **Ronda 1 — CON BLOQUEANTES**

| | |
|---|---|
| PR | #113 |
| Rama | `feat/T-124-incidentes` → `develop` |
| SHA funcional revisado | `3ef389de515f01b03a7aff88982b0b32b5f91c4d` |
| Base | `develop@47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a` |
| Estado | Draft · fase RED |
| CI | typecheck ✅ · lint ✅ · build ✅ · audit ✅ · db-tests ✅ · bundle-budget ✅ · unit ❌ esperado |
| Unit | 73 archivos verdes · 7 rojos / 897 tests verdes · 94 rojos |
| DB | 12 archivos · 1529 tests · PASS |
| Resultado | 8 hallazgos bloqueantes antes de GREEN |

## Decisiones humanas

- **D05-A:** puede reportar el merchant dueño en `matched`/`in_transit` y hasta 24 h después de `delivered`; el courier asignado solo en `matched`/`in_transit`; admin no reporta.
- **D06-A:** «Suspensión preventiva» es una resolución atómica de `admin_resolve_incident`: la RPC deriva el courier desde el incidente, suspende, retira ofertas, resuelve y audita en una transacción. La UI no envía `courierId`.
- **D07-A:** un único contract-change de incidentes antes de GREEN cubre `admin_resolve_incident`, endurecimiento RLS/RPC de `report_incident`, pgTAP y el índice/cursor estable de la bandeja.
- **D08:** el cruce de `src/app/trips/[id]/page.tsx` se documenta, pero no requiere visto bueno de P2 para una PR de Lautaro073.

## Estado

La fase RED es auténtica: los stubs/rutas faltantes provocan los 94 fallos de T-124 y 897 tests ajenos permanecen verdes. Sin embargo, los controles actuales dejan huecos de autorización, contrato, paginación y accesibilidad que podrían permitir una implementación GREEN incorrecta.

No implementar GREEN todavía. Primero:
1. crear/mergear el contract-change de D07-A;
2. completar los controles RED H03–H08;
3. demostrar las mutaciones indicadas;
4. recién después implementar T-124.

Detalle: [revisiones/ronda-1.md](revisiones/ronda-1.md)
