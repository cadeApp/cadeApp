# Ronda 1 — PR #159 / T-321

**Fecha:** 2026-10-01  
**SHA revisado:** `680511dc625ce3fec4a65e0b7268a3a7a955512e`  
**Base:** `develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a`  
**Resultado:** **CON BLOQUEANTES (1)**

## Alcance revisado

Diff de 5 archivos:

- `docs/tasks/log/T-321.md`
- `src/features/admin/queries.test.ts`
- `src/features/admin/queries.ts`
- `supabase/migrations/20260930224700_t321_admin_staging_bootstrap.sql`
- `supabase/tests/t321_admin_staging_bootstrap.sql`

Todos estaban dentro de los archivos permitidos originales de la ficha. La ampliación a `.github/workflows/ci.yml` todavía no está implementada: fue autorizada por Lautaro073 durante esta ronda como D01=A y deberá quedar reflejada en la ficha cuando se haga el arreglo.

## Lo que está correcto

### Embeds PostgREST

Se enumeró la clase completa de embeds de `profiles` dentro de `src/features/admin/queries.ts`. Hay cuatro ocurrencias:

1. `getApplicantsQueue` → `profiles!couriers_profile_id_fkey`
2. `getApplicantDetail` → `profiles!couriers_profile_id_fkey`
3. `getAdminMerchants` → `profiles!merchants_profile_id_fkey`
4. `AUDIT_SELECT`, usado por `getAuditLog` y `getRecentSettingChanges` → `profiles!audit_log_actor_id_fkey`

Los tres nombres existen en los tipos generados. No quedó ninguna variante `profiles:profile_id` ni `profiles:actor_id` en el archivo.

La evidencia RED del autor también es real: en el commit `118042c3eaceb0a18ac9380168e389a2e584c024`, anterior a la implementación, el job unit terminó con **5 failed / 1520 passed**, exactamente en los cinco casos T-321. Por lo tanto esa parte del DoD sí tiene RED real y un control que observa el string enviado a `.select()`.

## BLOQUEANTES

### PR159-H01 — el control de bootstrap no prueba la migración que dice proteger

**Archivo principal:** `supabase/tests/t321_admin_staging_bootstrap.sql`  
**Relacionado:** `supabase/seed.sql`, `supabase/migrations/20260930224700_t321_admin_staging_bootstrap.sql`  
**Severidad:** alto · **Patrón:** `P08-control-no-cubre-lo-que-dice`

La ficha exige dos mutaciones explícitas para este control:

- quitar uno de los cinco inserts/defaults de la migración debe ponerlo rojo;
- cambiar `ON CONFLICT (key) DO NOTHING` por una actualización destructiva debe ponerlo rojo.

El pgTAP actual no puede demostrar ninguna.

Primero, el CI arranca Supabase aplicando las migraciones y **después ejecuta `supabase/seed.sql`**. Ese seed vuelve a insertar los cinco valores de T-321 con `DO UPDATE`. Las aserciones 1–10 miran solamente el estado final de `platform_settings`; por lo tanto pueden quedar verdes aunque la migración T-321 deje de insertar los defaults.

Segundo, la aserción 11 tampoco ejerce la migración. Modifica `min_offer_ars` a 1500 y después ejecuta un **nuevo `INSERT ... ON CONFLICT DO NOTHING` escrito dentro del test**. Probar que ese SQL local conserva 1500 no demuestra que el archivo de migración siga usando esa semántica. Cambiar la migración real a `DO UPDATE SET value = excluded.value` no cambia el SQL de la prueba 11.

La batería independiente de la revisión deja las dos mutaciones escritas en `evidencia/comandos.md`:

- **M01:** eliminar en memoria el `INSERT INTO public.platform_settings ... DO NOTHING` completo de la migración. El seed sigue aportando los cinco defaults que observan las aserciones.
- **M02:** sustituir en memoria el `DO NOTHING` de la migración por `DO UPDATE SET value = excluded.value`. La aserción 11 sigue ejecutando su propio `DO NOTHING`.

Por decisión D01=A, el arreglo debe:

1. ampliar la ficha para permitir `.github/workflows/ci.yml`;
2. en `db-tests`, resetear temporalmente la base con `--no-seed` y correr específicamente `supabase/tests/t321_admin_staging_bootstrap.sql` antes de restaurar el estado normal y correr la suite DB completa;
3. agregar en el mismo job un control de fuente sobre **el archivo real de migración** que verifique los cinco pares key/valor y `ON CONFLICT (key) DO NOTHING`;
4. auto-mutar ese texto en memoria y comprobar que el control detecta M01 y M02. No modificar el archivo real para producir el RED.

No alcanza con agregar más asserts sobre la tabla después del seed, ni con copiar otra vez el SQL esperado dentro del pgTAP.

**Estado:** abierto.

## DECISIÓN ACEPTADA

### PR159-H02 — evidencia real en staging después del merge/promoción

La ficha pedía evidencia real en `cadeapp-staging` después de aplicar la migración, pero el flujo del repositorio solo ejecuta `migrate-staging` cuando hay push a la rama `staging`. Esta PR apunta a `develop`, así que la migración T-321 no puede estar en el staging remoto antes del merge y de una promoción posterior sin saltarse el flujo normal.

Lautaro073 eligió **D02=A**:

- no aplicar manualmente la migración remota;
- no empujar esta feature directamente a `staging`;
- cerrar primero la revisión de código;
- mergear #159 a `develop`;
- promover `develop → staging`;
- esperar que `migrate-staging` aplique las migraciones;
- recién entonces correr con admin AAL2 `/admin/applicants`, `/admin/merchants` y `/admin/settings`, y registrar solo fecha/rutas/resultado, sin credenciales ni PII.

Este punto queda **aceptado** y no cuenta como bloqueante pre-merge.

## Checks y evidencia

- Rama contra develop: `ahead_by=3`, `behind_by=0`, merge base = `9e232d0e...`.
- PR: `mergeable=true`.
- Colisión de migración en develop: no existe el mismo archivo.
- RED previo embeds: `118042c3...` → **5 failed / 1520 passed**.
- CI del SHA revisado: run `36803697869`, todos los jobs verdes.
- `db-tests`: **Files=13, Tests=1612, Result: PASS**.
- Base local/Docker: **no levantada**, según la regla de revisión; los dos mutantes SQL se documentan por inspección + CI verde y con arnés estático independiente.

## Informe revisar-pr

```text
Informe revisar-pr — T-321 — 2026-10-01 — generado por revisión independiente
Resultado: CON BLOQUEANTES (1)
Checks locales: typecheck n.a. · lint n.a. · test n.a. · test:db ✅ CI (Files=13, Tests=1612, Result: PASS)
BLOQUEANTES:
- [supabase/tests/t321_admin_staging_bootstrap.sql, prueba de bootstrap] El pgTAP observa valores reinyectados por seed.sql y la prueba 11 ejecuta su propio DO NOTHING, por lo que no detecta que la migración pierda un default o cambie a DO UPDATE → aislar T-321 sin seed en CI y agregar un control de fuente auto-mutado sobre la migración real.
MEJORAS:
- Ninguna.
No revisado / dudas para Lautaro073:
- Evidencia AAL2 real en staging diferida por D02=A a después del merge de #159 y promoción develop → staging.
```
