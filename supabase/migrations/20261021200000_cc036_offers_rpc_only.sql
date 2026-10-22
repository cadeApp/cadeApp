-- CC-036 / T-390 (SEC-04): las ofertas solo se escriben por RPC.
-- Las RPC submit_offer, withdraw_offer, accept_offer y take_request son SECURITY DEFINER y no dependen de estos
-- grants. Sin estas policies y grants, un repartidor ya no puede insertar ni editar offers por PostgREST salteando el
-- piso, el rate limit, el estado de la solicitud ni el precio fijo.

drop policy if exists offers_insert_courier on public.offers;
drop policy if exists offers_update_courier on public.offers;
drop policy if exists offers_update_merchant on public.offers;
drop policy if exists offers_update_admin on public.offers;

-- REVOKE UPDATE de tabla también revoca el grant por columnas de CC-026 (amount_ars, eta_minutes, message).
revoke insert, update, delete, truncate on public.offers from anon, authenticated;
