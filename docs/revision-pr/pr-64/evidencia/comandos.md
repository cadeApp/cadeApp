# Evidencia · PR #64 · T-102

Dos rondas: `071ba95` y `570473d`. Por el método acordado con Lautaro073, **CI se mira recién cuando la ronda
está para aprobar** — la ronda 1 fue íntegramente estática y la 2 leyó los ocho jobs por dentro.

---

# Ronda 1 sobre `071ba95`

Revisión estática: esta ronda tiene bloqueantes, así que no se consultó ningún job ni se corrió ninguna suite.

## Preparación

```bash
git fetch origin
git worktree add --detach ../cadeApp-rev64 071ba95
git merge-base 071ba95 origin/develop     # 4ec86e2 = origin/develop -> sale limpia de develop
```

`origin/develop` ya contiene `20260923050000_rpc_offers_v1.sql`: **T-101 está mergeada** (PR #62, `19:36`), así
que la dependencia declarada por la ficha está cumplida.

La ficha se leyó desde `origin/develop`, como manda la skill (paso 1), no desde la rama:

```bash
blob=$(git ls-tree origin/develop docs/tasks/T-102.md | awk '{print $3}')
git cat-file -p $blob
```

## Alcance

```bash
gh pr diff 64 --name-only        # 10 archivos
```

Los 10 caen dentro de «Archivos permitidos». La ficha de develop dice «idem que T-101 + `rpc_accept.sql`»; la PR
la expande a 12 rutas y **la expansión es fiel**: coincide con la lista de T-101 con los documentos de la tarea
cambiados, sin agregar ninguna ruta nueva (ver `H06` por lo que sí se perdió).

La policy `offers_update_merchant` vive en una migración ya mergeada, y se la toca por `drop`+`create` en una
migración **nueva**, que es la forma que permite `AGENTS.md` §6.

```bash
git diff origin/develop 071ba95 -- '*.ts' '*.tsx' | grep -E "^\+" | grep -E "(: *any\b|@ts-ignore|\.only\(|\.skip\()"
# (sin coincidencias)
```

## Barrido mecánico

`scratchpad/barrido64.mjs` — normaliza CRLF antes de cualquier regex (`AG-60`).

```
## pgTAP
   plan declarado : 34
   aserciones     : 34 OK
   numeracion     : 1..34 (34 numeros)
   duplicados     : ninguno
   faltantes      : ninguno

## accept_offer · codigos
   levanta el SQL (10): ALREADY_MATCHED, COURIER_NOT_APPROVED, COURIER_SUSPENDED, INVALID_STATE_TRANSITION,
                        NOT_FOUND, OFFER_NOT_PENDING, REQUEST_EXPIRED, UNAUTHENTICATED, UNAUTHORIZED_ACTOR,
                        VALIDATION_ERROR
   declara contrato (11): las 10 + INTERNAL_ERROR
   !! levanta y NO declara: ninguno
   ii declara y NO levanta: INTERNAL_ERROR        <- correcto: lo produce el wrapper, no el SQL
   codigos fuera del catalogo DomainErrorCode: ninguno

## precedencia documentada (8 pasos)  ==  orden de raise del SQL  ==  orden del fake
```

Orden de `raise` en el SQL:

```
UNAUTHENTICATED -> UNAUTHORIZED_ACTOR -> VALIDATION_ERROR -> NOT_FOUND x4 -> UNAUTHORIZED_ACTOR ->
ALREADY_MATCHED -> REQUEST_EXPIRED -> INVALID_STATE_TRANSITION -> OFFER_NOT_PENDING ->
COURIER_SUSPENDED -> COURIER_NOT_APPROVED -> ALREADY_MATCHED (unique_violation)
```

Orden en el fake: `NOT_FOUND -> NOT_FOUND -> UNAUTHORIZED_ACTOR -> <idempotente> -> ALREADY_MATCHED ->
REQUEST_EXPIRED -> INVALID_STATE_TRANSITION -> OFFER_NOT_PENDING -> <courierCheck>`, con actor/rol y `safeParse`
resueltos antes en `executeRpc`. **Coinciden.**

## `H01` · mutación de las aserciones de locks

El barrido detecta la escritura que se revierte y las aserciones ciegas por separado:

```
## escritura antes de un raise en el mismo bloque (se revierte)
   !! update public.delivery_requests  ->  raise REQUEST_EXPIRED  (el update se revierte)
```

Mutaciones sobre el texto de la migración, evaluando los tres `toMatch` de `offers.test.ts:992-994`:

```
## original
    delivery_requests FOR UPDATE   PASA
    offers FOR UPDATE              PASA
    couriers FOR SHARE             PASA

## M1 · SIN el "for update" sobre offers
    delivery_requests FOR UPDATE   PASA
    offers FOR UPDATE              PASA      <- ciega
    couriers FOR SHARE             PASA

## M2 · SIN el "for update" sobre delivery_requests
    delivery_requests FOR UPDATE   PASA      <- ciega
    offers FOR UPDATE              PASA
    couriers FOR SHARE             PASA

## M3 · sin NINGUNO de los dos
    delivery_requests FOR UPDATE   FALLA
    offers FOR UPDATE              FALLA
    couriers FOR SHARE             PASA
```

Enumeración de la clase — son las únicas tres aserciones del archivo con ese comodín:

```bash
grep -n 'toMatch' src/server/rpc/offers.test.ts
#  992-994 usan [\s\S]*? ; las de T-101 (456-483) estan acotadas por bloque de funcion
```

## `H02` · dónde está la «concurrencia»

```bash
sed -n '313,335p' supabase/tests/rpc_accept.sql
#   do $$ ... for i in 1..10 loop  v_res := public.accept_offer(...)  end loop; $$;
#   una sesion, una transaccion: ningun lock se disputa

grep -n "Promise.all" src/server/rpc/offers.test.ts
#   test 6: Promise.all sobre createFakeRpcClient, que es sincrono
```

## `H03` · la escritura que no persiste

```bash
sed -n '128,137p' supabase/migrations/20260923170000_rpc_accept_offer_v1.sql
#   update public.delivery_requests set status = 'expired' ...
#   raise exception 'REQUEST_EXPIRED' using errcode = 'P0001';
```

El precedente, escrito por el mismo autor y ya mergeado en develop:

```bash
grep -n -B2 -A2 "rolls back" supabase/migrations/20260923050000_rpc_offers_v1.sql
#  108: -- Any subsequent RAISE EXCEPTION aborts the transaction and rolls back this increment
```

Y `submit_offer` de T-101, que lo hace bien —verifica y lanza, sin escribir:

```bash
awk '/create or replace function public\.submit_offer/,/^\$\$;/' \
  supabase/migrations/20260923050000_rpc_offers_v1.sql | grep -nE "REQUEST_EXPIRED|update public"
#  125:  or (v_req.status = 'published' and v_req.expires_at is not null and v_req.expires_at <= now())
#  127:  raise exception using errcode = 'P0001', message = 'REQUEST_EXPIRED';
```

## `H04` · colisión de numeración

```bash
git ls-tree --name-only origin/develop docs/contracts/
#  CC-001.md  CC-002.md  _plantilla.md
head -1 docs/contracts/CC-003.md
#  # CC-002 — INTERNAL_ERROR, precedencia canonica de accept_offer...
```

`CC-002.md` en develop se titula «Contratos y alcance para el ciclo de solicitudes». Y `offers.ts:48` cita
`CC-002` donde corresponde `CC-003`.

## `H05` · el 23505 que no escapa

```bash
sed -n '148,172p' supabase/migrations/20260923170000_rpc_accept_offer_v1.sql
#  las tres escrituras estan dentro de BEGIN ... EXCEPTION WHEN unique_violation
#  THEN raise 'ALREADY_MATCHED' (P0001) -> ningun 23505 llega a PostgREST
```

## Verificaciones que dieron bien

```bash
# 1. las 7 policies sobre offers, enumeradas (AG-37)
grep -n "create policy" supabase/migrations/*.sql | grep -i offers
#  offers_select_merchant / _courier / _admin, offers_insert_courier,
#  offers_update_courier / _merchant / _admin
#  ninguna otra deja escribir al comercio

# 2. el using de la policy nueva es identico al original; solo cambio el with check
awk '/create policy offers_update_merchant/,/;/' supabase/migrations/20260922051650_rls_v1.sql
#  original: congelaba 6 columnas y dejaba libre created_at  -> nuevo: with check (false)

# 3. no hay FORCE RLS, asi que el security definer puede escribir
grep -rn "force row level" supabase/migrations/    # (sin coincidencias)

# 4. los 20 throws_ok usan la forma de 4 argumentos (trampa AG-35 de la #56)
#    'P0001'::char(5) + el codigo de dominio como mensaje esperado + descripcion
```

## Falso positivo propio, anotado

Mi contador de argumentos de `throws_ok` reportó tres llamadas «con 5 args». Verificadas a mano: las tres tienen
4, y lo que pasaba es que la descripción contiene una coma («*Si el repartidor fue suspendido, …*») y el contador
partía por ahí. `AG-60` otra vez: antes de reportar lo que dice un script propio, reproducirlo por otra vía.

## Limpieza

```bash
git worktree remove --force ../cadeApp-rev64 && git worktree prune
```

---

# Ronda 2 · verificación de cierre sobre `570473d`

```bash
git fetch origin
git log --format="%h %an %s" 4efca15..origin/feat/T-102-rpc-accept-offer
#   570473d  fix(offers): resolve PR #64 round 1 findings D01, D02 and H01-H06
git worktree add --detach ../cadeApp-rev64b 570473d
git diff --stat 071ba95 570473d -- . ':(exclude)docs/revision-pr'    # 9 archivos, +86 -32
```

## `H01` · batería de mutación sobre el test 8

`scratchpad/mutar64.mjs` evalúa los tres regex nuevos (anclados con `[^;]*?`), la comprobación de orden por
índice y las dos mutaciones embebidas, sobre el cuerpo real y cinco mutaciones:

```
A · cuerpo real, regex anclado                       -> VERDE
B · sin el 'for update' de offers                    -> ROJO   (ronda 1: verde)
C · sin el 'for update' de delivery_requests         -> ROJO   (ronda 1: verde)
D · orden de locks invertido                         -> ROJO   (control nuevo)
E · cuerpo real pero con el regex viejo [\s\S]*?     -> ROJO   <- el decisivo
F · con el update a expired de vuelta                -> ROJO
```

El caso **E** es el que prueba que las aserciones `M1`/`M2` embebidas no son tautológicas: con el comodín viejo,
el `replace` de la mutación deja de ser específico y el `not.toMatch` falla. El control detecta que lo debiliten.

## `H03` · la escritura, y la afirmación sobre T-104

```bash
node scratchpad/barrido64.mjs | tail -3
#   ## escritura antes de un raise en el mismo bloque (se revierte)
#   (vacio)

# el comentario nuevo afirma que la transicion persistente la hace el cron de T-104: verificado
blob=$(git ls-tree origin/develop docs/tasks/T-104.md | awk '{print $3}')
git cat-file -p $blob | head -8
#   # T-104 — `/api/cron/sweep` (expiraciones, purga de documentos, suscripciones vencidas)
```

## `H04` · barrido de referencias

```bash
grep -rn "CC-002" src/ supabase/ docs/tasks/T-102.md docs/tasks/log/T-102.md docs/contracts/CC-003.md
#   src/domain/domain.test.ts:65    describe('CC-002 — Contratos del ciclo de solicitudes', ...
#   src/domain/domain.test.ts:1351  // ... la nueva guarda de aprobación de CC-002
```

Las dos son al `CC-002` **real** (el del ciclo de solicitudes, PR #66, cuyo título en develop es «Contratos y
alcance para el ciclo de solicitudes»). Correctas, no son residuos.

## Sin regresión

```
## pgTAP        plan 34 · 34 aserciones · 1..34 · sin duplicados ni faltantes
## codigos      levanta 10 ⊂ declara 11 · solo sobra INTERNAL_ERROR (lo produce el wrapper)
## precedencia  8 pasos documentados == orden de raise del SQL == orden del fake
```

## CI · `570473d` (primera vez que se mira en esta PR)

```
8/8 pass · mergeState=CLEAN
unit      Test Files 21 passed (21) · Tests 206 passed (206)
          offers.ts 100/100/100/100 · rpc-contracts.ts 100 · rpc-fake.ts 93.15 branch (umbral 90 perFile)
db-tests  Files=5, Tests=175 · All tests successful. · Result: PASS · los 5 archivos en ok
```

Cruce independiente del total pgTAP:

```bash
grep -hoE "plan\( *[0-9]+ *\)" supabase/tests/*.sql
#   2 + 55 + 34 + 43 + 41 = 175 = lo que reporta CI
```

### La diferencia con los números del cuerpo, perseguida

El cuerpo declara `18 passed (18)` / `192 passed`; CI da 21 / 206, y este commit no agregó archivos de prueba.

```bash
sha=$(git rev-parse 071ba95)
gh api "repos/cadeApp/cadeApp/actions/runs?head_sha=$sha" --jq '.workflow_runs[] | "\(.id) \(.name)"'
gh run view 35917191525 --log | grep "Test Files"      # 18 passed (18) -> el cuerpo era correcto

git log --format="%h %s" 4ec86e2..origin/develop
#   7f2b336 [T-111] Alta de comercio (#61)
git diff --name-only 4ec86e2 origin/develop | grep "\.test\."
#   src/features/merchants/{actions,queries,schemas}.test.ts   <- los 3 archivos que faltaban
```

CI corre sobre el merge de la PR con develop, y develop avanzó. **No es hallazgo.**

## Barrido sugerido para T-103 (ver `lecciones.md`)

```bash
# escrituras que un raise posterior revierte, en cualquier migracion
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8').replace(/\r\n/g,'\n');
for(const m of s.matchAll(/update public\.(\w+)[\s\S]{0,220}?raise exception/g))
  if(!/exception\s+when/.test(m[0])) console.log('!!', m[1]);" <migracion>
```

## Limpieza

```bash
git worktree remove --force ../cadeApp-rev64b && git worktree prune
```
