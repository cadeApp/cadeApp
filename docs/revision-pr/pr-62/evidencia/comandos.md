# Evidencia reproducible — PR #62 · T-101 · ronda 1

SHA revisado: **`ee247ac`**. Base: `origin/develop` = `ddef51a`. Fecha: 2026-09-23.

> **Esta ronda no ejecutó suites ni consultó CI**, por indicación de Lautaro073. Todo lo de abajo es lectura y
> barrido estático sobre el árbol local, que estaba limpio y en el head del PR.

---

## 1. Alcance

```bash
git fetch origin
git diff --name-only origin/develop...HEAD
```

```
docs/tasks/T-101.md
docs/tasks/log/T-101.md
src/server/rpc/offers.test.ts
src/server/rpc/offers.ts
src/types/database.types.ts
supabase/migrations/20260923050000_rpc_offers_v1.sql
supabase/tests/rpc_offers.sql
```

7 archivos. Contra «Archivos permitidos» de `docs/tasks/T-101.md` leída desde `origin/develop` más las dos líneas
que este PR agrega (`offers.test.ts` y `database.types.ts`, «autorizado por Lautaro073»): **0 fuera**.

## 2. Construcciones prohibidas y humo de seguridad

```bash
for f in src/server/rpc/offers.ts src/server/rpc/offers.test.ts; do
  grep -nE ':\s*any\b|as any|@ts-ignore|@ts-expect-error|\.only\(|\.skip\(|[a-zA-Z0-9_)\]]!\.' "$f"
done                                          # (sin coincidencias)
grep -rn "use client" src/server/             # (sin coincidencias)
grep -niE "using \(true\)" supabase/migrations/20260923050000_rpc_offers_v1.sql   # (ninguna)
```

## 3. Barrido mecánico: migración ↔ `rpc-contracts.ts` ↔ catálogo ↔ `seed.sql`

El script extrae de cada `create or replace function` los `message = 'CODE'`, los compara contra
`RPC_CONTRACTS[rpc].errorCodes` **en los dos sentidos**, verifica que todos estén en `DOMAIN_ERROR_CODES`, lista
los literales numéricos y cruza las claves de `platform_settings` usadas contra las sembradas.

```
## submit_offer
   security definer: si   search_path: public, pg_temp
   levanta (12): COURIER_NOT_APPROVED, COURIER_SUSPENDED, COURIER_UNAVAILABLE, DUPLICATE_ACTIVE_OFFER,
                 INVALID_STATE_TRANSITION, NOT_FOUND, OFFER_BELOW_MINIMUM, RATE_LIMITED, REQUEST_EXPIRED,
                 UNAUTHENTICATED, UNAUTHORIZED_ACTOR, VALIDATION_ERROR
   declara (12): (los mismos)
   OK: coinciden exactamente

## withdraw_offer
   levanta (6): NOT_FOUND, OFFER_NOT_PENDING, RATE_LIMITED, UNAUTHENTICATED, UNAUTHORIZED_ACTOR, VALIDATION_ERROR
   declara (7): + INVALID_STATE_TRANSITION
   !! declara y NO levanta: INVALID_STATE_TRANSITION

## set_availability
   levanta (6) = declara (6)
   OK: coinciden exactamente

## Literales numericos en la migracion
   or p_eta_minutes > 240
   if char_length(v_clean_message) > 280 then
   if v_rate_count > 10 then
   if v_rate_count > 10 then

## platform_settings
   usadas por la migracion: min_offer_ars
   sembradas en seed.sql:   min_offer_ars, request_ttl_minutes, pilot_active, pilot_terms_version,
                            subscription_grace_days
```

`max_offers_per_min` **no aparece en ninguna de las dos listas** — ver `H01`.

## 4. `plan(32)` contra las aserciones reales

```
plan declarado : 32
aserciones     : {"throws_ok":20,"lives_ok":5,"is":2,"ok":2,"has_function":3}
total contado  : 32
OK: coinciden
numerados en comentarios: 1..32 (32 numeros), sin huecos
```

Vale la nota de método: el primer conteo me dio 29 porque el `grep` se perdía `has_function` y algunos `is`/`ok`
inline. Reconté con un barrido antes de reportar una discrepancia de plan que no existía (`AG-55`).

## 5. `H01` · El tope del rate limit

```bash
grep -n "v_rate_count > " supabase/migrations/20260923050000_rpc_offers_v1.sql
# 103:  if v_rate_count > 10 then
# 215:  if v_rate_count > 10 then

grep -c "max_offers_per_min" supabase/migrations/*.sql supabase/seed.sql src/**/*.ts
# 0 en todos
```

El cuerpo del PR: *«contra `platform_settings.max_offers_per_min`»*.
La bitácora §4: *«Lectura dinámica de `min_offer_ars` **y `max_offers_per_min`** desde `public.platform_settings`»*.

## 6. `H02` · El fallback del wrapper

`src/server/rpc/offers.ts:77`

```ts
return 'VALIDATION_ERROR' as RpcErrorCode<K>;
```

Único cast del archivo. Ahí cae todo lo que no matchee: `57014` (statement_timeout), `40P01` (deadlock),
`53300` (too_many_connections), caída de conexión. Ninguna de las tres RPC declara `INTERNAL_ERROR`:

```bash
grep -A16 "submit_offer: {" src/domain/rpc-contracts.ts | grep -c INTERNAL_ERROR   # 0
```

## 7. `H05` · Por qué el «Contrato SQL» no cubre lo que dice

```bash
for p in "security definer" "set search_path" "for update" "for share" "insert into public.rate_limits"; do
  printf "%-32s %s\n" "$p" "$(grep -ci "$p" supabase/migrations/20260923050000_rpc_offers_v1.sql)"
done
```

```
security definer                 3
set search_path                  3
for update                       3
for share                        1
insert into public.rate_limits   2
```

`offers.test.ts:436-438` usa `toMatch(...)` sobre el archivo completo, así que **no distingue ninguno de esos
números de 1**. Y `allowedCodes` junta los `errorCodes` de las tres RPC en un solo `Set`, con la comparación en un
solo sentido: por eso el `INVALID_STATE_TRANSITION` sobredeclarado de `withdraw_offer` le es invisible.

## 8. `H03` · Por qué el contador no sobrevive a un fallo

Lectura del orden en `submit_offer`:

| línea | qué |
|---|---|
| 41 | `for share` sobre `couriers` |
| 81 | `for update` sobre `delivery_requests` |
| **97** | **upsert en `rate_limits`** |
| 107 | lectura de `min_offer_ars` |
| 116 | `OFFER_BELOW_MINIMUM` |
| 120 | `DUPLICATE_ACTIVE_OFFER` |
| 130 | `insert into public.offers` |

No hay bloque `exception` en ninguna de las tres funciones, así que cualquier `raise` posterior a la 97 propaga y
aborta la transacción, revirtiendo el upsert.

Cómo demostrarlo en rojo (para el agy, en pgTAP): resetear el contador, correr tres `throws_ok` con
`OFFER_BELOW_MINIMUM`, y después afirmar que el contador vale 3. Va a valer 0.

## 9. `H07` · Lo que la bitácora dice y el diff no

La bitácora §3 registra una ampliación autorizada de `public/brand/logo.svg`. El diff no toca `public/` y el
diff de `docs/tasks/T-101.md` solo agrega `src/server/rpc/offers.test.ts` y `src/types/database.types.ts`.

## 10. Lo que no se verificó

- **Nada ejecutado**: `pnpm typecheck`, `lint`, `test`, `test:coverage`, `build`.
- **`pnpm test:db`**: este entorno no tiene Docker, y además esta ronda no corre suites.
- **CI**: no consultado. Los 32 resultados pgTAP y los 160 casos de Vitest que declara el cuerpo del PR quedan
  **sin verificar de forma independiente** en esta ronda.
