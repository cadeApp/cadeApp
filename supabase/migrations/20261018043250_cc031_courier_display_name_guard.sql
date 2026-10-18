-- CC-031: la identidad del courier no se puede autoeditar por acceso directo.
-- No altera policies/grants de profiles ni el orden de locks de CC-028.
create function app_private.guard_courier_display_name_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_relid <> 'public.profiles'::regclass
     or tg_op <> 'UPDATE' or tg_when <> 'BEFORE' or tg_level <> 'ROW'
     or tg_nargs <> 0 then
    raise exception using errcode = '42501', message = 'INVALID_PROFILE_GUARD_CONTEXT';
  end if;

  -- OLD define la identidad previa incluso si el UPDATE intenta cambiar id/role.
  -- auth.uid() conserva el actor JWT dentro de SECURITY DEFINER; current_user no.
  if old.role = 'courier' and auth.uid() = old.id
     and new.display_name is distinct from old.display_name then
    raise exception using errcode = '42501', message = 'COURIER_DISPLAY_NAME_IMMUTABLE';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_courier_display_name_update()
  from public, anon, authenticated;

create trigger guard_courier_display_name_update
before update on public.profiles
for each row execute function app_private.guard_courier_display_name_update();

-- Rollback solo por decisión explícita y nueva migración: DROP TRIGGER
-- guard_courier_display_name_update ON public.profiles; DROP FUNCTION
-- app_private.guard_courier_display_name_update(); reabre la autoedición de identidad.
