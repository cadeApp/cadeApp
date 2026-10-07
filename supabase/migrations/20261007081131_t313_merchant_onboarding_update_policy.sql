-- T-348 (prerrequisito de T-313, hallazgo H11): merchants_update_self deja de congelar `notes`.
-- El onboarding del comercio actualiza su propia fila (creada por handle_new_user) e incluye «Referencia adicional».
-- Se mantienen: ownership (profile_id = auth.uid()), actor operativo activo (CC-007) y las columnas de suscripción
-- (subscription_status, paid_until) congeladas para el self-service. Sin policy INSERT ni GRANT nuevos.

drop policy if exists merchants_update_self on public.merchants;
create policy merchants_update_self on public.merchants
  for update to authenticated
  using (profile_id = auth.uid() and app_private.is_active_operational_actor())
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
    and subscription_status = (select m.subscription_status from public.merchants m where m.profile_id = auth.uid())
    and paid_until is not distinct from (select m.paid_until from public.merchants m where m.profile_id = auth.uid())
  );
