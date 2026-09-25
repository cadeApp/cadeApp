# Evidencia y probes — PR #101 / CC-007

## Ronda 3 — SHA a99bbf4

### H02
```sql
select role, consent_status into v_role, v_consent_status
from public.profiles where id = v_uid;

if v_role is null
  or (v_role <> 'admin' and v_consent_status <> 'active')
  ...
then
  raise exception 'UNAUTHORIZED_ACTOR';
end if;
```

### H03
Migración:
```sql
revoke all on function public.activate_account_consents(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.activate_account_consents(uuid, text, text)
  to service_role;
```

pgTAP valida anon/authenticated=false, service_role=true y ejecución efectiva como service_role.

### H08
```sql
drop policy if exists consents_insert_self on public.consents;
```

pgTAP: INSERT directo como authenticated => SQLSTATE 42501.

### Mutation harness
`src/server/rpc/cc007.test.ts`:
- guarda original;
- escribe mutación;
- ejecuta `pnpm vitest run ...`;
- exige status != 0 y salida FAIL/failed;
- restaura en `finally`.

Job unit ejecuta las 4 mutaciones; los tests de CC-007 pasan.

### CI final inspeccionado
Run `36188410458`.

```text
lint          success
db-tests      success — Files=9, Tests=1472, Result: PASS
audit         success
typecheck     success
build         success
bundle-budget success
unit          failure — únicamente verify-fichas: T-300, T-311
```

Unit:
```text
Test Files 1 failed | 51 passed
Tests      1 failed | 560 passed
```

### H11 — comprobación base
`docs/implementation-plan.md` es idéntico entre la rama y `develop@7edcfe0`.

Fichas canónicas de develop:
- T-300 primer DoD: `develop está verde y se promueve mediante PR develop → staging...`
- T-311 primer DoD: `Pruebas en rojo antes de implementar...`

Las filas del plan contienen textos anteriores, por eso verify-fichas falla.

### Limitación de ejecución
No se ejecutó `node docs/revision-pr/analizar.mjs verificacion` localmente porque esta revisión opera contra el repositorio remoto vía API y no dispone de checkout local persistente.
