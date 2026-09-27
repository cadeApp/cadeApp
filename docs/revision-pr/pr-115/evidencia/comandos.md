# Evidencia — PR #115 / CC-012

## Ronda 1

SHA funcional: `c4b8734e55b46bbdc0cf35d905ee7191dd7c0b03`.

La R1 detectó 5 bloqueantes y un `db-tests` rojo por `structure.sql`.

## Ronda 2 — SHA `391697a482c542a7306700599bad8b67909a4468`

### Diff de corrección

Desde el commit reviewer R1 `1cc52c0` hasta el SHA funcional R2:
- 12 commits adelante;
- 0 detrás;
- archivos funcionales/documentales del CC modificados: 7;
- **ningún archivo de `docs/revision-pr/pr-115/**` fue tocado por el autor**.

### CI final — run 36350483451

```text
lint            PASS
typecheck       PASS
unit            PASS
build           PASS
db-tests        PASS
audit           PASS
bundle-budget   PASS
```

Unit:

```text
src/domain/cc012-incidents.test.ts  (37 tests) PASS
Test Files 83 passed
Tests      1033 passed
```

DB:

```text
rls_matrix.sql   ok
rpc_admin.sql    ok
rpc_requests.sql ok
structure.sql    ok

Files=12, Tests=1601
Result: PASS

pnpm db:types --local
Tipos generados exitosamente en src/types/database.types.ts
git diff --exit-code -- src/types/database.types.ts
→ sin drift
```

### Mutaciones verificadas en CI

#### M1 — admin en report_incident
Run `36348386744` / db-tests:
```text
Failed test 1199: admin ... -> UNAUTHORIZED_ACTOR
have: NULL
want: UNAUTHORIZED_ACTOR
Failed test 1208: solo persisten los tres reportes válidos
have: 4
want: 3
Result: FAIL
```

#### M2 — INSERT directo RLS
Run `36348780179`:
```text
Failed tests 28, 54, 56
assigned courier / related merchant / admin cannot insert
caught: no exception
wanted: 42501
Result: FAIL
```

#### M3 — courier incorrecto
Run `36349156881`:
```text
Failed tests 88-92, 94
resultado devuelve courier c6 en vez de c5
courier no accepted termina suspended
su oferta pending termina withdrawn
Result: FAIL
```

#### M4 — available no se apaga
Run `36349577554`:
```text
Failed test 89
have: (suspended,t,t)
want: (suspended,f,t)
Result: FAIL
```

#### M5 — keyset sin id
Run `36349970611`:
```text
Failed tests 106-108
página 2 salta el otro incidente empatado
páginas siguientes/cursor quedan incorrectos
Result: FAIL
```

Cada mutación fue restaurada por commit posterior; el SHA final integra las restauraciones y CI completo verde.

### H03 — fake vs SQL

El fake R2 exige:
```text
acceptedOfferId existente
offer.requestId == req.requestId
offer.status == accepted
offer.courierId == actor.userId
```

Los cuatro negativos focales quedan verdes en CI.

### H04 — consentimiento

El fake aplica el gate a `get_trip_details || report_incident`. El pgTAP standalone cubre merchant/courier `pending` y `reconsent_required`, prueba que no persiste reporte y luego recupera el happy path al volver a `active`.

### H05 — microsegundos

`isoTimestampToEpochMicros` compara con `BigInt` y preserva hasta 6 dígitos de fracción. El test focal distingue:
```text
2026-09-27T12:00:00.123789Z
2026-09-27T12:00:00.123456Z
```
con `limit=1`, cursor exacto y sin pérdidas/duplicados.

La mutación local del fake a `Date.parse` está documentada por el autor; no se usa como única evidencia de cierre. La propiedad de keyset también tiene M5 SQL reproducida en CI remoto.

### Resultado

0 bloqueantes.
