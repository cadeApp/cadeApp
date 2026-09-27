# Evidencia — PR #112 / T-123

## Ronda 1

SHA funcional: `1960d016e7fc88ba0c788f3fad919148068de3a2`

### CI

Run `36301571013`:

```text
typecheck       PASS
lint            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS
unit            FAIL esperado — fase RED
Test Files      7 failed | 65 passed (72)
Tests           88 failed | 782 passed (870)
```

Los logs muestran fallos por:
- `T-123: sin implementar` en actions/queries/parsers;
- componentes stub sin tabla/form;
- rutas A03/A04/A06 inexistentes.

### Inspección de clases

A03:
- tabla/columnas/cursor/vacío/pago manual cubiertos;
- falta diferenciar “Extender piloto” vs “Marcar mes pagado”.

A04:
- query de cinco settings prevista;
- action-level cubre todas las keys;
- UI-level no cubre pilot_active;
- no existe control de wiring para getRecentSettingChanges.

A06:
- query tests cubren cursor/filtros/saneamiento;
- component tests cubren filtros GET;
- link de paginación solo preserva actor + entity, no action.

### D05-B

Se confirmó en develop:
- `audit_log` tiene PK(id) y `audit_log_target_idx(target_type,target_id,created_at desc)`;
- RLS actual: `audit_log_admin for all` y `platform_settings_write_admin for all`;
- `rls_matrix.sql` no tiene casos específicos para audit_log/platform_settings;
- T-123 no permite `supabase/**`.

Lautaro073 acepta excepción a Regla 25 para esta tarea y deriva índice/prueba RLS específica.
