# Ronda 2 — PR #159 / T-321

**Fecha:** 2026-10-01  
**SHA revisado:** `ce5e3a19f3dfba71da4ccd47610b06beee3a2de2`  
**Base:** `develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a`  
**Resultado:** **CON BLOQUEANTES (1)**

## Sincronización y autoría de la carpeta

La rama está dos commits por delante del último commit de revisión `45c54d7`. Esos dos commits son del autor:

- `c59934c` — arreglo de H01;
- `ce5e3a1` — actualización de la bitácora.

El diff desde `45c54d7` toca solamente:

- `.github/workflows/ci.yml`
- `docs/tasks/T-321.md`
- `docs/tasks/log/T-321.md`
- `supabase/tests/t321_admin_staging_bootstrap.sql`

No hubo escrituras del autor en `docs/revision-pr/pr-159/**`.

La ampliación de `.github/workflows/ci.yml` coincide exactamente con D01=A: no amplía producto, contratos ni datos; solo agrega el control de bootstrap autorizado.

## PR159-H01 — arreglado y verificado

La corrección resolvió las dos fallas de ronda 1:

1. T-321 se ejecuta sobre una base reconstruida con `pnpm supabase db reset --no-seed`; por lo tanto `seed.sql` ya no puede reinyectar los cinco defaults antes del pgTAP específico.
2. El pgTAP pasó de 11 a 10 aserciones y se eliminó el bloque que volvía a escribir un `INSERT ... DO NOTHING` dentro del test.

El log real de `db-tests` del SHA revisado demuestra:

```text
supabase/tests/t321_admin_staging_bootstrap.sql .. ok
All tests successful.
Files=1, Tests=10
Result: PASS

T321_MIGRATION_BASELINE GREEN
T321_M01 RED_OK: missing:min_offer_ars=1000, missing:request_ttl_minutes=30, missing:pilot_active=true, missing:pilot_terms_version=v1, missing:subscription_grace_days=0, missing:ON_CONFLICT_DO_NOTHING
T321_M02 RED_OK: missing:ON_CONFLICT_DO_NOTHING

...
Files=13, Tests=1611
Result: PASS
```

Por eso `PR159-H01` pasa a **arreglado-verificado** en `ce5e3a19...`.

## BLOQUEANTE

### PR159-H03 — el checker acepta `DO UPDATE` si `DO NOTHING` aparece en un comentario

**Archivo:** `.github/workflows/ci.yml`, checker T-321 dentro de `db-tests`  
**Severidad:** alto · **Patrón:** `P08-control-no-cubre-lo-que-dice`

El checker actual evalúa las cinco parejas key/valor y la cláusula:

```js
/on\s+conflict\s*\(key\)\s*do\s+nothing\s*;/i
```

contra **todo el texto de la migración**, incluidos comentarios.

La batería independiente M03 hace únicamente esto en una copia:

```sql
on conflict (key) do update set value = excluded.value;
-- on conflict (key) do nothing;
```

La semántica queda destructiva, pero el checker sigue devolviendo:

```text
M03 CONTROL_CIEGO: DO UPDATE + comentario señuelo mantiene el checker GREEN.
T321_MIGRATION_BASELINE GREEN
```

Y el pgTAP sin seed tampoco lo detectaría: al reconstruir una base fresca no existe un valor previo con el cual entrar en conflicto, así que la rama `DO UPDATE` nunca se ejerce.

Este agujero **sale directamente de la implementación que la revisión pidió en ronda 1**. El autor siguió el patrón indicado; la revisión anterior no había atacado comment-bait. Se corrige en esta ronda y queda registrado como deuda de la propia revisión.

### Arreglo requerido

Mantener el pgTAP sin seed, pero endurecer el checker de fuente:

1. eliminar comentarios SQL (`-- ...` y `/* ... */`) antes de validar;
2. extraer el único `INSERT INTO public.platform_settings (key, value) VALUES ...;` real;
3. exigir exactamente un insert objetivo;
4. validar las cinco parejas dentro de ese statement, no en el archivo completo;
5. exigir que ese mismo statement termine en `ON CONFLICT (key) DO NOTHING;`;
6. rechazar `DO UPDATE` dentro del statement;
7. conservar M01/M02 y sumar M03 + M04 como mutaciones en memoria.

El prompt del comentario deja código exacto.

## MEJORA

### PR159-H04 — cuerpo de PR desactualizado

El cuerpo todavía dice:

- pgTAP de **11** aserciones “cubriendo ... idempotencia”;
- `db-tests`/evidencia previa con **1612** tests.

El SHA revisado tiene 10 aserciones y la suite DB completa informa 1611. Actualizar esas frases después de corregir H03 para que la descripción no contradiga la evidencia actual.

## Decisión H02

D02=A sigue vigente y no cambia: la prueba real AAL2 de las tres rutas admin se hace después de mergear #159, promover `develop → staging` y dejar que `migrate-staging` aplique la migración. No es bloqueante pre-merge.

## Informe revisar-pr

```text
Informe revisar-pr — T-321 — 2026-10-01 — generado por revisión independiente
Resultado: CON BLOQUEANTES (1)
Checks locales: typecheck n.a. · lint n.a. · test n.a. · test:db ✅ CI del SHA ce5e3a19 (T-321 sin seed: Files=1, Tests=10, PASS; suite completa: Files=13, Tests=1611, PASS)
BLOQUEANTES:
- [.github/workflows/ci.yml, checker T-321] La validación busca ON CONFLICT ... DO NOTHING en todo el texto y acepta esa cadena dentro de un comentario; M03 deja la migración en DO UPDATE destructivo y el checker sigue GREEN → limpiar comentarios, aislar el statement real y validar la cláusula sobre ese statement; sumar M03/M04.
MEJORAS:
- [cuerpo de PR] Actualizar 11→10 aserciones y 1612→1611 tests; la idempotencia ahora la controla CI por contrato de migración, no el pgTAP.
No revisado / dudas para Lautaro073:
- Evidencia AAL2 real en staging pendiente post-merge/post-promoción por D02=A.
```
