# Revisión PR #68 — [T-104] /api/cron/sweep y /api/health

- **PR:** [#68](https://github.com/cadeApp/cadeApp/pull/68)
- **Tarea:** `T-104` (Fase 1 · Endpoint de barrido `/api/cron/sweep` y `/api/health`)
- **Autor / Zona:** Lautaro073 (P1)
- **SHA revisado:** `f137ef1c518f816b2e2d03b30e74288dbb88a305`
- **Estado:** RONDA 1 CERRADA — SIN BLOQUEANTES

## Resumen de la revisión

Implementación del endpoint de mantenimiento `/api/cron/sweep` y el endpoint de estado `/api/health`.

La revisión confirmó:
1. **Autenticación e Infraestructura (`/api/cron/sweep`):** Verificación estricta del token `Authorization: Bearer <CRON_SECRET>` utilizando `serverEnv.CRON_SECRET`. Respuesta `401 Unauthorized` si la cabecera es ausente o inválida.
2. **Tareas de Mantenimiento (`runSweep`):**
   - Transición de `delivery_requests` vencidas a `status = 'expired'` y actualización en cascada de ofertas `pending` asociadas a `expired` con `decided_at = now()`.
   - Purga física de binarios en el bucket privado `courier-docs` en Supabase Storage para legajos con `purge_after <= now()` y `purged_at IS NULL`, marcando `purged_at`.
   - Expiración de suscripciones comerciales en `merchants` cuando `paid_until + grace_days < currentDate`.
   - Registro inmutable de auditoría en `audit_log` para cada acción.
3. **Endpoint `/api/health`:** Handler `GET` respondiendo `200 OK` con `{ status: 'ok' }`.
4. **Alcance y Pruebas:** 7 archivos modificados, todos dentro de los "Archivos permitidos" de `T-104.md`. 100% de tests locales pasando (27 suites, 233 tests).

## Historial de Rondas

| Ronda | Fecha | SHA revisado | Resultado | Bloqueantes | Mejoras |
|---|---|---|---|---|---|
| Ronda 1 | 2026-09-23 | `f137ef1c518f816b2e2d03b30e74288dbb88a305` | SIN BLOQUEANTES | 0 | 1 |
