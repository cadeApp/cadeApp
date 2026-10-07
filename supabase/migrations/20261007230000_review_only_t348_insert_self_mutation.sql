-- REVIEW ONLY / NEVER MERGE — mutación temporal de T-348 (PR302-H01).
-- Agrega una policy INSERT self para demostrar que el caso 24b de rls_matrix.sql queda RED.
create policy merchants_insert_self on public.merchants
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
  );
