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

---

# Ronda 2 · 2026-09-23 · SHA `15e9b72`

Arreglos en `15e9b72`; fase roja de `H03` en su propio commit `b0e969b`. Igual que la ronda 1: **sin ejecutar
suites ni consultar CI**.

## 1. Qué cambió desde la ronda 1

```bash
git diff --numstat d529c61..15e9b72
```

```
 27   0  docs/contracts/CC-001.md            (nuevo)
  1   1  docs/implementation-plan.md
  5   1  docs/tasks/T-101.md
 38  24  docs/tasks/log/T-101.md
  3   1  src/domain/rpc-contracts.ts
 72  28  src/server/rpc/offers.test.ts
  6   5  src/server/rpc/offers.ts
 56  23  supabase/migrations/20260923050000_rpc_offers_v1.sql
  1   0  supabase/seed.sql
 89   6  supabase/tests/rpc_offers.sql
```

Alcance total del PR: 16 archivos, todos dentro de la ficha ampliada (`supabase/seed.sql`,
`src/domain/rpc-contracts.ts`, `docs/contracts/**` y `docs/implementation-plan.md` se sumaron citando `D02`,
`D03` y `D01`/`D04`).

## 2. Barrido mecánico, mismo script que la ronda 1

```
platform_settings
   usadas por la migracion: max_offers_per_min, min_offer_ars
   sembradas en seed.sql:   min_offer_ars, max_offers_per_min, request_ttl_minutes,
                            pilot_active, pilot_terms_version, subscription_grace_days

Literales numericos en la migracion:
   or p_eta_minutes > 240
   if char_length(v_clean_message) > 280 then
   (los dos `if v_rate_count > 10` desaparecieron)

plan declarado : 43
aserciones     : {"throws_ok":27,"lives_ok":5,"is":4,"ok":1,"has_function":3,"is_definer":3}
total contado  : 43   OK
```

**Falso positivo conocido de mi script:** sigue reportando «declara y NO levanta: `INTERNAL_ERROR`» en las tres
RPC. Es correcto que el SQL no lo levante — lo produce el wrapper. El test 4 del PR sí codifica esa regla
(`declaredSqlCodes = declared − INTERNAL_ERROR`), o sea que su control es más preciso que mi barrido.

## 3. `H01` cerrado

```bash
grep -n "max_offers_per_min" supabase/seed.sql supabase/migrations/20260923050000_rpc_offers_v1.sql | head
```

```
seed.sql:13:  ('max_offers_per_min', '10'::jsonb),
migración:4-7:  insert into public.platform_settings (key, value)
                values ('max_offers_per_min', '10'::jsonb) on conflict (key) do nothing;
migración:  select (value #>> '{}')::integer into v_max_offers_per_min ... (×2)
migración:  if v_rate_count > v_max_offers_per_min then                  (×2)
```

Y el control que lo prueba dinámico, test 33: baja la clave a `3`, comprueba `RATE_LIMITED` en la 4.ª oferta y
la restaura a `10`.

## 4. `H02` cerrado

```bash
git diff d529c61..15e9b72 -- src/server/rpc/offers.ts
```

- `return 'VALIDATION_ERROR' as RpcErrorCode<K>;` → `return 'INTERNAL_ERROR';` (sin cast)
- Los tres `safeParse` de output fallido pasaron de `VALIDATION_ERROR` a `INTERNAL_ERROR`, que no pedí y es
  correcto.
- `CC-001` registra el cambio de contrato.

## 5. `H03` cerrado, con demostración en rojo

Commit `b0e969b`, salida pegada en el cuerpo del PR:

```
# Failed test 36: "…si las llamadas con OFFER_BELOW_MINIMUM persistieran su incremento,
#                  el contador valdría 3 (vale 0)"
#         have: 0
#         want: 3
```

Después invertido a `is(…, 0)` como guardia de regresión (tests 34-37).

## 6. `H05` cerrado — el test quedó mejor que mi barrido

`offers.test.ts:427` ahora:

```ts
const rawBlocks = sql.split(/create\s+or\s+replace\s+function\s+public\./i).slice(1);
expect(rawBlocks.length).toBe(3);
// … mapea bloque → nombre, compara el conjunto de nombres
for (const rpcName of expectedRpcs) {
  expect(block, `${rpcName}: falta SECURITY DEFINER`).toMatch(/security\s+definer/i);
  // … search_path y for update dentro de CADA bloque
  const declaredSqlCodes = new Set(declaredCodes.filter((c) => c !== 'INTERNAL_ERROR'));
  expect([...raisedInSql].sort()).toEqual([...declaredSqlCodes].sort());   // bidireccional, por RPC
}
```

## 7. `H10` · La divergencia de precedencia

Orden de la RPC, leído de `20260923050000_rpc_offers_v1.sql`:

```
actor → repartidor → parámetros → OFFER_BELOW_MINIMUM → RATE_LIMITED → solicitud → DUPLICATE_ACTIVE_OFFER
```

Orden del fake, leído de `rpc-fake.ts:506-540`:

```
solicitud/repartidor faltante → REQUEST_EXPIRED → INVALID_STATE_TRANSITION → elegibilidad →
OFFER_BELOW_MINIMUM → DUPLICATE_ACTIVE_OFFER
```

Combinaciones que discrepan:

| Entrada | RPC | Fake | ¿nueva? |
|---|---|---|---|
| Monto bajo el piso + solicitud inexistente | `OFFER_BELOW_MINIMUM` | `NOT_FOUND` | sí (`H09`) |
| Monto bajo el piso + solicitud vencida | `OFFER_BELOW_MINIMUM` | `REQUEST_EXPIRED` | sí (`H09`) |
| Monto bajo el piso + solicitud en `draft` | `OFFER_BELOW_MINIMUM` | `INVALID_STATE_TRANSITION` | sí (`H09`) |
| Repartidor suspendido + solicitud vencida | `COURIER_SUSPENDED` | `REQUEST_EXPIRED` | no |
| Repartidor suspendido + solicitud inexistente | `COURIER_SUSPENDED` | `NOT_FOUND` | no |
| En el tope + solicitud vencida | `RATE_LIMITED` | `REQUEST_EXPIRED` | no |

## 8. `H11` · El fake no tiene rate limit

```bash
grep -c "RATE_LIMITED\|maxOffersPerMin\|rateLimit" src/domain/testing/rpc-fake.ts   # 0
sed -n '35,41p' src/domain/testing/rpc-fake.ts
```

```ts
export interface FakePlatformSettings {
  readonly minOfferArs: number;
  readonly requestTtlMinutes: number;
  readonly pilotActive: boolean;
  readonly pilotTermsVersion: string;
  readonly subscriptionGraceDays: number;
}
```

Sin `maxOffersPerMin`, y `assertValidFakeOptions` exige explícitamente las otras cinco.

## 9. `H12` · Numeración duplicada

```bash
grep -nE "^-- [0-9]" supabase/tests/rpc_offers.sql | tail -5
```

```
321:-- 31-33. …
335:-- 32. D04 / H04: …
350:-- 33. D02 / H01: …
```

El barrido de numeración da 45 números para el rango `1..43`. Las aserciones y el `plan(43)` están bien.

## 10. Lo que no se verificó

- **Nada ejecutado**: `pnpm typecheck`, `lint`, `test`, `test:coverage`, `build`, `test:db`.
- **CI**: no consultado. El cuerpo declara `18 passed (18)` y `160 passed (160)`; `offers.test.ts` sigue teniendo
  4 casos `it()`, así que es plausible, pero no está verificado de forma independiente.
