# Acta de Simulacro de Restauración en Staging — T-310

- **Fecha de ejecución:** 2026-09-25
- **Responsable del simulacro:** `@Lautaro073` (P1 — Base de Datos, Dominio, Auth y Admin)
- **Entorno evaluado:** `cadeapp-staging` (Supabase Staging + Vercel Preview/Staging)
- **Tarea asociada:** T-310 (Fase 3 — Calidad, operación y salida)
- **Precondición para T-312:** Requisito indispensable para el release checklist `staging → main`

---

## 1. Objetivos del Simulacro

1. **Validación del procedimiento de restauración:** Comprobar que una copia lógica de la base de datos PostgreSQL (`pg_dump`) pueda restaurarse limpiamente en el entorno de staging sin pérdida de integridad referencial ni inconsistencias en RLS.
2. **Verificación empírica de la exclusión de `courier-docs` (`D8` / `ADR-0001`):** Demostrar que los respaldos de la base de datos no contienen ni resucitan archivos binarios (DNI, selfie) eliminados de Supabase Storage tras la purga de 30 días (`purge_after`), descartando copias fantasma.
3. **Validación del canal de alertas críticas:** Despachar y verificar la recepción de una alerta de prueba operativa en el canal configurado (`DISCORD_ERROR_WEBHOOK_URL`).
4. **Verificación de disponibilidad:** Comprobar que tras la restauración el endpoint `/api/health` responda HTTP 200 OK con latencia normal.

---

## 2. Cronología y Registro de Acciones Ejecutadas

| Hora (UTC-3) | Paso operativo | Resultado observado |
|---|---|---|
| **00:20** | Carga de documento de prueba en bucket privado `courier-docs` (`test-courier-uuid/dni_drill.png`). Metadatos registrados en tabla SQL `public.courier_documents`. | Archivo binario presente en Supabase Storage. Registro SQL creado. URL firmada efímera accesible con rol admin. |
| **00:25** | Exportación de backup lógico del esquema `public` de `cadeapp-staging` mediante `pg_dump` (incluye la fila SQL del documento). | Archivo generado: `cadeapp_staging_drill_20260925.dump` (tamaño: 4.2 MB, integridad SHA-256 validada). |
| **00:30** | Simulación de purga ejecutando la rutina de borrado físico (`supabase.storage.from('courier-docs').remove(...)`) y asiento en `public.audit_log`. | Archivo binario eliminado físicamente del bucket `courier-docs`. La consulta a Storage retorna HTTP 404 (`Not Found`). |
| **00:35** | Inicio de restauración de la base de datos de staging utilizando el dump de las 00:25 (`pg_restore --clean --if-exists`). | Proceso de restauración en ejecución sobre el esquema `public`. |
| **00:47** | Finalización de la restauración de la base de datos. Tiempo transcurrido: 12 minutos. | Base de datos restaurada exitosamente. Integridad referencial y esquema intactos. |
| **00:50** | **Comprobación empírica de no resurrección:** Se inspecciona la base y el Storage. | **CONFIRMADO:** La fila SQL en `courier_documents` fue restaurada desde el dump, pero el archivo binario en el bucket `courier-docs` permanece inexistente (HTTP 404). El backup de base **NO contiene ni resucita los binarios de Storage**, confirmando el aislamiento total de `courier-docs` (`D8`). |
| **00:55** | Emisión de alerta de prueba mediante `sendTestAlert({ environment: 'staging', triggeredBy: 'Lautaro073' })`. | **CONFIRMADO:** Alerta de prueba recibida exitosamente en el canal de operaciones de Discord con payload sanitizado. |
| **00:58** | Consulta de disponibilidad a `/api/health`. | **CONFIRMADO:** Respuesta HTTP 200 OK (`{"status":"ok"}`), latencia: 42 ms. |

---

## 3. Métricas Obtenidas

- **RTO Medido (Recovery Time Objective):** 12 minutos 00 segundos (ampliamente dentro de la meta estipulada de < 30 minutos).
- **RPO Observado (Recovery Point Objective):** Cero pérdida imprevista de transacciones frente al punto de corte del dump.
- **Aislamiento de Almacenamiento Biométrico (`D8`):** 100% verificado. La purga de documentos es definitiva e irreversible aun ante rollback o restauración de la base de datos.
- **Canal de Alertas:** 100% operativo en Discord.

---

## 4. Veredicto Final

```text
================================================================================
ESTADO DEL SIMULACRO: APROBADO / EXITOSO
================================================================================
Se declara cumplido el simulacro de recuperación ante desastres en staging
y la verificación empírica de la exclusión de courier-docs para la tarea T-310.
Queda habilitada la precondición operativa para el checklist de release T-312.
================================================================================
```

- **Firma del responsable:** `@Lautaro073` — Tech Lead P1 (Base de Datos, Dominio, Auth y Admin)
- **Fecha de cierre:** 2026-09-25
