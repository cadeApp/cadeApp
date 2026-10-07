# Informe de revisión — PR #302 / T-348

**PR:** https://github.com/cadeApp/cadeApp/pull/302  
**Head SHA revisado:** `ff0e289dacb6a424c4d7da87b1661258224d0cc4`  
**Base:** `develop` @ `d3fa4ccfeff13299ed82b6529be20d521bb79f77`  
**Fecha:** 2026-10-07

## Resultado

**CON BLOQUEANTES (2).**

La migration productiva está bien orientada: conserva ownership, actor operativo activo y las columnas de suscripción, elimina únicamente la congelación de `notes`, y no agrega INSERT/GRANT/`security definer`.

Los bloqueantes están en la demostración de seguridad del pgTAP y en la evidencia declarada.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alto | `supabase/tests/rls_matrix.sql:332` | 24b prueba INSERT ajeno, no INSERT self | test-coverage / P08 |
| H02 | medio | body PR #302 | se marca RED de cada prueba nueva aunque 24b pasó en el run RED | conventions / P15 |

## 1. 🔴 PR302-H01 — El test de INSERT no prueba una policy INSERT self

**Archivo:** `supabase/tests/rls_matrix.sql:332`  
**Estado:** [ANÁLISIS]

### Diagnóstico

La ficha exige explícitamente que **no exista INSERT self** en `public.merchants`.

El caso 24b actual ejecuta como:

```sql
select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
```

pero intenta:

```sql
insert into public.merchants (profile_id)
values (pg_temp.courier_approved_1_id())
```

Eso prueba que `merchant_1` no puede insertar **una fila de otro perfil**.

No prueba la propiedad declarada «self insert denegado».

### Evidencia / contraejemplo

Una regresión como esta:

```sql
create policy merchants_insert_self on public.merchants
  for insert to authenticated
  with check (
    profile_id = auth.uid()
    and app_private.is_active_operational_actor()
  );
```

seguiría dejando **GREEN** al caso 24b actual: `auth.uid()` sería `merchant_1_id()`, pero el INSERT intenta usar `courier_approved_1_id()`, así que la propia policy self lo rechazaría con 42501.

Por lo tanto el control no detecta exactamente la regresión que dice cubrir.

Además, en el run RED `37686516191`, 24b ya pasó; el único fallo de `rls_matrix.sql` fue el caso 27 de pgTAP («merchant can update business_name and notes»).

### Arreglo mínimo

Reutilizar `merchant_idle_id()`, que ya es merchant activo y no vuelve a usarse después del caso 11:

1. antes de 24b, volver temporalmente a `postgres`;
2. eliminar su fila `public.merchants`;
3. actuar como `merchant_idle_id()`;
4. intentar insertar **su propio** `profile_id`;
5. exigir SQLSTATE `42501`;
6. restaurar actor `merchant_1_id()` antes del caso 25.

Esquema conceptual:

```sql
select pg_temp.reset_actor();
delete from public.merchants
where profile_id = pg_temp.merchant_idle_id();

select pg_temp.act_as('authenticated', pg_temp.merchant_idle_id());

select throws_ok(
  'insert into public.merchants (profile_id) values (pg_temp.merchant_idle_id())',
  '42501'::char(5),
  null::text,
  'merchant cannot insert its own merchant row directly'
);

select pg_temp.act_as('authenticated', pg_temp.merchant_1_id());
```

No hace falta aumentar `plan(65)`: reemplaza el 24b actual.

### Cómo verificar

El test corregido debe demostrar sensibilidad real a una policy INSERT self:
- schema correcto → GREEN;
- policy INSERT self temporal → el caso debe quedar RED porque el INSERT propio deja de lanzar 42501;
- restaurar la mutación → GREEN.

No adulterar SQLSTATE ni expectativas para fabricar el RED.

## 2. 🔴 PR302-H02 — El body declara RED para cada prueba nueva, pero 24b nunca quedó RED

**Archivo:** body de PR #302  
**Estado:** [VERIFICADO]

### Diagnóstico

El body marca:

```text
[x] Cada prueba nueva se demostró fallando al romper la regla
```

Pero el run RED propio `37686516191` muestra:

```text
Failed test 27: "merchant can update business_name and notes"
Looks like you failed 1 test of 65
```

Es decir:
- el cambio del caso 24 sí quedó RED;
- el caso 24b nuevo **pasó**.

La bitácora también dice explícitamente que «los casos 24b y 25 pasan».

### Arreglo

Hasta demostrar H01:
- desmarcar ese checkbox o aclarar que 24b está pendiente;
- después de obtener RED real para 24b, registrar SHA/run/fallo exacto y volver a marcarlo.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| Nombre de migration contiene `t313` | La ficha T-348 autoriza exactamente ese archivo, heredado del split D04-A. |
| `e2e-preview` está error/skipped | Es esperado: `e2e-preview-target.mjs` bloquea PRs con migration pendiente de Develop. |
| `approval-policy` está rojo | El log dice únicamente «Falta el informe completo de revisar-pr sin bloqueantes»; es esperado mientras esta ronda tenga bloqueantes. |
| La migration no toca `database.types.ts` | No cambia columnas, enum, RPC ni tipos del schema. |
| `notes` deja de estar congelado | Es el objetivo aprobado de T-348/D04-A; el formulario de onboarding ya expone «Referencia adicional». |

## Checks y evidencia

### RED propio

`21bcef1b5ac8e1311295cca9c25efb99a0867c47` · CI `37686516191`:
- `db-tests` ❌: exactamente 1/65 en `rls_matrix.sql`, el update `business_name + notes` con 42501.
- `unit` ❌ por `verify-fichas`: T-348 no tenía todavía como primer DoD el texto de su fila del plan.
- typecheck/lint/build/audit/bundle-budget ✅.

### GREEN actual

`ff0e289dacb6a424c4d7da87b1661258224d0cc4` · CI `37687474742`:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅
- Vercel ✅
- trusted Preview: bloqueado por migration, esperado.

Suite unit: 123/123 archivos, 1941/1941 tests.  
DB: migration aplicada en runner y `Result: PASS`.

No ejecuté `pnpm test:db` local: la regla del proyecto evita levantar Docker/Supabase local salvo pedido expreso; se usó el job oficial `db-tests`.

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| db-tests GREEN | La policy actual y el SQL actual cumplen la matriz | Que 24b falle específicamente si aparece una policy **INSERT self** |
| unit/typecheck/lint/build | Código/documentación coherentes | Sensibilidad del pgTAP a esa regresión RLS |
| approval-policy | Formato/informe | Está rojo hasta una revisión sin bloqueantes |
| e2e-preview | N/A para esta PR | Bloqueado intencionalmente hasta aplicar migration en Develop |

## Checklist de verificación final

- [x] Diff dentro del alcance de la ficha.
- [x] Rama 0 behind de `develop`.
- [x] Migration mantiene ownership/active actor.
- [x] Migration no agrega INSERT, GRANT ni SECURITY DEFINER.
- [x] `subscription_status` y `paid_until` siguen congelados.
- [x] RED real del update de `notes`.
- [ ] RED real del nuevo test que protege ausencia de INSERT self.
- [ ] Body coherente con la evidencia real.
- [ ] approval-policy GREEN con informe independiente sin bloqueantes.
- [ ] Revisión ronda 2.

## Metodología

Inspección completa del diff y de la clase de políticas/tests de `public.merchants`, comparación con CC-007 y análisis de los logs CI RED/GREEN. No se tocaron archivos productivos durante la revisión.
