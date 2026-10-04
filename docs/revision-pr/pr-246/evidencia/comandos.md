# Evidencia reproducible — PR #246 / T-335

## SHA y alcance

```text
base develop: 3e5d5381dbf59717763f1927e1cf080504a9ebf1
head revisado: 7f6cf8b81b8e9fa7e35a82de47d5456fa40556a5
ahead_by: 4
behind_by: 0
changed_files: 5
```

Archivos:
- `docs/implementation-plan.md`
- `docs/tasks/T-335.md`
- `docs/tasks/log/T-335.md`
- `supabase/migrations/20261004000000_t335_realtime_publication.sql`
- `supabase/tests/t335_realtime_publication.sql`

Todos están dentro del alcance autorizado por #244.

## RED independiente observado

CI run `37174575155`, db-tests job `111354418877`, commit `3cb89eaca927642bdf8314ff86b3b3c200f17ce3`.

La publicación existía, pero las tablas no pertenecían a ella:

```text
Failed test 2: public.offers está incluida en supabase_realtime
Failed test 3: public.delivery_requests está incluida en supabase_realtime
Failed test 4: conjunto requerido
Missing records:
  (public,offers)
  (public,delivery_requests)
Files=18, Tests=1811
Result: FAIL
```

Esto demuestra que el control no es tautológico y que el defecto existía en el esquema recreado por migraciones.

## GREEN independiente observado

CI run `37174981896`, db-tests job `111355623961`, commit `a42a2685093ce23aff4c98ea6fe6b97e878090f7`.

```text
Applying migration 20261004000000_t335_realtime_publication.sql...
supabase/tests/t335_realtime_publication.sql ..... ok
All tests successful.
Files=18, Tests=1811
Result: PASS
```

## CI exact-head

CI run `37175300008` sobre `7f6cf8b81b8e9fa7e35a82de47d5456fa40556a5`:

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅

Vercel Preview: READY.

El trusted `e2e-preview` de esta PR no puede validar el efecto remoto de la migración en Supabase Develop antes del merge: por regla de ambientes, Develop se migra por CI después de mergear a `develop`. Por eso el DoD post-merge de #244 es material y no puede eliminarse.

## Inspección SQL

La migración:
- comprueba `pg_publication`;
- no hace DROP/CREATE destructivo de una publicación existente;
- agrega solo `public.offers` y `public.delivery_requests` si faltan;
- no toca RLS;
- no cambia `REPLICA IDENTITY`;
- no publica tablas adicionales.

El DB test consulta el catálogo real `pg_publication_tables` y queda fail-closed cuando faltan las membresías.

## Documentación Supabase vigente

La guía actual de Postgres Changes exige que cada tabla esté en `supabase_realtime`; el troubleshooting recomienda verificarlo con `pg_publication_tables`. También aclara que RLS sigue aplicándose a Postgres Changes.

## Seguridad revisada

`delivery_request_contacts` —donde viven dirección exacta, coordenadas, nombre y teléfono del destinatario— **no** se publica en T-335.

`delivery_requests` sí entrega su fila permitida por RLS al canal Realtime. Esto no concede una fila que la policy no permita seleccionar, pero el transporte puede incluir más columnas que el DTO `LiveAvailableRequestItem`; se deja registrado como propiedad arquitectónica de Postgres Changes, no como elevación nueva de privilegio de esta PR.

## PR246-H01

Issue #244 exige explícitamente:

```text
Después del merge y migrate-develop, PR #180 sincronizada ejecuta notifications.spec.ts:
Realtime, offline/form y reconnect deben quedar 3/3 GREEN.
```

En cambio, `docs/tasks/T-335.md` de la rama:
- elimina ese checkbox;
- marca todos los DoD restantes como `[x]`.

Y el body comienza con:

```text
Closes #244
```

Por lo tanto, mergear cerraría #244 antes de poder ejecutar el DoD que solo existe post-merge.

## PR246-H02

El body dice:

```text
los flujos reactivos de ofertas/pedidos solo consumen eventos INSERT
```

Eso no coincide con el código:
- `useAvailableRequests` omite `event` en sus subscriptions;
- `useTrip` omite `event`;
- `useRealtimeInvalidation` usa `event ?? '*'`.

La decisión de mantener `REPLICA IDENTITY DEFAULT` sigue siendo razonable porque los callbacks solo usan el evento como señal para invalidar y no dependen del contenido completo de `OLD`. La corrección requerida es documental, no `REPLICA IDENTITY FULL`.


## Ronda 2 — correcciones de H01/H02

SHA verificado: `e5f560810838d4678e29ba62cbe203bdb6b174ac`.

Desde el commit de revisión R1 `4f07e258b3e8541c1c65645043059f9d8148d1aa`, el autor solo cambió:
- `docs/tasks/T-335.md`
- `docs/tasks/log/T-335.md`

No cambió migración, DB test, RLS, hooks, E2E, workflows ni `docs/revision-pr/**`.

### H01
- DoD post-merge restaurado como `[ ]`.
- PR body usa `Refs #244`.
- El body repite el DoD post-merge abierto.
- La bitácora es append-only y deja #244 abierta.

### H02
El body ahora explica correctamente que `REPLICA IDENTITY DEFAULT` alcanza porque los eventos se usan como señal de invalidación y no se depende de `OLD` completo.

### Checks
CI previo funcional `37175300008`: GREEN completo.

CI de `e5f560810838d4678e29ba62cbe203bdb6b174ac`, run `37175915768`:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅

Vercel falla por cuota externa `api-deployments-free-per-day`; no es regresión de T-335.
