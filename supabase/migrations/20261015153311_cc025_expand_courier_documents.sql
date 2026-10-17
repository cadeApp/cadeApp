-- CC-025: Migración expansiva independiente (PR A)
-- Agrega columnas para el reemplazo seguro de documentos conservando
-- total compatibilidad con el writer UPSERT de la aplicación en producción.

alter table public.courier_documents
  add column if not exists is_current boolean not null default true,
  add column if not exists rejection_code text null,
  add column if not exists idempotency_key text null;

-- Guard temporal durante la fase expansiva:
-- Impide que clientes o actores forjen estados de rechazo, claves de idempotencia
-- o falsas vigencias históricas antes del despliegue del nuevo writer y del contract final (PR C).
-- Este guard se retira en la migración de la Fase C antes de ejecutar el backfill.
alter table public.courier_documents
  add constraint courier_documents_expansion_guard
  check (is_current = true and rejection_code is null and idempotency_key is null);
