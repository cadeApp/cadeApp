# PR #160 — T-303 — E2E del flujo principal

- **PR:** #160
- **Tarea:** T-303
- **Rama:** `feat/T-303-main-flow`
- **Base:** `develop`
- **Ronda actual:** 4
- **SHA revisado:** `5aa689201b360cb1c0369900bf2dae80e05463fe`
- **Resultado:** CON BLOQUEANTES (4)
- **Fecha:** 2026-10-01
- **Revisor:** revisión independiente solicitada por Lautaro073

## Decisión P1 de Ronda 4

**1-B — aceptada por Lautaro073.** T-303 queda dispensada de una mutación RED local de la guarda SQL porque el proyecto no usa Supabase/Docker local como parte del flujo habitual. Para cerrar, el E2E de concurrencia debe pasar en staging/CI real con el oráculo fuerte de estado final.

## Resumen

H08, H09 y R03 quedaron corregidos estructuralmente. H04 deja de bloquear por decisión P1.

Quedan cuatro bloqueantes:
- H05: body/checks contradictorios y evidencia staging/DB pendiente;
- H10: contextos manuales de Playwright sin baseURL;
- H11: privacidad no detecta teléfono formateado;
- H12: rama 24 commits detrás de develop.

## Revisiones

- `revisiones/ronda-1.md`
- `revisiones/ronda-2.md`
- `revisiones/ronda-3.md`
- `revisiones/ronda-4.md`
