# Supabase: esquema, RLS y RPC

- RLS habilitada en TODAS las tablas de `public`, con policies explícitas por rol; default deny.
  CI falla si una tabla no tiene RLS o no tiene al menos una policy (`supabase/tests/rls_enabled.sql`).
- Operaciones críticas = funciones `SECURITY DEFINER` con `SET search_path = public, pg_temp`,
  `REVOKE ALL ... FROM public`, `GRANT EXECUTE ... TO authenticated`, chequeo de `auth.uid()` y rol, y errores
  estables: `RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OFFER_BELOW_MINIMUM'`.
- Los códigos de error de cada RPC coinciden con `src/domain/rpc-contracts.ts`. Uno nuevo = contract-change.
- `accept_offer`: `SELECT ... FOR UPDATE` de la solicitud, idempotente, índice único parcial de `accepted`.
- Revalidar el estado del repartidor (approved, no suspended) dentro de cada RPC que lo involucre.
- Expiración perezosa: toda consulta y RPC trata `expires_at < now()` como expirada.
- `rate_limits`: incremento atómico en la misma RPC
  (`INSERT ... ON CONFLICT (subject, action, window_start) DO UPDATE SET count = rate_limits.count + 1 RETURNING count`).
- Trigger de alta: el rol inicial sale de los metadatos del registro y solo acepta `merchant` o `courier`; nunca `admin`.
- RPC `admin_*` exigen `aal2` (MFA) en el JWT.
- Storage `courier-docs`: insert solo en `courier/{auth.uid()}/**`; select denegado salvo service role.
- Coordenadas geográficas (D15): `pickup_lat/lng` y `dropoff_lat/lng` viven únicamente en `delivery_request_contacts` (RLS idéntica a contactos: merchant dueño, courier `accepted` y admin). `delivery_requests` solo almacena `route_distance_m`. Prohibido exponer coordenadas en el feed de solicitudes abiertas.
- Bounding box de Aguilares: CHECK constraints en Postgres que validen latitud entre -27.4550 y -27.4100 y longitud entre -65.6400 y -65.5950; puntos fuera de rango rechazan con `OUT_OF_BOUNDS_AGUILARES`.
- RPC `calculate_route_distance`: fórmula Haversine × 1.30 nativa en SQL redondeada a múltiplos de 500 m; fallback automático a centroides de `zones` si las coordenadas son nulas.
- Nunca loguear filas completas, datos del destinatario, coordenadas ni documentos.
- Checklist de seguridad en el PR (RLS, SECURITY DEFINER, search_path, grants, RLS de coordenadas) marcado antes de pedir review.
