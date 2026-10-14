# Ronda 5 — PR #179 / T-304

**Fecha:** 2026-10-03  
**SHA funcional revisado:** `7222846be529306f45eb53997605bd43ae48075a`  
**Resultado:** **SIN BLOQUEANTES**

## Preflight

- PR abierta, no Draft.
- `behind=0`, `ahead=25`.
- Diff contra develop: solo scope T-304 autorizado + carpeta del revisor.
- El autor no tocó `docs/revision-pr/pr-179/**` después de R4.
- No hay decisiones P1 pendientes.
- No quedan helpers `mutateForProof*` en HEAD.
- No hay `.skip`, `.only`, `.fixme` ni sleeps en el spec/harness T-304.

## R4 — verificación de arreglos

### H03 — CERRADO

La batería M1-M4 fue especificada por la revisión en R4 y ejecutada por el autor sin tocar expectativas.

Commit temporal:
`a8080a676aa2dc39919f5de527ff6bbef1cff1f8`

Inspección del diff:
- M1: offer hermana vuelve a `pending` después de `accept_offer`.
- M2: `expires_at` de la request test-owned pasa a +1000 min.
- M3: request test-owned `delivered` se altera a `in_transit` antes del intento admin.
- M4: se inserta incidente test-owned en Req A antes del caso 0-incidentes.
- Las cuatro funciones fallan cerrado si `requestId` no pertenece a `context.createdRequestIds`.
- Ningún `expect(...)` fue modificado.

Run RED `37095557481` / job `111124661597`:
- checkout exacto: `a8080a6`;
- 4 failed, 16 passed;
- Fila 1: Expected 30 / Received 1000;
- Fila 2: Expected rejected / Received pending;
- Fila 9: RPC devuelve éxito donde se esperaba `INVALID_STATE_TRANSITION`;
- delivered invariant: RPC devuelve éxito donde se esperaba `INVALID_STATE_TRANSITION`.

Revert:
`07b1386c26c2218a06eb68d3614853690f77774b`.

Run GREEN post-revert `37096118756`: 20/20 T-304 + 3/3 main-flow.

Run GREEN del HEAD actual `37096855417`: 20/20 T-304 + 3/3 main-flow.

### H16 — CERRADO

`getRequestInspectionData` ahora:
- inspecciona `error` de `incidents`;
- propaga excepciones como `[E2E Inspection Error]`;
- hace lo mismo para `request_cancellation_reasons`;
- solo convierte a `[]` cuando la consulta respondió sin error.

Tests exactos presentes:
- `data: [], error: null` => `[]`;
- PostgREST error de incidents => reject;
- throw de incidents => reject;
- PostgREST error de cancellation reasons => reject;
- throw de cancellation reasons => reject.

Unit exact-head: 114 archivos / 1712 tests GREEN.

### H17 — CERRADO

La línea histórica de Ronda 2 volvió a su texto original (“se documentó explícitamente el gap contractual…”). La corrección sobre T-206 vive en la nueva entrada de Ronda 4 al final del log. Se preserva append-only.

### H18 — CERRADO

El test de discovery ya exige:

```ts
expect(incidentsDeleteIn).toHaveBeenCalledWith('id', [incId]);
```

con `createdIncidentIds` inicialmente vacío.

El bootstrap admin tiene negativo explícito:
- createUser success;
- merchants.delete error;
- helper rechaza;
- user ID sigue trackeado;
- profiles.update no se ejecuta;
- updateUserById no se ejecuta.

Unit exact-head GREEN.

## H11/H12/H13/H15 — cierre runtime

El run exact-head `37096855417` atraviesa las nueve filas y la invariante:
- Fila 1 GREEN => TTL/oráculo real operativo;
- Fila 8 GREEN => ventana 24h + no escritura + cleanup;
- Fila 9 GREEN => admin bootstrap + AAL1/AAL2 + CC-015;
- delivered invariant GREEN => rechazo real para actores relevantes;
- no hay `E2E Cleanup Error`.

## CI exact-head

Run CI `37096772088`:
- lint GREEN;
- typecheck GREEN;
- unit GREEN — 114 files / 1712 tests;
- build GREEN;
- db-tests GREEN — 15 files / 1671 tests, `Result: PASS`;
- bundle-budget GREEN;
- audit RED: `braces <=3.0.3`, 2 moderate + 1 high.

El audit no pertenece a T-304:
- `package.json` blob HEAD = develop = `3585b3a09838bccfc09e7c1fe7b7a0b851d2f4eb`;
- `pnpm-lock.yaml` blob HEAD = develop = `01a4d0052f6ee03c084ab80b28fa80a5de51c646`;
- la PR no modifica dependencias.

Se registra como estado externo/preexistente y no como bloqueante de T-304.

## Limitación de entorno de revisión

Se intentó clonar el SHA para ejecutar una segunda batería local independiente y el entorno respondió:

```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
Could not resolve host: github.com
```

No se inventa ejecución local. La batería M1-M4 utilizada fue definida por la revisión en R4; en R5 se verificó independientemente su diff y se reprodujo su salida desde los logs de GitHub del SHA exacto.

## Resultado

**SIN BLOQUEANTES.**

La PR queda técnicamente lista desde el punto de vista de T-304. No se aprueba ni mergea en esta ronda porque P1 no lo pidió explícitamente.
