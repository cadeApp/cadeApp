# Evidencia — PR #113 / T-124

## Ronda 1 — SHA `3ef389de515f01b03a7aff88982b0b32b5f91c4d`

### Preflight

- base: `develop@47d65c41dc22e1f6b5bebbfb5473c3e89b2d820a`
- rama: 0 commits detrás de develop al iniciar la revisión;
- PR mergeable, Draft;
- no existía `docs/revision-pr/pr-113/**` escrito por el autor.

### CI run 36306937968

```text
typecheck       PASS
lint            PASS
build           PASS
audit           PASS
db-tests        PASS
bundle-budget   PASS
unit            FAIL esperado — fase RED

Test Files      7 failed | 73 passed (80)
Tests           94 failed | 897 passed (991)

db-tests:
Files=12, Tests=1529
Result: PASS
```

Los fallos unitarios inspeccionados son de T-124: stubs `T-124: sin implementar`, componentes `null`, rutas ausentes y controles D03. No se observó regresión de suites ajenas.

### Contrato report_incident

Inspección de develop:

```text
supabase/migrations/20260924010124_rpc_requests_v1.sql
- request_cycle no restringe report_incident a merchant/courier en el chequeo inicial.
- rpc_requests.sql considera válidos:
  merchant actor 1 en published/matched/in_transit/delivered
  admin actor 5 en published/matched/in_transit/delivered
  courier actor 3 en matched/in_transit/delivered
```

D05-A cambia la matriz a:
- merchant dueño: matched / in_transit / delivered <= 24 h;
- courier asignado: matched / in_transit;
- admin: nunca.

### Bypass RLS

```text
supabase/migrations/20260922051650_rls_v1.sql
- policy incidents insert para participantes
- policy incidents_write_admin FOR ALL para admin

supabase/tests/rls_matrix.sql
- “assigned courier can create incident on its matched request”
- “merchant can report an open incident”
```

Esto contradice la regla del master plan “operaciones críticas: solo por RPC”. D07-A lo corrige vía contract-change.

### Paginación

La fase RED exige actualmente:
- `order(created_at desc)`;
- `lt(created_at, cursor)`;
- `nextCursor = createdAt`.

No existe desempate por `id`. D07-A exige:
- orden `created_at DESC, id DESC`;
- cursor compuesto `{createdAt,id}`;
- índice `incidents(status, created_at DESC, id DESC)`;
- caso de prueba con dos incidentes empatados en `created_at`.

### Mutaciones que quedan obligatorias antes de GREEN

No se declaran ejecutadas por esta revisión; son requisitos de la corrección:

1. permitir admin en `report_incident` → pgTAP debe quedar rojo;
2. reintroducir INSERT directo a `incidents` para merchant/courier → RLS pgTAP rojo;
3. hacer que preventive_suspension use un `courierId` recibido del cliente → test contractual rojo;
4. reemplazar un schema Zod por aceptación manual/cast → test de frontera rojo;
5. hardcodear `tripStatus` o quitar `actorRole` en el wiring → test de consumidor rojo;
6. volver a cursor timestamp-only con dos filas empatadas → test de paginación rojo;
7. quitar `adminResolveIncidentRpc` del happy path → action test rojo;
8. hacer blur del trigger antes de abrir el Dialog → test de retorno de foco rojo.

Prohibido contar como mutación válida una caída por TypeError de mock o por romper compilación antes de la aserción objetivo.
