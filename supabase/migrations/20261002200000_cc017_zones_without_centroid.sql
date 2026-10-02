-- ============================================================================
-- CC-017: una zona activa puede existir sin centroide verificado
-- ============================================================================
-- Se elimina únicamente `zones_active_centroid`. Siguen vigentes `zones_centroid_pair` (nunca una
-- coordenada suelta), los bounds de latitud/longitud cuando el centroide existe, la unicidad de `name`,
-- RLS y permisos.

alter table public.zones
  drop constraint if exists zones_active_centroid;

-- MUTACIÓN TEMPORAL M2 — debe romper los pgTAP de pair
alter table public.zones
  drop constraint if exists zones_centroid_pair;
