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


---

## Ronda 2 — SHA `ae130408eef848f91e31135c531fb5c5b0490215`

CI run `36302759647`:

```text
typecheck       PASS
lint            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS
unit            FAIL esperado

Test Files      8 failed | 65 passed (73)
Tests           103 failed | 783 passed (886)
```

### H01

RED observado:
- ambos caminos A03 fallan en `openPlanDialog` porque el stub no expone `Editar plan`.
- asserts inspeccionados: active para “Marcar mes pagado”, pilot para “Extender piloto”.

### H02

RED observado:
- inputs ausentes;
- switch `pilot_active` ausente;
- `RecentSettingChanges` sin listitems/empty state;
- `/admin/settings/page.tsx` inexistente.

Cobertura inspeccionada:
- las cinco keys tienen interacción y payload exacto;
- `pilot_active` exige boolean false;
- wiring server-side exige llamadas y render del historial.

### H03

RED observado:
- no existe link Siguiente;
- no existe form role=search.

Cobertura inspeccionada:
- link conserva cursor/actor/action/entity;
- formulario refleja valores activos.

### Regresión

Los 65 archivos previamente verdes continúan verdes. No se observa fallo fuera de la clase T-123 en el log revisado.

### Mutation battery reviewer

Intento de checkout:

```text
git clone https://github.com/cadeApp/cadeApp.git
fatal: Could not resolve host: github.com
```

No se fabrica evidencia de mutación. Las mutaciones H01/H02/H03 quedan exigidas durante la implementación GREEN.

---

## Ronda 3 — SHA `da4c103c4e4ab874b0f64250f78c64800d9c07ad`

### CI

Run `36304479891`:

```text
typecheck       PASS
lint            PASS
unit            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS

Test Files      73 passed (73)
Tests           886 passed (886)

db-tests:
Files=12, Tests=1529
Result: PASS

build:
Compiled successfully
45/45 páginas
```

La corrida corresponde al SHA revisado y es posterior al commit funcional.

### H04 — inspección

Archivo: `src/features/admin/components/merchants-table.test.tsx`.

La suite cubre:
- columnas y datos;
- paginación;
- estado vacío;
- “Marcar mes pagado”;
- “Extender piloto”.

No cubre:
1. enfocar el botón “Editar plan”;
2. abrir el Dialog;
3. cerrarlo con `Escape`;
4. esperar que desaparezca;
5. comprobar que el foco vuelve exactamente al mismo botón.

La implementación actual de A03 usa `<Dialog open={merchant !== null} onOpenChange=...>` sin `DialogTrigger` dentro de `MerchantsTable`. `src/ui/dialog.tsx` intenta recuperar el elemento activo, pero ese contrato no está blindado por un test de A03.

### Mutación RED exigida al arreglo

No se declara como ejecutada por esta revisión.

El autor debe demostrar que el test nuevo detecta una regresión real. Mutación concreta sobre `src/features/admin/components/merchants-table.tsx`:

```tsx
onClick={(event) => {
  event.currentTarget.blur();
  setEditing(merchant);
}}
```

en lugar del handler actual que solo hace `setEditing(merchant)`.

La mutación debe hacer fallar **solo el control de retorno de foco** (o, como mínimo, ese control debe figurar entre los fallos). Después se restaura el archivo byte por byte y el test vuelve a verde.

No tocar `src/ui/**` para resolver H04.
