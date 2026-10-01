# Ronda 3 — PR #159 / T-321

**Fecha:** 2026-10-01  
**SHA revisado:** `8aad4db969c148499374ebc24acedfd2c070d44a`  
**Resultado:** **CON BLOQUEANTES (1)**

## Cambios desde ronda 2

Un solo commit del autor, `8aad4db9`, con dos archivos:

- `.github/workflows/ci.yml`
- `docs/tasks/log/T-321.md`

No hubo cambios del autor en `docs/revision-pr/**`, migración, pgTAP, queries ni contratos.

## PR159-H03 — arreglado y verificado

El checker nuevo:

- elimina comentarios SQL;
- aísla el único `INSERT INTO public.platform_settings`;
- valida los cinco pares key/valor en ese statement;
- exige `ON CONFLICT (key) DO NOTHING` en el mismo statement;
- rechaza `DO UPDATE`;
- incorpora M03 y M04.

CI run `36815136630` confirmó:

```text
Files=1, Tests=10
Result: PASS

T321_MIGRATION_BASELINE GREEN
T321_M01 RED_OK: platform_settings_insert_count:0
T321_M02 RED_OK: missing:TARGET_ON_CONFLICT_DO_NOTHING, forbidden:DO_UPDATE
T321_M03 RED_OK: missing:TARGET_ON_CONFLICT_DO_NOTHING, forbidden:DO_UPDATE
T321_M04 RED_OK: platform_settings_insert_count:2

Files=13, Tests=1611
Result: PASS
```

Por eso H03 pasa a **arreglado-verificado**.

## PR159-H04 — arreglado y verificado

El cuerpo actual de la PR ya dice “10 aserciones” y describe el control de contrato en CI. Tampoco conserva el total DB anterior “1612”. H04 queda cerrado por inspección independiente.

## BLOQUEANTE

### PR159-H05 — la no-sobrescritura sigue sin probarse semánticamente

**Archivo:** `.github/workflows/ci.yml`  
**Severidad:** alto · **Patrón:** `P08-control-no-cubre-lo-que-dice`

La ronda 2 endureció correctamente el análisis del `INSERT`, pero el contrato real es más amplio: **la migración nunca debe reemplazar una configuración operativa existente**.

M05 conserva intacto el statement esperado:

```sql
insert into public.platform_settings (...)
...
on conflict (key) do nothing;
```

y agrega después:

```sql
update public.platform_settings
set value = '1000'::jsonb
where key = 'min_offer_ars'
  and value <> '1000'::jsonb;
```

Ese SQL es destructivo en un remoto que ya tenga `min_offer_ars=1500`, pero:

- el checker actual devuelve **cero violaciones**, porque solo inspecciona el INSERT objetivo;
- el pgTAP sin seed parte de una base fresca, por lo que no contiene una personalización previa que pueda ser pisada.

La mutación independiente ejecutada por revisión contra el checker exacto del SHA revisado produjo:

```text
baseline []
m05 []
m06 []
```

M06 repite el mismo problema usando un CTE con `UPDATE`.

### Cambio de enfoque requerido

No seguir agregando regex para perseguir variantes SQL. La propiedad debe verificarse **en runtime**:

1. resetear localmente hasta la migración anterior a T-321, sin seed;
2. insertar cinco valores personalizados;
3. aplicar T-321 con `supabase migration up`;
4. comprobar que los cinco valores personalizados siguen intactos;
5. luego resetear sin seed al HEAD y ejecutar el pgTAP de 10 defaults;
6. finalmente restaurar el flujo normal y correr toda la suite DB.

Con eso:
- quitar el INSERT rompe el pgTAP de defaults;
- cambiar `DO NOTHING` por `DO UPDATE` rompe la prueba de preservación;
- agregar un UPDATE/CTE/DELETE+reinserción destructiva también rompe la prueba de preservación.

## Decisión H02

Sin cambios: la evidencia AAL2 real sigue diferida a post-merge/post-promoción por D02=A.

## Informe revisar-pr

```text
Informe revisar-pr — T-321 — 2026-10-01 — generado por revisión independiente
Resultado: CON BLOQUEANTES (1)
Checks: CI ✅ en 8aad4db9 · T-321 sin seed 10/10 ✅ · M01-M04 ✅ · suite DB 1611/1611 ✅
BLOQUEANTES:
- [.github/workflows/ci.yml] El checker estático valida el INSERT correcto pero no detecta SQL destructivo adicional que pisa valores existentes. M05/M06 quedan GREEN → reemplazar la garantía estática de no-sobrescritura por una prueba runtime que aplique T-321 sobre valores personalizados preexistentes.
MEJORAS:
- Ninguna pendiente.
No revisado / dudas para Lautaro073:
- Evidencia AAL2 de staging pendiente post-merge/post-promoción por D02=A.
```
