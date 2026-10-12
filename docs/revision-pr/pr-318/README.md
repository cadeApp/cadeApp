# PR #318 — T-340 · Paso 2/4 — Lectores multi-drop

**PR:** https://github.com/cadeApp/cadeApp/pull/318 · **Rama:** `feat/T-340-lectores` → `develop`.
**Estado: Draft / CON BLOQUEANTES de Paso 2 / NO MERGEAR.**
**Autorizaciones del usuario:** R4 opción A: `get_trip_details` con `drops[]` y salida legacy escalar desde primer drop sin fallback a columnas DB legacy. **R5 opción A:** permitir ajustes de fixtures (nunca aserciones) de `supabase/tests/cc008_trip_details.sql` y `supabase/tests/cc023_private_columns.sql`. Ambas en ficha `docs/tasks/T-340.md` de la PR.

## Rondas

| Ronda | SHA implementación | Dictamen | Documento |
|---|---|---|---|
| 1 | `4e70e934` | H01 Gate 0 pendiente | [R1](revisiones/ronda-1.md) |
| 2 | `9c5e797` | H01 verificado, H02 RED pendiente | [R2](revisiones/ronda-2.md) |
| 3 | `e61fab67` | Gate 0 H01+H02 cerrados | [R3](revisiones/ronda-3.md) |
| 4 | `c7cab174` | 7 bloqueantes H03–H09 | [R4](revisiones/ronda-4.md) |
| **5** | **`58811a30`** | **H03 y H08 verificados; H04–H07 parciales, H09 pendiente, H10 nuevo bloqueo de acción multi-drop; db-tests FAIL** | **[R5](revisiones/ronda-5.md)** |

## R5 — detalles que faltan

- **H03 (✅):** RPC `mark_drop_*` manda solo parámetros SQL reales; `unit` PASS y assertions estrictas de argumentos.
- **H04 (🟡):** `get_trip_details` ahora devuelve `drops[]` ordenados sin columnas legacy DB; tests viejos `cc008_trip_details.sql` y `cc023_private_columns.sql` crean requests sin child drops y fallan. Autorización R5 A para actualizar solo datos de fixture.
- **H05 (🟡):** feed/live sí proyectan batch seguro de drops públicos, pero siguen validando campos padre nullable y fingen 1 drop desde parent si faltan filas de 3.
- **H06 (🟡):** viaje/WhatsApp avanzaron; historial/comercio/admin siguen lecturas del padre; vistas con `as any` y drop sintético; navegación externa no incluye waypoints.
- **H07 (🟡):** UUID duplicado ya corregido, pero fixture nuevo crea request con `accepted_offer_id` antes de crear la oferta; `db-tests` falla FK; plan 90, ejecutadas 77.
- **H08 (✅):** CI `unit` job `114886529521` PASS, `rpc-fake.ts` statements **95,32 %**, branches **91,35 %** contra umbral 90.
- **H09 (🔴):** Playwright nuevo de 3 drops existe, pero **no está ejecutado/validado en Preview**; no hay RED→GREEN real de Paso 2; faltan payload pre-match, actor externo y DB pagado, y fiabilidad del seed.
- **H10 (🔴 NUEVO):** `TripCourierContainer` en `in_transit` solo llama `markTripDeliveredAction` del request completo. Para N debe usar `markDropDeliveredAction`/`markDropFailedAction` por `dropId`; falta UI real de cambio de estado.

**Checks sobre SHA de implementación R5:** typecheck/lint/build/unit/audit/bundle-budget PASS, **db-tests FAIL** (job `114886529374`), E2E Preview sin success constatado, approval-policy FAIL. Sin ejecutar Supabase/Docker local por el revisor.

**Secuencia:** Asako corrige los lectores Paso 2 en esta misma PR Draft → ronda 6 independiente → con todos los controles y autorización de Lautaro073, merge + checkpoint Develop → Kira implementará Paso 3/4 y después 4/4 en PR separadas.

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
