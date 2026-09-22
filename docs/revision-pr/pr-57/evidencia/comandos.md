# PR #57 · Comandos y salidas

## Ronda 1 — `65f174f`

### Alcance

```bash
gh pr diff 57 --name-only
```

```
docs/adr/ADR-0001-supabase-baas.md
docs/adr/ADR-0002-hosting-and-cron.md
docs/adr/README.md
docs/adr/verify-adr.test.mjs
docs/tasks/T-007.md
docs/tasks/log/T-007.md
```

Los seis caen dentro de «Archivos permitidos» de `docs/tasks/T-007.md` leída desde `origin/develop`
(`docs/adr/**`, `docs/tasks/T-007.md`, `docs/tasks/log/T-007.md`, `docs/revision-pr/**`).
**0 fuera de alcance.**

### Checks locales

El árbol de trabajo ya estaba en la rama del PR y en su SHA exacto, así que no hizo falta worktree
ni cambiar de rama (que es lo que está prohibido, porque el árbol lo comparte el agy):

```bash
git rev-parse HEAD                                    # 65f174f8f06528afa0c971675fc82690ca0508f0
git rev-parse origin/feat/T-007-adr-0001-0002         # 65f174f8f06528afa0c971675fc82690ca0508f0
```

```bash
pnpm typecheck   # exit 0
pnpm lint        # exit 0 — "✔ No ESLint warnings or errors"
pnpm test        # Test Files 9 passed (9) · Tests 72 passed (72) · workflows 19/19
node --test docs/adr/verify-adr.test.mjs   # 1..5 · # pass 5 · # fail 0
```

Ningún archivo del repo se modificó en toda la revisión. Las demostraciones en rojo corrieron sobre
copias en el scratchpad de la sesión.

### CI

```bash
gh pr checks 57
```

```
approval-policy  fail  9s
audit            pass  29s
build            pass  1m7s
bundle-budget    pass  9s
db-tests         pass  3m42s
lint             pass  35s
typecheck        pass  33s
unit             pass  53s
```

#### `db-tests`: mirar el log, no el color

```bash
gh run view --job 106800625142 --log | grep -E "Tests=|Result:"
```

```
Files=3, Tests=98,  0 wallclock secs ( 0.02 usr  0.02 sys +  0.03 cusr  0.02 csys =  0.09 CPU)
Result: PASS
```

Verde de verdad: pgTAP corrió los 3 archivos y 98 aserciones. El límite de pulls anónimos de Docker
Hub (`PR54-H02`) volvió a aparecer —17 líneas de `toomanyrequests: Rate exceeded`— y esta vez la
corrida se recuperó sola. Cuarta corrida consecutiva con el síntoma.

#### `approval-policy`: por qué está en rojo — H08

```bash
gh run view --job 106800848179 --log | tail -5
```

```
Falta el informe completo de revisar-pr sin bloqueantes.
##[error]Process completed with exit code 1.
```

```bash
sed -n '23,38p' .github/workflows/approval-policy.mjs
```

```js
function hasCompleteReport(body) {
  const section = body
    .split(/^### Informe de revisión de agy[^\n]*$/m)[1]
    ?.split(/^### /m)[0] …
  return [
    /Informe revisar-pr\s*—\s*T-\d{3}/,
    /Resultado:\s*SIN BLOQUEANTES/,
    /Checks locales:/,
    /BLOQUEANTES:/,
    /MEJORAS:/,
    /No revisado \/ dudas para Lautaro073:/,
  ].every((part) => part.test(section));
}
```

El cuerpo del PR trae el informe con encabezado `## Informe de revisar-pr — PR #57 (T-007)` y otras
subsecciones, así que el `split` por `### Informe de revisión de agy` no encuentra sección y las seis
fallan. `Resultado: SIN BLOQUEANTES` es una de las seis, o sea que el job no puede ponerse verde
hasta que la ronda cierre sin bloqueantes: el arreglo del formato va al final.

---

## H01 · `notes` no está donde el ADR dice

```bash
grep -n "notes" docs/adr/ADR-0001-supabase-baas.md
```

```
16: …(`recipient_name`, `recipient_phone`, `dropoff_address`, `pickup_address`,
     `pickup_lat/lng`, `dropoff_lat/lng`, `notes`) jamás deben viajar al navegador antes
     del emparejamiento (`matched`)
56: La tabla `delivery_request_contacts` almacena … `recipient_phone` y `notes`.
```

```bash
sed -n '83,130p' supabase/migrations/20260922031435_schema_v1.sql | grep -n "notes"
```

```
8:  notes text,      <- dentro de create table public.delivery_requests (línea 90 del archivo)
```

`delivery_request_contacts` (línea 111) no tiene `notes`. Y la lectura del repartidor no acota columnas:

```bash
sed -n '270,277p' supabase/migrations/20260922051650_rls_v1.sql
```

```sql
create policy delivery_requests_select_courier on public.delivery_requests
  for select to authenticated
  using (
    app_private.is_approved_courier()
    and (
      (status = 'published' and (expires_at is null or expires_at > now()))
      or (accepted_offer_id is not null and app_private.is_accepted_offer_courier(accepted_offer_id, auth.uid()))
    )
  );
```

```bash
grep -n "grant\|revoke" supabase/migrations/20260922051650_rls_v1.sql | grep -v "function"
```

```
29:grant usage on schema app_private to authenticated, anon;
```

Ningún `grant select (…)` por columna sobre ninguna tabla: RLS decide la fila y el repartidor se
lleva todas las columnas, `notes` incluido.

---

## H03 · La clase completa: los 33 identificadores `snake_case` de los dos ADR

Esto es `AG-37` aplicado. En vez de reportar el primero que apareció, extraje todos los
identificadores entre backticks y los crucé contra el esquema de una sola vez:

```bash
node -e "
const fs=require('fs');
const hay = fs.readdirSync('supabase/migrations')
  .map(f=>fs.readFileSync('supabase/migrations/'+f,'utf8')).join('\n')
  + fs.readFileSync('supabase/seed.sql','utf8');
const adrs=['docs/adr/ADR-0001-supabase-baas.md','docs/adr/ADR-0002-hosting-and-cron.md'];
const set=new Map();
for(const a of adrs){const t=fs.readFileSync(a,'utf8');
  for(const m of t.matchAll(/\`([a-z][a-z0-9_]*(?:_[a-z0-9]+)+)\`/g)){
    if(!set.has(m[1])) set.set(m[1],[]);
    if(!set.get(m[1]).includes(a)) set.get(m[1]).push(a);}}
const falt=[...set.keys()].filter(k=>!hay.includes(k)).sort();
console.log('citados:', set.size, '· no existen:', falt.length);
falt.forEach(k=>console.log('  '+k));
"
```

```
citados: 33 · no existen: 13
  accept_offer          <- RPC de T-102, futura a propósito: OK
  auth_key              <- la columna es push_subscriptions.auth
  contacts_select_authorized
  distance_meters       <- approx_distance_m / route_distance_m
  dropoff_label         <- dropoff_zone_id
  final_amount_ars
  matched_courier_id    <- accepted_offer_id
  offered_amount_ars
  pg_dump               <- herramienta, no esquema: OK
  pickup_label          <- pickup_zone_id
  publish_request       <- RPC de T-103, futura: OK
  request_events
  submit_offer          <- RPC de T-101, futura: OK
```

Cuatro más que el cruce por substring no atrapa, porque son prefijos de nombres que sí existen o
viven fuera de `supabase/`:

```bash
grep -rn "zone_id" supabase/migrations/20260922031435_schema_v1.sql | head -2
#  pickup_zone_id uuid not null references public.zones (id),
#  dropoff_zone_id uuid not null references public.zones (id),

grep -n "one_accepted_per_request" supabase/migrations/20260922031435_schema_v1.sql
# 209:create unique index offers_one_accepted_per_request_idx
#      (el ADR:47 lo llama idx_offers_one_accepted_per_request)

grep -n "is_admin" supabase/migrations/20260922051650_rls_v1.sql | head -1
# 31:create or replace function app_private.is_admin()   (el ADR:59 lo llama is_admin())

grep -n "VAPID_PUBLIC_KEY" .env.example
# 67:NEXT_PUBLIC_VAPID_PUBLIC_KEY=…   (el ADR:71 lo llama VAPID_PUBLIC_KEY)
```

Y la policy que el ADR:57 describe como una sola:

```bash
grep -n "create policy contacts" supabase/migrations/20260922051650_rls_v1.sql
```

```
319:create policy contacts_select_merchant
323:create policy contacts_select_accepted_courier
327:create policy contacts_select_admin
331:create policy contacts_insert_merchant
335:create policy contacts_update_merchant
340:create policy contacts_write_admin
```

Son tres policies de `select`, una por actor. El diseño real es **mejor** que el que describe el ADR:
es exactamente lo que recomendó `AG-34` («cuando una policy mezcla actores con privilegios distintos,
conviene partirla en dos en vez de resolverlo con un `or`»).

---

## H04 · Los estados

```bash
grep -n "delivery_request_status as enum" supabase/migrations/20260922031435_schema_v1.sql
```

```
9:create type public.delivery_request_status as enum
   ('draft', 'published', 'matched', 'in_transit', 'delivered', 'cancelled', 'expired');
```

```bash
grep -n "'open'\|canceled\|merchants.status\|siga \`active\`" docs/adr/*.md
```

```
ADR-0001:45  Verifica que `status = 'open'` …
ADR-0001:46  Verifica que el comercio (`merchants.status = 'active'`, …) … y que el repartidor
             de la oferta siga `active`.
ADR-0001:60  Si el pedido se cancela (`canceled`) o sigue `open` …
ADR-0002:51  Busca solicitudes con `status = 'open'` y `expires_at <= now()`.
ADR-0002:67  A["Solicitud status = 'open'"]
ADR-0002:77  …filtra estrictamente `status = 'open' AND expires_at > now()`.
```

```bash
grep -n "courier_status as enum\|subscription_status" supabase/migrations/20260922031435_schema_v1.sql | head -3
```

```
4:create type public.merchant_subscription_status as enum ('pilot','active','expired','cancelled');
5:create type public.courier_status as enum ('pending','approved','rejected','suspended');
41:  subscription_status public.merchant_subscription_status not null default 'pilot',
```

`merchants` no tiene columna `status`, y `courier_status` no tiene el valor `active`: es `approved`,
igual que en Master Plan §6.1.

---

## H05 · El `[DATO]` de los backups contra el pendiente del plan

```bash
sed -n '109p' docs/adr/ADR-0001-supabase-baas.md
```

> …pero **no copian ni retienen los archivos binarios del bucket S3 (`courier-docs`)** (**`[DATO]`**).

```bash
grep -n "no entra en ningún backup" docs/master-plan.md
```

```
221:   - el bucket **no entra en ningún backup propio** (D8). Verificar que el backup de base de
     Supabase no copie los objetos de Storage (S3).
```

El plan lo deja como pendiente de verificación; el ADR lo publica como `[DATO]` sin fuente.

---

## H06 · El test no lo corre nadie

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('package.json','utf8')).scripts.test)"
```

```
vitest run && node --test .github/workflows/verify-workflows.test.mjs
```

```bash
grep -n "node --test\|pnpm test" .github/workflows/ci.yml
```

```
62:      - run: pnpm test:coverage
63:      - run: node --test .github/workflows/verify-workflows.test.mjs
```

`docs/adr/verify-adr.test.mjs` no aparece en ninguno de los dos. Tampoco lo alcanzan `lint`
(`--dir src --file middleware.ts` + los `.mjs` de `.github/workflows`) ni `typecheck`
(`tsc --noEmit` + el tsconfig de workflows).

**Consecuencia:** borrar los dos ADR deja `pnpm test` y los 8 jobs en verde.

---

## H07 · Demostración en rojo de la tautología

Sobre una copia en el scratchpad, **sin tocar el repo**:

```bash
cp -r docs/adr "$SCRATCH/adr-copia"
cd "$SCRATCH/adr-copia"
sed -i '/^## 7\. Revisión y conformidad del equipo/,$d' ADR-0001-supabase-baas.md
sed -i '/^## 6\. Revisión y conformidad del equipo/,$d' ADR-0002-hosting-and-cron.md
grep -c "Estado de revisión" ADR-0001-supabase-baas.md ADR-0002-hosting-and-cron.md
node --test verify-adr.test.mjs
```

```
ADR-0001-supabase-baas.md:0
ADR-0002-hosting-and-cron.md:0

ok 1 - 1. Existe el índice docs/adr/README.md con la convención [DATO] y [SUPUESTO]
ok 2 - 2. ADR-0001 documenta modelo relacional/ACID, RLS, push manual, backups/PITR …
ok 3 - 3. ADR-0001 incluye costos por ambiente en USD … y revisión de las 3 personas
ok 4 - 4. ADR-0002 documenta hosting en Vercel, cron /api/cron/sweep con CRON_SECRET …
ok 5 - 5. ADR-0002 incluye costos en USD … y revisión de las 3 personas
# pass 5 · # fail 0
```

Los tests 3 y 5 dicen verificar «revisión de las 3 personas» y pasan con las dos tablas de revisión
borradas, porque los tres nombres están en la línea 6 de cada ADR («Autores / Revisores»).

---

## H14 · Las etiquetas y las fuentes

```bash
for f in docs/adr/ADR-0001-supabase-baas.md docs/adr/ADR-0002-hosting-and-cron.md; do
  echo "$f DATO=$(grep -o '\[DATO\]' $f | wc -l) SUPUESTO=$(grep -o '\[SUPUESTO\]' $f | wc -l) http=$(grep -c http $f)"
done
```

```
docs/adr/ADR-0001-supabase-baas.md  DATO=30  SUPUESTO=13  http=0
docs/adr/ADR-0002-hosting-and-cron.md  DATO=34  SUPUESTO=22  http=1
```

64 `[DATO]` y una sola URL en los dos documentos, contra la definición del propio README
(«verificable en la documentación vigente del proveedor a la fecha de redacción»).

Y la convención no sale del plan, como dice `docs/adr/README.md:7`:

```bash
grep -c "\[DATO\]\|\[SUPUESTO\]" docs/master-plan.md
```

```
0
```

---

## Control propuesto — `verify-adr-identifiers.test.mjs`

Cuatro aserciones que **hoy fallan 4 de 4** y que después del arreglo tienen que quedar en verde.
Se corren desde la raíz del repo. La copia completa está en el scratchpad de la sesión; el cuerpo es:

```js
test('A. toda ruta de archivo citada por los ADR existe', …);
test('B. todo identificador de esquema citado por los ADR existe en supabase/migrations', …);
test('C. los ADR usan los valores reales de delivery_request_status', …);
test('D. pnpm test ejecuta la suite de verificacion de los ADR', …);
```

```
not ok 1 - A. toda ruta de archivo citada por los ADR existe
  rutas citadas que no existen:
    ADR-0001: supabase/tests/rls_and_invariants.test.sql
    ADR-0002: vercel.json                              <- futura a propósito
    ADR-0002: src/app/api/cron/sweep/route.ts          <- futura a propósito
    ADR-0002: src/lib/env.ts

not ok 2 - B. todo identificador de esquema citado por los ADR existe en supabase/migrations
  identificadores que no existen en el esquema:
    request_events, matched_courier_id, final_amount_ars, pickup_label, dropoff_label,
    offered_amount_ars, distance_meters, auth_key, merchant_user_id,
    contacts_select_authorized, idx_offers_one_accepted_per_request, default_expiry_minutes

not ok 3 - C. los ADR usan los valores reales de delivery_request_status
  estados que no estan en el enum
  (draft, published, matched, in_transit, delivered, cancelled, expired):
    ADR-0001: status = 'open' · ADR-0002: status = 'open' (x3)

not ok 4 - D. pnpm test ejecuta la suite de verificacion de los ADR
  el script test no corre la suite de ADR:
  vitest run && node --test .github/workflows/verify-workflows.test.mjs

1..4 · # pass 0 · # fail 4
```

**Advertencia sobre A, que es mía y hay que arreglarla antes de adoptarla:** tal como está escrita
señala `vercel.json` y `src/app/api/cron/sweep/route.ts`, que el ADR presenta correctamente como lo
que T-104 va a construir. Sin distinguir «ya existe» de «va a existir» —una convención de escritura,
por ejemplo `(T-104)` al lado de la ruta— el control nuevo nace con el defecto de H15,
`P07-coincidencia-demasiado-amplia`. **D no tiene ese problema y es la que más rinde**: una línea, y
cierra H06.
