# Revisión PR #82 — [T-204] Datos en vivo con TanStack Query

- **PR:** #82
- **Tarea:** `T-204`
- **Autor / Zona:** `asako669` (P2)
- **Rama:** `feat/T-204-realtime-tanstack` → `develop`
- **Ubicación vigente de la revisión:** rama `docs/revisiones` (PR de P2; desde R4 se aplica `COMO-ENTREGAR.md` vigente).
- **Estado actual:** ❌ **CON BLOQUEANTES** (Ronda 5: 5 bloqueantes, 1 mejora, 0 decisiones pendientes)

## Decisiones de Lautaro073

- **D01 / 1-A:** cablear `CourierFeed` en T-204.
- **D02 / 2-A:** mantener `useTrip` con fuente real; no refetch al snapshot.
- **D03 / 1-A (Ronda 4):** mover las lecturas/refetch vivos de los tres hooks a frontera server/API; `useTrip` usa la fuente canónica CC-008 (`getTripDetailsServer`); los errores de fuente son errores de Query, no `[]`/snapshot/null silencioso, y las pantallas muestran error/reintento conservando último dato válido.

## Nota de proceso

Rondas 1–3 quedaron históricamente también en la rama del autor por el procedimiento anterior aplicado en esas sesiones. Desde R4 no se vuelve a mover el HEAD de P2/P3 para guardar la revisión. Este directorio en `docs/revisiones` conserva el historial completo.

## Historial de rondas

| Ronda | Fecha | SHA revisado | Resultado | Bloqueantes | Decisiones |
|---|---|---|---|---:|---:|
| [Ronda 1](revisiones/ronda-1.md) | 2026-09-24 | `a2ab69a` | ❌ | 6 | 0 |
| [Ronda 2](revisiones/ronda-2.md) | 2026-09-25 | `d085677` | ❌ | 6 | 2 resueltas |
| [Ronda 3](revisiones/ronda-3.md) | 2026-09-25 | `d439457` | ❌ | 3 | 0 |
| [Ronda 4](revisiones/ronda-4.md) | 2026-09-26 | `4af4186` | ❌ | 3 | 1 resuelta |
| [Ronda 5](revisiones/ronda-5.md) | 2026-09-26 | `a2845da` | ❌ | 5 | 0 |
