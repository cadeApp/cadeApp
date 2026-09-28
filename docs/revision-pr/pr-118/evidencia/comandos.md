# Evidencia y comandos — PR #118

## Ronda 1

Ver `revisiones/ronda-1.md`.

## Ronda 2 — SHA `aba405dd4544af13d85cdd0b3e26a1f8bca8e07d`

### Sincronización

- parent del arreglo: `8cfd6402f2525a1815c09d886bf505541a478cdf`
- head: `aba405dd4544af13d85cdd0b3e26a1f8bca8e07d`
- develop: `57badabc28fd3bd8e913674bd80b30feb8828414`
- compare head vs develop: 6 ahead / 0 behind
- compare R1-review vs head: 1 commit, 7 archivos; ninguno bajo `docs/revision-pr/**`

### CI inspeccionado

Workflow run: `36380194256`.

Unit:
```text
Test Files  92 passed (92)
Tests       1255 passed (1255)
```

Node:
```text
verify-workflows: # tests 22
verify-adr:       # tests 6
```

DB job `108794184718`:
```text
All tests successful.
Files=12, Tests=1601
Result: PASS
```

Jobs build, typecheck, lint, unit, db-tests, audit y bundle-budget: success.

### Inspección SQL de cancel_request

En `supabase/migrations/20260924010124_rpc_requests_v1.sql`:
- accepted offer se actualiza a `cancelled, decided_at=v_now`;
- pending offers se actualizan a `expired, decided_at=v_now`;
- request recibe `cancelled_at=v_now`;
- retorno incluye `cancelledAt=v_now`;
- audit_log inserta `actor_id=v_uid`, `action=p_action`, `target_type='delivery_request'`, `target_id=p_request_id`.

Esto valida que filtrar por `decided_at = cancelledAt` puede seleccionar las filas de esa transición.

### Mutaciones pendientes para Ronda 3

No se declaran como ejecutadas por el revisor; no hubo checkout local ejecutable.

1. Audit action:
   - mutar `.eq('action','cancel_request')` a otra acción.
   - esperado: RED por actor/destinatario, no por TypeError.

2. Cancel sin timestamp:
   - quitar `.eq('decided_at', cancelledAt)`.
   - el mock debe seguir siendo una cadena válida y devolver una offer histórica adicional.
   - esperado: RED por tamaño/conjunto de destinatarios.

3. Logout:
   - mover `getUser()` fuera del try best-effort.
   - esperado: test con `getUser.mockRejectedValue` falla porque signOut no se ejecuta.

4. Resolver errors:
   - quitar guard de `reqRes.error` en accept o `auditRes.error` en cancel.
   - esperado: aparece llamada parcial/incorrecta a safeNotify.

5. Sweep:
   - quitar `.select('request_id, courier_id')`.
   - esperado: test T-206 RED por pérdida de filas afectadas/select esperado, no por mock artificial.

La evidencia del autor en `docs/tasks/log/T-206.md` debe incluir comandos y líneas reales `Test Files`/`Tests` por mutación.
