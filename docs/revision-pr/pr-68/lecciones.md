# Lecciones de la PR #68 (T-104) para `AGENTS.md` y las reglas

**Fuente:** Revisión de la PR #68 [T-104] Endpoint `/api/cron/sweep` y `/api/health`.

## Patrón dominante

**Aislamiento y auditoría inmutable en tareas de mantenimiento periódicas (cron).** La ejecución de `/api/cron/sweep` mediante service role key garantiza que los barridos de expiración y purga física de archivos no dependan del contexto de una sesión de usuario y queden registrados en `audit_log`.

---

## `AG-64` · Consistencia de identificadores de entidad en `audit_log`

**Origen:** Ronda 1 de PR #68.

Al registrar eventos automáticos en `audit_log`, la columna `target_type` debe utilizar de manera consistente la misma convención de nombres (recomendada: nombre plural de la tabla PostgreSQL, p. ej. `delivery_requests`, `courier_documents`, `merchants`).

> **Regla propuesta.** Toda inserción en `audit_log` debe referenciar el nombre plural de la tabla objetivo en `target_type`. Esto simplifica la agregación y filtrado de eventos de auditoría por tipo de recurso.
