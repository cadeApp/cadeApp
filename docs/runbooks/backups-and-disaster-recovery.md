# Runbook: Backups, PITR y Recuperación ante Desastres (Disaster Recovery)

- **Servicio:** cadeApp — Plataforma de envíos locales en Aguilares, Tucumán
- **Responsable:** P1 — Tech Lead / Infraestructura (`@Lautaro073`)
- **Tarea asociada:** T-310
- **Ambientes cubiertos:** `cadeapp-staging` y `cadeapp-prod`

---

## 1. Objetivos de Recuperación (RPO y RTO)

| Métrica | Objetivo (Piloto / Free Tier) | Objetivo (Producción Comercial / Pro + PITR) |
|---|---|---|
| **RPO (Recovery Point Objective)** | < 24 horas (respaldo lógico diario `pg_dump`) | < 1 minuto (Point-in-Time Recovery con retención WAL de 7 días) |
| **RTO (Recovery Time Objective)** | < 30 minutos (restauración desde dump SQL) | < 15 minutos (restauración point-in-time desde consola Supabase) |

---

## 2. Arquitectura de Respaldo y Exclusión de Documentos (`D8`)

### 2.1. Separación de Planos de Almacenamiento
En la arquitectura de Supabase:
1. **Base de Datos Relacional (PostgreSQL):**
   - Aloja el esquema `public` (`profiles`, `merchants`, `couriers`, `delivery_requests`, `offers`, `courier_documents`, `audit_log`, `platform_settings`) y los metadatos de almacenamiento en el esquema `storage` (`storage.buckets`, `storage.objects`).
   - Los respaldos lógicos (`pg_dump`) y los archivos WAL de PITR respaldan **únicamente** los datos tabulares y metadatos de la base de datos.
2. **Almacenamiento de Objetos Binarios (Supabase Storage / S3-compatible):**
   - Aloja los archivos físicos (fotos de DNI y selfies) en el bucket privado `courier-docs`.
   - **Exclusión garantizada (`D8`):** Los respaldos de base de datos de PostgreSQL **NO contienen ni copian los archivos binarios** de `courier-docs`.

### 2.2. Garantía de Purga Irreversible de Legajos
- La tarea periódica `/api/cron/sweep` (`T-104`) evalúa los registros de `courier_documents` donde `purge_after <= now()` y `purged_at IS NULL`.
- Al ejecutarse la purga:
  1. Se invoca `supabase.storage.from('courier-docs').remove(paths)`.
  2. Se asienta la auditoría en `public.audit_log`.
  3. Se marca `purged_at = now()`.
- Dado que los binarios no forman parte del backup de PostgreSQL, una posterior restauración de la base de datos a un punto temporal anterior **no puede resucitar los archivos binarios eliminados**. En caso de restauración, la fila de metadatos apuntará a un objeto inexistente en el bucket, impidiendo fugas de datos biométricos o identificatorios de postulantes dados de baja o rechazados hace más de 30 días.

---

## 3. Procedimiento Operativo de Respaldo

### 3.1. Respaldo Lógico Manual con `pg_dump`
Para generar un dump completo del esquema `public` antes de una migración crítica o simulacro:
```bash
pg_dump \
  --host="db.<project-ref>.supabase.co" \
  --port=5432 \
  --username="postgres" \
  --format=custom \
  --schema="public" \
  --file="cadeapp_backup_$(date +%Y%m%d_%H%M%S).dump" \
  "postgres"
```

### 3.2. Point-in-Time Recovery (PITR) en Supabase Pro
1. Ingresar a la consola de Supabase: `https://supabase.com/dashboard/project/<project-ref>/database/backups/pitr`.
2. Seleccionar el punto exacto en el tiempo al que se desea retornar (hasta 7 días de antigüedad).
3. Confirmar la restauración. Supabase creará una nueva instancia con los datos reproducidos hasta el timestamp seleccionado.
4. Actualizar la variable de entorno `NEXT_PUBLIC_SUPABASE_URL` y las credenciales en Vercel si se generó un nuevo proyecto de recuperación.

---

## 4. Procedimiento de Restauración en Staging (Paso a Paso)

1. **Aislar el ambiente:**
   - Desactivar temporalmente el trigger del Cron `/api/cron/sweep` en Vercel para evitar ejecuciones concurrentes durante la restauración.
2. **Restaurar el esquema de base de datos:**
   ```bash
   pg_restore \
     --host="db.<staging-ref>.supabase.co" \
     --port=5432 \
     --username="postgres" \
     --clean \
     --if-exists \
     --schema="public" \
     -d "postgres" \
     "cadeapp_backup_YYYYMMDD_HHMMSS.dump"
   ```
3. **Verificación de Integridad de Datos:**
   - Comprobar conteo de registros en `profiles`, `merchants`, `couriers`, `delivery_requests` y `platform_settings`.
   - Verificar consistencia del `audit_log`.
4. **Verificación de Exclusión de `courier-docs`:**
   - Intentar descargar vía SDK o URL firmada un archivo purgado con anterioridad.
   - Confirmar que el Storage retorna error `404 Not Found` u `Object not found`, demostrando que los binarios purgados no fueron preservados en el backup de base.
5. **Reanudación del servicio:**
   - Ejecutar el chequeo de disponibilidad `/api/health`.
   - Reactivar el cron en Vercel.

---

## 5. Pruebas y Simulacros Periódicos
- Frecuencia obligatoria: Trimestral y previa a cada salida mayor a producción (`T-312`).
- Toda ejecución debe quedar documentada mediante su respectiva **Acta de Simulacro de Restauración** en `docs/runbooks/acta-simulacro-restauracion-staging.md`.
