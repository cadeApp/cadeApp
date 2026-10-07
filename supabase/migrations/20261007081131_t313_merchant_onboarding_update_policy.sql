-- T-313 / H11: Corregir política RLS merchants_update_self para permitir actualizar
-- datos propios durante el onboarding (incluyendo notes / referencia adicional)
-- preservando congeladas las columnas de suscripción (subscription_status, paid_until)
-- y requiriendo que el actor operativo esté activo (app_private.is_active_operational_actor()).

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
