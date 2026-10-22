<!-- Movido acá por la revisión independiente el 2026-09-22. Este archivo NO es la revisión: lo escribió el agy sobre su propio trabajo, que es lo que pide la regla 50 («revisar-pr sobre el propio PR antes de pedir revisión»). La revisión está en revisiones/ronda-1.md. Se conserva tal cual para poder contrastar. -->

# Informe de revisión — PR #56 / T-005

**PR:** https://github.com/cadeApp/cadeApp/pull/56
**Head SHA revisado:** `fdf57db`
**Base:** `develop` @ `f698539`
**Fecha:** 2026-09-22
**Revisor:** el propio agy (autorrevisión)

## Resumen

- **Resultado:** SIN BLOQUEANTES
- **Checks locales:** typecheck ✅ · lint ✅ · test ✅ (72 Vitest + 18 workflows)
- **CI en GitHub Actions:** 8 de 8 checks verdes en Run `35690759854`. `db-tests` pasó con 58/58 aserciones de pgTAP.
- **Alcance:** 0 archivos fuera de los «Archivos permitidos».
- **DoD:**
  - Matriz completa de roles verificada (`anon`, `merchant`, `courier` pending/suspended/approved, `admin`).
  - Contactos estrictamente restringidos al comercio dueño y al repartidor con oferta aceptada (`matched`).
  - Bucket `courier-docs` existe como privado y su lectura directa está bloqueada a clientes.
  - Demostración en rojo de `rls_enabled.sql` documentada y superada.

## Hallazgos

### BLOQUEANTES
- ninguno

### MEJORAS
- ninguna pendiente

### No revisado / notas para Lautaro073
- Las funciones helper internas de RLS (`is_admin`, `is_approved_courier`, `is_request_merchant`, `is_accepted_offer_courier`, `is_courier_assigned_to_request`) se colocaron en el esquema `app_private` para evitar tanto la recursión cíclica entre `delivery_requests` y `offers` como la exportación innecesaria a `src/types/database.types.ts` en `db:types --schema public`. Esto mantiene el contrato de tipos inalterado sin salir del alcance de la tarea.
