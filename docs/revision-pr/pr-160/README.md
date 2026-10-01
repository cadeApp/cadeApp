# PR #160 — T-303 — E2E del flujo principal

- **PR:** #160
- **Tarea:** T-303
- **Rama:** `feat/T-303-main-flow`
- **Base:** `develop`
- **Ronda actual:** 3
- **SHA revisado:** `01476eb56b7ec962d488cd087b6d7abc5f31ca53`
- **Resultado:** CON BLOQUEANTES (6)
- **Fecha:** 2026-10-01
- **Revisor:** revisión independiente solicitada por Lautaro073

## Resumen

La sincronización con `develop`, el oráculo final de concurrencia, el aislamiento del piso y el discovery de requests/offers/contacts quedaron corregidos estructuralmente.

Persisten seis bloqueantes: evidencia RED simulada, checks incompletos en el body, publicación cash con selector/oráculo inválidos, sorting con oráculo débil, cambio de rol imposible en Flow 5 y cleanup incompleto de `rate_limits`/`audit_log`.

No hay decisiones nuevas de P1 en esta ronda.

## Revisiones

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `revisiones/ronda-3.md`
