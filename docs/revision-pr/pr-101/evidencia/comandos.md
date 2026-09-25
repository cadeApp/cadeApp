# Evidencia y probes — PR #101 / CC-007

## Ronda 2 — SHA 35d139d

### DB CI inspeccionado
Run `36183744739`, job `108232022631`:

```text
Applying migration 20260925170000_cc007_consent_enforcement.sql...
supabase/tests/cc007_consent_enforcement.sql .. ok
Files=9, Tests=1463
Result: PASS
pnpm db:types --local
Tipos generados exitosamente
```

### Probe H02 — request_cycle
En develop, `app_private.request_cycle` es `SECURITY DEFINER` y solo hace:

```sql
select role into v_role from public.profiles where id = auth.uid();
```

Wrappers aún delegados sin gate:
`cancel_request`, `mark_picked_up`, `mark_delivered`, `report_no_show`,
`courier_cancel_match`, `republish_request`, `report_incident`.

### Probe H03 — ACL de activación
Requerido en pgTAP:

```sql
select has_function_privilege('authenticated', 'public.activate_account_consents(uuid,text,text)', 'EXECUTE'); -- false
select has_function_privilege('anon',          'public.activate_account_consents(uuid,text,text)', 'EXECUTE'); -- false
select has_function_privilege('service_role',  'public.activate_account_consents(uuid,text,text)', 'EXECUTE'); -- true
```

### Probe H08 — INSERT directo
Como authenticated con JWT propio:

```sql
insert into public.consents(profile_id, document, version)
values (auth.uid(), 'tos', '999.0');
```

Debe fallar después del arreglo.

### Mutaciones R2
Arnés real recomendado:
1. guardar archivo original;
2. mutar gate;
3. ejecutar test objetivo (`pnpm vitest...` o pgTAP correspondiente);
4. exigir exit != 0;
5. restaurar en `finally`;
6. `git status --short` limpio.

Mutaciones mínimas:
- quitar gate de `request_cycle`;
- abrir EXECUTE de activación a authenticated;
- quitar bloqueo RLS de merchant;
- permitir pending en guard.
