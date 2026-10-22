# Ronda 4 — PR #159 / T-321

**Fecha:** 2026-10-01  
**SHA revisado:** `66a83c1e39273d4c2e9448de60ef894432e50f9d`  
**Resultado:** **SIN BLOQUEANTES**

## Alcance

Desde el commit de revisión de ronda 3 (`47a51994`) hubo un único commit del autor:

```text
66a83c1e test(T-321): verify migration preserves existing settings [T-321]
```

Archivos modificados:

```text
.github/workflows/ci.yml
docs/tasks/log/T-321.md
```

No hubo escritura del autor en `docs/revision-pr/**`, ni cambios en la migración, pgTAP, seed, queries o ficha.

## PR159-H05 — arreglado y verificado

El control textual fue eliminado y reemplazado por una verificación de comportamiento.

CI run `36816282209` demuestra:

```text
Applying migration 20260927120000_cc012_incidents_contract.sql...
Finished supabase db reset ...

INSERT 0 5
Connecting to local database...
Applying migration 20260930224700_t321_admin_staging_bootstrap.sql...
Local database is up to date.

DO
T321_PRESERVE_EXISTING GREEN
```

Esto prueba que la base quedó exactamente antes de T-321, que se cargaron cinco valores personalizados, que `migration up` aplicó la migración T-321 real y que las cinco comprobaciones de preservación se ejecutaron después sin detectar sobrescritura.

Luego se verificó la otra mitad del contrato —defaults cuando faltan— sobre una base fresca sin seed:

```text
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
All tests successful.
Files=1, Tests=10
Result: PASS
```

Finalmente:

```text
All tests successful.
Files=13, Tests=1611
Result: PASS
```

El job terminó `success` y la regeneración de tipos no dejó diff.

## Mutaciones independientes

Por la regla acordada para SQL/RLS no se levantó otro Supabase/Docker local durante la revisión. Las mutaciones se verifican como **inspección + CI verde** sobre el control runtime ejecutado.

### M05 — UPDATE destructivo posterior

Si después del INSERT correcto se agrega:

```sql
update public.platform_settings
set value = '1000'::jsonb
where key = 'min_offer_ars';
```

la fixture runtime demostrada por CI parte de `min_offer_ars=1500`. M05 lo dejaría en 1000 y la aserción posterior levantaría `T-321 overwrote min_offer_ars`.

### M06 — escritura destructiva vía CTE

Una escritura equivalente mediante CTE cambia el mismo estado observable. El control ya no depende de reconocer sintaxis SQL: compara el valor persistido después de ejecutar T-321, por lo que también queda cubierta.

### Cobertura de la clase

Se verifican los cinco valores personalizados:

- `min_offer_ars = 1500`
- `request_ttl_minutes = 45`
- `pilot_active = false`
- `pilot_terms_version = "custom-v1"`
- `subscription_grace_days = 9`

Una escritura adicional —`UPDATE`, UPSERT, CTE, `DELETE+INSERT` u otra— que altere cualquiera de esos valores deja rojo el control. En paralelo, quitar el bootstrap o un default deja rojo el pgTAP de base fresca.

No se detectaron nuevos casos de la clase.

## CI completo

```text
typecheck       success
lint            success
unit            success
build           success
bundle-budget   success
audit           success
db-tests        success
```

## Cuerpo de PR

La revisión corrigió directamente una frase narrativa que había quedado obsoleta:

- antes: control “con mutaciones en memoria”;
- ahora: control runtime que aplica la migración sobre cinco valores preexistentes y comprueba que no se sobrescriban.

No requirió cambio de código ni nueva ronda del autor.

## D02 — residual post-merge

La evidencia AAL2 real sigue pendiente por decisión **D02=A** y ocurre después de mergear #159 a `develop`, promover `develop → staging`, dejar que el workflow aplique T-321 y comprobar manualmente con admin AAL2:

- `/admin/applicants`
- `/admin/merchants`
- `/admin/settings`

Esto no es un bloqueante pre-merge.

## Informe revisar-pr

```text
Informe revisar-pr — T-321 — 2026-10-01 — generado por revisión independiente
Resultado: SIN BLOQUEANTES
Checks: CI ✅ en 66a83c1e · preservación runtime ✅ · T-321 sin seed 10/10 ✅ · suite DB 1611/1611 ✅
BLOQUEANTES:
- Ninguno.
MEJORAS:
- Ninguna pendiente.
No revisado / residual aceptado:
- Evidencia AAL2 real en staging pendiente post-merge/post-promoción por D02=A.
```
