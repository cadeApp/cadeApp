# PR #115 · CC-012 — Ronda 1

- **SHA:** `c4b8734e55b46bbdc0cf35d905ee7191dd7c0b03`
- **Base:** `5772cb3b1eef7a91a5d0a5a61d2d8cbb0fa5ae28`
- **Estado:** Draft
- **Resultado:** **CON BLOQUEANTES (5)**
- **Decisiones pendientes:** 0

## Preflight

- Rama 1 commit adelante y 0 detrás de `develop`.
- Sin reviewer docs preexistentes del autor.
- 15 archivos cambiados, todos coherentes con el contract-change.
- No se tocaron workflows, dependencias ni `src/features/**`.

## Checks del SHA exacto

CI `36310359422`:

```text
typecheck       PASS
lint            PASS
unit            PASS
build           PASS
audit           PASS
bundle-budget   PASS
db-tests        FAIL
```

Los pgTAP nuevos de `rls_matrix.sql`, `rpc_admin.sql` y `rpc_requests.sql` pasan. La suite aborta después en `structure.sql`.

---

## PR115-H01 — BLOQUEANTE

### Fixture histórico incompatible con `INCIDENT_KINDS`

`supabase/tests/structure.sql` todavía inserta:

```sql
incident_a, req_a, merchant_id, 'delay', 'initial report', old_ts
```

pero CC-012 agrega:

```sql
check (kind in ('no_show', 'payment_issue', 'damaged_goods', 'safety', 'other'))
```

Resultado real en CI:

```text
ERROR: new row for relation "incidents" violates check constraint "incidents_kind_valid"
DETAIL: ... kind = delay ...
Files=12, Tests=1593
Result: FAIL
```

### Arreglo

Actualizar **solo el fixture** a un kind canónico, por ejemplo `other`. No quitar/debilitar `incidents_kind_valid`.

Después ejecutar DB completo y confirmar que se alcanza también `db:types --local` + diff limpio de `database.types.ts`.

---

## PR115-H02 — BLOQUEANTE

### Falta la evidence RED→GREEN de M1–M5

`docs/contracts/CC-012.md` termina la sección evidencia con:

> Pendiente de completar con el SHA del PR, las corridas de CI y las mutaciones M1–M5.

Eso contradice el DoD del CC y la Regla 40.

Deben ejecutarse y documentarse:

- **M1:** permitir admin en `report_incident` → falla el control admin/UNAUTHORIZED_ACTOR.
- **M2:** reabrir INSERT directo RLS → falla pgTAP de escritura directa.
- **M3:** usar courier incorrecto/no derivado de accepted offer → falla control de suspensión.
- **M4:** quitar `available=false` o el retiro de pending offers → falla control de efectos completos.
- **M5:** quitar desempate por `id`/precisión de keyset → falla paginación.

Una caída por syntax error, TypeScript, import, mock o setup **no cuenta**. Restaurar cada mutación exactamente y demostrar GREEN final.

Si el entorno local no tiene Supabase/Docker, es válido usar commits temporales de mutación en la rama/CI y luego restaurarlos, siempre que la evidencia identifique SHA, test que falló y aserción objetivo.

---

## PR115-H03 — BLOQUEANTE

### El fake acepta un courier sin oferta `accepted`

La RPC SQL exige que el courier sea el de:

```text
delivery_requests.accepted_offer_id
→ offers.id
→ offers.status = accepted
→ offers.courier_id
```

El fake solo comprueba:

```ts
req.assignedCourierId === actor.userId
```

Además `reporter()` en `cc012-incidents.test.ts` no siembra `acceptedOfferId` ni una `initialOffer` accepted, pero espera reportes exitosos del courier.

### Arreglo

Alinear el fake con Postgres:

1. obtener `req.acceptedOfferId`;
2. buscar esa oferta;
3. exigir `offer.requestId === req.requestId`;
4. exigir `offer.status === 'accepted'`;
5. exigir `offer.courierId === actor.userId`;
6. recién después evaluar elegibilidad.

Actualizar el helper para sembrar una oferta accepted real.

Agregar control negativo donde `assignedCourierId` coincida pero falte/sea inválida la oferta accepted; debe devolver el mismo error que SQL.

---

## PR115-H04 — BLOQUEANTE

### `report_incident` pierde el gate de consentimiento en el fake

La SQL nueva preserva CC-007:

```sql
if v_consent_status <> 'active' then
  raise ... 'UNAUTHORIZED_ACTOR';
end if;
```

En el fake, `consentStatus` solo se consulta para `get_trip_details`.

Una futura regresión que quite el gate de SQL no tiene control unitario/fake equivalente focalizado en la nueva RPC.

### Arreglo

Incluir `report_incident` en el gate operacional del fake y agregar controles para:

- merchant `pending` → `UNAUTHORIZED_ACTOR`;
- merchant `reconsent_required` → `UNAUTHORIZED_ACTOR`;
- courier `pending` → `UNAUTHORIZED_ACTOR`;
- courier `reconsent_required` → `UNAUTHORIZED_ACTOR`;
- actor activo conserva happy path.

Agregar además al pgTAP de CC-012 al menos una cobertura focal merchant/courier no-activo contra la **nueva** definición standalone de `report_incident`, para que CC-007 no dependa de la función vieja que CC-012 reemplazó.

---

## PR115-H05 — BLOQUEANTE

### El fake de keyset trunca microsegundos

SQL preserva microsegundos en el cursor y compara `timestamptz`:

```text
created_at DESC, id DESC
YYYY-MM-DD...SS.USZ
```

El fake ordena y filtra usando `Date.parse`, que reduce timestamps a milisegundos.

Por ejemplo `.123456Z` y `.123789Z` se vuelven el mismo milisegundo en JavaScript. El test actual solo usa empates exactamente iguales a `.123Z`, así que no detecta el drift.

### Arreglo

No comparar el keyset con `Date.parse`.

Usar una representación que preserve los seis dígitos, por ejemplo epoch-microseconds/BigInt derivado de ISO validado o un comparador ISO UTC canónico que mantenga fracción completa.

Agregar prueba con:

```text
2026-09-27T12:00:00.123789Z
2026-09-27T12:00:00.123456Z
```

más IDs distintos y `limit=1`, verificando orden, páginas completas, sin duplicados/pérdidas y cursor exacto.

La mutación M5 debe demostrar que volver a precisión de milisegundos o quitar el desempate rompe esa prueba.

---

## Aspectos verificados sin hallazgo

Por inspección + CI focal:

- matriz D05-A en SQL;
- admin no reporta;
- contacto/kind validados también en Postgres;
- direct writes de incidents revocados;
- AAL2 en resolución/listado;
- preventive suspension deriva courier server-side;
- suspensión, offers, resolución y auditoría son transaccionales;
- keyset SQL usa `created_at + id`;
- existe índice de soporte;
- frontera server no acepta `courierId`;
- no se agregaron dependencias/workflows.

## Estado

**No mergear todavía.** Corregir H01–H05, completar M1–M5 y volver a revisión sobre un SHA publicado con CI completo verde.
