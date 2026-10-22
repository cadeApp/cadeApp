-- ============================================================================
-- CC-023 (T-345, PR 3): enforcement — `notes` y `cash_change_amount` sin SELECT directo para clientes
-- ============================================================================
-- `authenticated` pierde el SELECT de tabla sobre `delivery_requests` y recupera SELECT por columna sobre todas
-- las columnas salvo `notes` y `cash_change_amount`. Esos dos datos se leen solo por RPC `security definer`
-- (`get_merchant_request_private_fields` para el comercio dueño y `get_trip_details` después del match).
-- `anon` no recupera SELECT (no tiene policy de lectura). INSERT, UPDATE, RLS y `service_role` no cambian.
--
-- Desde esta migración, toda columna nueva de `delivery_requests` necesita su `grant select (<columna>)` explícito
-- en la misma migración que la agrega, salvo que sea un dato privado (CC-023 §4). Nunca un grant de tabla completo.

revoke select on table public.delivery_requests from anon, authenticated;

grant select (
  id,
  merchant_id,
  status,
  pickup_zone_id,
  dropoff_zone_id,
  package_type,
  recipient_payment_method,
  needs_change,
  approx_distance_m,
  route_distance_m,
  accepted_offer_id,
  cancel_reason,
  created_at,
  updated_at,
  published_at,
  expires_at,
  matched_at,
  picked_up_at,
  delivered_at,
  cancelled_at
) on public.delivery_requests to authenticated;
