# Acta de Simulacro de Restauración en Staging — T-310

- **Fecha de registro:** 2026-09-25
- **Responsable del simulacro:** `@Lautaro073` (P1 — Base de Datos, Dominio, Auth y Admin)
- **Entorno evaluado:** `cadeapp-staging` (Supabase Staging + Vercel Preview/Staging)
- **Tarea asociada:** T-310 (Fase 3 — Calidad, operación y salida)
- **Estado actual:** **PENDIENTE / NO VERIFICADO**
- **Precondición para T-312:** Requisito indispensable previo al checklist de release `staging → main`

---

## 1. Objetivos del Simulacro

1. **Validación del procedimiento de restauración:** Comprobar que una copia lógica de la base de datos PostgreSQL (`pg_dump`) pueda restaurarse limpiamente en el entorno de staging sin pérdida de integridad referencial ni inconsistencias en RLS.
2. **Verificación empírica de la exclusión de `courier-docs` (`D8` / `ADR-0001`):** Demostrar que los respaldos de la base de datos no contienen ni resucitan archivos binarios (DNI, selfie) eliminados de Supabase Storage tras la purga de 30 días (`purge_after`), descartando copias fantasma.
3. **Validación del canal de alertas críticas:** Despachar y verificar la recepción de una alerta de prueba operativa en el canal configurado (`DISCORD_ERROR_WEBHOOK_URL`).
4. **Verificación de disponibilidad:** Comprobar que tras la restauración el endpoint `/api/health` responda HTTP 200 OK con latencia normal.

---

## 2. Protocolo de Ejecución y Evidencia Requerida

El procedimiento técnico de simulacro se encuentra estandarizado en `docs/runbooks/backups-and-disaster-recovery.md`. Para declarar el acta formalmente aprobada y dar por cumplido el DoD de simulacro, `@Lautaro073` debe ejecutar en el proyecto real de staging (`cadeapp-staging`) los siguientes pasos y asentar la evidencia empírica verificable:

| Paso operativo | Acción a ejecutar por Lautaro073 | Evidencia requerida para verificación |
|---|---|---|
| **1. Carga previa de prueba** | Subir un archivo de prueba al bucket `courier-docs` (ej: `test-courier-uuid/dni_drill.png`) e insertar su fila en `public.courier_documents`. | URL firmada o ID de objeto en Storage y fila visible en SQL. |
| **2. Exportación de backup** | Ejecutar `pg_dump` sobre el esquema `public` de staging. | Hash SHA-256 del archivo `.dump` generado y tamaño exacto. |
| **3. Purga física** | Ejecutar borrado físico del binario (`storage.from('courier-docs').remove(...)`) y asiento en `audit_log`. | Comprobación de respuesta HTTP 404 (`Not Found`) al intentar leer el binario. |
| **4. Restauración** | Ejecutar `pg_restore --clean --if-exists` contra la base de datos de staging. | Transcript/logs del comando y medición del tiempo transcurrido (RTO). |
| **5. Comprobación de no resurrección** | Comprobar que la fila SQL en `courier_documents` fue restaurada pero el objeto físico en Storage `courier-docs` sigue retornando 404. | Confirmación empírica de no resurrección de binarios desde el backup SQL (`D8`). |
| **6. Alerta de prueba** | Disparar `sendTestAlert({ environment: 'staging', triggeredBy: 'Lautaro073' })`. | Constancia / ID de mensaje recibido en canal Discord (`DISCORD_ERROR_WEBHOOK_URL`). |
| **7. Disponibilidad** | Consultar endpoint `/api/health`. | Código HTTP 200 y latencia observada (ms). |

---

## 3. Estado de Métricas

- **RTO Objetivo:** < 30 minutos (pendiente de medición cronometrada en ejecución real).
- **RPO Objetivo:** < 24 horas (respaldo lógico diario) / < 1 minuto (PITR).
- **Aislamiento de Almacenamiento Biométrico (`D8`):** Pendiente de validación empírica con hash y 404 en el bucket `courier-docs`.
- **Canal de Alertas:** Cableado en código; pendiente de confirmación de recepción en el servidor Discord de destino.

---

## 4. Veredicto

```text
================================================================================
ESTADO DEL SIMULACRO: PENDIENTE / NO VERIFICADO
================================================================================
El protocolo y los runbooks están formalizados y la observabilidad cableada,
pero no se ha registrado aún la evidencia operativa real de ejecución en staging
(hash SHA-256 de dump, logs de pg_restore, comprobación 404 y recepción Discord).
El DoD correspondiente se mantiene desmarcado hasta la ejecución por Lautaro073.
================================================================================
```

- **Responsable asignado:** `@Lautaro073` — Tech Lead P1 (Base de Datos, Dominio, Auth y Admin)
- **Próximo hito:** Ejecución operativa del simulacro en staging previa a la salida a producción (`T-312`).
