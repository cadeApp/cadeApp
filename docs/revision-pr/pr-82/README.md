# Revisión PR #82 — [T-204] Datos en vivo con TanStack Query

- **PR:** #82
- **Tarea:** `T-204`
- **Autor / Zona:** `asako669` (P2)
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **Ubicación vigente de la revisión:** esta misma rama del PR, según la instrucción de revisión vigente de Lautaro073.
- **Estado actual:** ❌ **CON BLOQUEANTES** (Ronda 14: 2 bloqueantes, 0 decisiones pendientes)

## Decisiones de Lautaro073

- **D01 / 1-A:** cablear `CourierFeed` en T-204.
- **D02 / 2-A:** mantener `useTrip` con fuente real; no refetch al snapshot.
- **D03 / 1-A:** lecturas/refetch vivos por frontera server/API; errores reales de Query.
- **D04 / 1-A:** paginación end-to-end de las dos listas vivas, máximo 50, cursor `created_at/id`.
- **D05 / 1-A:** mantener presupuesto First Load JS <=180 kB; sin excepción.
- **D06 / 1-A:** mantener `src/features/offers/index.ts` como entry point cliente legal y adelgazar su superficie pública según consumidores externos reales.

## Nota de proceso

Rondas 4–12 se escribieron inicialmente en `docs/revisiones` bajo el criterio anterior de ubicación. En R13 se incorporan esos archivos históricos, sin reescribir su contenido, a la rama del PR para ajustarse a la instrucción vigente: **los entregables de revisión viven siempre en la rama del PR**.

## Historial de rondas

| Ronda | Fecha | SHA revisado | Resultado | Bloqueantes | Decisiones |
|---|---|---|---|---:|---:|
| [Ronda 1](revisiones/ronda-1.md) | 2026-09-24 | `a2ab69a` | ❌ | 6 | 0 |
| [Ronda 2](revisiones/ronda-2.md) | 2026-09-25 | `d085677` | ❌ | 6 | 2 |
| [Ronda 3](revisiones/ronda-3.md) | 2026-09-25 | `d439457` | ❌ | 3 | 0 |
| [Ronda 4](revisiones/ronda-4.md) | 2026-09-26 | `4af4186` | ❌ | 3 | 1 |
| [Ronda 5](revisiones/ronda-5.md) | 2026-09-26 | `a2845da` | ❌ | 5 | 0 |
| [Ronda 6](revisiones/ronda-6.md) | 2026-09-26 | `6c52a31` | ❌ | 1 | 1 |
| [Ronda 7](revisiones/ronda-7.md) | 2026-09-26 | `10e25ff` | ❌ | 4 | 0 |
| [Ronda 8](revisiones/ronda-8.md) | 2026-09-27 | `a340745` | ❌ | 1 | 0 |
| [Ronda 9](revisiones/ronda-9.md) | 2026-09-27 | `754161b` | ❌ | 2 | 0 |
| [Ronda 10](revisiones/ronda-10.md) | 2026-09-27 | `8cf71ed` | ❌ | 1 | 0 |
| [Ronda 11](revisiones/ronda-11.md) | 2026-09-27 | `828671b` | ❌ | 1 | 1 |
| [Ronda 12](revisiones/ronda-12.md) | 2026-09-27 | `cb7eab9` | ❌ | 1 | 0 |
| [Ronda 13](revisiones/ronda-13.md) | 2026-09-27 | `9b6ea30` | ❌ | 1 | 0 |
| [Ronda 14](revisiones/ronda-14.md) | 2026-09-27 | `c6b6d81` | ❌ | 2 | 0 |
