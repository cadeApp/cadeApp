# PR #56 — T-005 · RLS v1, storage courier-docs, matriz RLS, rls_enabled.sql

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/56 |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-005-rls-v1` → `develop` |
| **Base** | `f698539` |
| **Estado** | **LISTA PARA ACEPTAR** · Cero bloqueantes · **CI 8 de 8 checks verdes** en `35690759854` |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `fdf57db` | 0 bloqueantes · alcance limpio (4 archivos) · `db-tests` verde con 58/58 pgTAP en CI | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado de hallazgos

| ID | Título | Sev. | Estado |
|---|---|---|---|
| A01 | Archivos fuera de «Archivos permitidos» | 🔵 | ✅ verificado (`fdf57db`) — 0 fuera |

## Lo que está bien

- **Fase roja demostrada antes de implementar:** `rls_enabled.sql` falló 2/2 tests ante la presencia de `_table_without_rls` en CI Run `35689605017`.
- **Matriz de roles completa y probada:** 15 pruebas pgTAP en `rls_matrix.sql` validan `anon`, `merchant`, `courier` (pending, suspended, approved) y `admin`.
- **Invariante crítico de privacidad respetado:** Un repartidor aprobado solo ve los datos de contacto de pedidos donde su oferta fue la aceptada (`matched`); repartidores con ofertas pendientes o rechazadas reciben 0 filas.
- **Storage privado:** Bucket `courier-docs` creado como privado (`public = false`); SELECT directo bloqueado para clientes (`count = 0`).
- **Prevención de recursión y type-drift:** Helpers de seguridad internos ubicados en el esquema `app_private` con `SECURITY DEFINER`, evitando bucles de RLS y manteniendo `database.types.ts` intacto (0 drift contra develop).
