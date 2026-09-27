# Evidencia — PR #115 / CC-012

## Ronda 1

SHA funcional revisado: `c4b8734e55b46bbdc0cf35d905ee7191dd7c0b03`

Base: `develop@5772cb3b1eef7a91a5d0a5a61d2d8cbb0fa5ae28`

### Preflight

```text
branch: cc/CC-012-incidents
ahead of develop: 1
behind develop: 0
changed files: 15
reviewer folder before review: absent
```

No se observó contaminación de `docs/revision-pr/pr-115/**` por parte del autor.

### CI — run 36310359422

```text
audit           PASS
unit            PASS
lint            PASS
typecheck       PASS
build           PASS
bundle-budget   PASS
db-tests        FAIL
```

En `db-tests`:

```text
rls_matrix.sql   ok
rpc_admin.sql    ok
rpc_requests.sql ok

structure.sql:
ERROR: new row for relation "incidents" violates check constraint "incidents_kind_valid"
Failing row ... kind = delay ...

Files=12, Tests=1593
Result: FAIL
```

El fixture responsable está en `supabase/tests/structure.sql` y conserva `'delay'`.

Como `pnpm supabase test db` aborta, el paso siguiente del job:

```bash
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
```

no llega a completar. Por tanto los tipos commiteados aún no tienen la comparación CI definitiva.

### Inspección de SQL

Se verificó por inspección que el SHA revisado:

- restringe `report_incident` a merchant/courier y exige consentimiento activo;
- aplica D05-A;
- valida kind/description/contacto en Postgres;
- deriva el courier de la oferta accepted en `admin_resolve_incident`;
- hace suspensión + retiro de ofertas + resolución + auditoría en una transacción;
- elimina escritura directa RLS/grants sobre `incidents`;
- agrega `admin_list_incidents` con `ORDER BY created_at DESC, id DESC`;
- agrega `incidents_status_created_cursor_idx(status, created_at DESC, id DESC)`.

Los pgTAP focales nuevos alcanzan esas rutas y pasan hasta que la suite llega a `structure.sql`.

### H03 — deriva del courier en fake vs SQL

SQL:

```text
delivery_requests.accepted_offer_id
→ offers.id
→ offers.status = accepted
→ offers.courier_id
```

Fake:

```ts
actor.role === 'courier' &&
req.assignedCourierId === actor.userId
```

El helper unitario `reporter()` no siembra `acceptedOfferId` ni `initialOffers` y aun así el courier reporta exitosamente. Esa unidad no representa un estado válido de la RPC real.

### H04 — consentimiento

SQL CC-012:

```text
consent_status <> active → UNAUTHORIZED_ACTOR
```

Fake:

```ts
if (rpcName === 'get_trip_details' &&
    (actor.consentStatus ?? 'active') !== 'active') ...
```

No hay control equivalente para `report_incident`.

### H05 — microsegundos

El SQL serializa cursor con:

```text
YYYY-MM-DD"T"HH24:MI:SS.US"Z"
```

y compara `timestamptz` nativo.

El fake hace `Date.parse(createdAt)`. JavaScript `Date` conserva milisegundos, no los seis decimales del cursor SQL. Dos valores como:

```text
2026-09-27T12:00:00.123456Z
2026-09-27T12:00:00.123789Z
```

colapsan al mismo milisegundo; el fixture actual usa solo timestamps exactamente iguales a `.123Z`.

### Mutation battery

El propio `docs/contracts/CC-012.md` del SHA revisado dice:

```text
Pendiente de completar con el SHA del PR, las corridas de CI y las mutaciones M1–M5
```

Por tanto M1–M5 no se consideran ejecutadas ni verificadas.

### Limitación del reviewer

El intento de preparar un checkout local independiente falló por DNS del entorno:

```text
Could not resolve host: github.com
```

No se inventa ejecución local. La revisión se apoya en CI remoto del SHA exacto e inspección del contenido publicado.

### Metadata de T-124

Al revisar #27 se encontró `P1 · fase-1 · en-curso` pese a que CC-012 la declara bloqueada. La revisión corrigió únicamente esa metadata a:

```text
P1 · fase-1 · bloqueada
```

No se cambió código de producto.
