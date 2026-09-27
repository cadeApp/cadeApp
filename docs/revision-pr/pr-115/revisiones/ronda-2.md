# PR #115 · CC-012 — Ronda 2

- **SHA funcional verificado:** `391697a482c542a7306700599bad8b67909a4468`
- **Resultado:** **SIN BLOQUEANTES**
- **Decisiones pendientes:** 0

## Revalidación de la Ronda 1

### PR115-H01 — CERRADO / VERIFICADO

`structure.sql` cambió únicamente el fixture histórico `delay → other`. No se debilitó el CHECK ni la enum.

CI final:
```text
structure.sql ok
Files=12, Tests=1601
Result: PASS
```

### PR115-H02 — CERRADO / VERIFICADO

Las mutaciones M1–M5 existen con commits/runs identificables.

Se inspeccionaron los logs RED:
- M1: admin permitido → falla UNAUTHORIZED_ACTOR y persiste una fila extra.
- M2: INSERT directo → RLS no lanza 42501.
- M3: courier no-accepted → se suspende el actor incorrecto y cambia su oferta.
- M4: sin `available=false` → queda `suspended,true`.
- M5 SQL: sin tie-breaker por `id` → pierde el segundo incidente empatado.

El HEAD final restaura todo y deja los 7 jobs verdes.

### PR115-H03 — CERRADO / VERIFICADO

El fake ya no confía en `assignedCourierId`.

Para courier exige:
```text
req.acceptedOfferId
→ offer existente
→ misma request
→ status accepted
→ courierId del actor
→ elegibilidad
```

Los fixtures felices siembran la oferta real. Cuatro casos negativos cubren ausencia/cancelled/otra request/otro courier.

### PR115-H04 — CERRADO / VERIFICADO

`report_incident` quedó dentro del gate CC-007 del fake antes de validación.

Cobertura:
- merchant pending;
- merchant reconsent_required;
- courier pending;
- courier reconsent_required;
- active happy path;
- precedencia consentimiento antes que relato inválido;
- pgTAP standalone equivalente en la RPC SQL.

### PR115-H05 — CERRADO / VERIFICADO

Se reemplazó `Date.parse` del keyset por conversión a epoch microseconds con `BigInt`.

El test focal cubre dos timestamps distintos dentro del mismo milisegundo y valida:
- orden;
- cursor exacto;
- página 1/2;
- sin pérdida;
- sin duplicados.

La suite focal `cc012-incidents.test.ts` pasa 37/37 en CI.

## Checks

CI run `36350483451`:
```text
typecheck       PASS
lint            PASS
unit            PASS — 83 archivos / 1033 tests
build           PASS
audit           PASS
db-tests        PASS — 12 archivos / 1601 tests
bundle-budget   PASS
db:types        PASS — sin drift
```

## Revisión de regresiones

Los cambios de R2 se limitan a:
- `docs/contracts/CC-012.md`;
- tests de dominio;
- fake de dominio;
- `rpc_requests.sql`;
- `structure.sql`.

No se tocaron migraciones finales del CC después de restaurar las mutaciones, wrappers server, contratos públicos adicionales, workflows ni dependencias.

No se observó debilitamiento de tests, fixtures o seguridad.

## Resultado final

**SIN BLOQUEANTES.**

CC-012 está listo para el merge autorizado a `develop`. Tras mergear, T-124 puede salir de `bloqueada`, sincronizar su rama con `develop` mediante merge normal y retomar su fase GREEN.
