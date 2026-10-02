# Evidencia — PR #179 / T-304 / Ronda 1

## Preflight

```text
head funcional: 4718ce7fcd2714009776b3da2321e553d8ee2c86
base develop:   1457072a7cac1ae9e2a8a92abe9253d45b745082
ahead: 4
behind: 0
merge-base: 1457072a7cac1ae9e2a8a92abe9253d45b745082
comments/reviews previos: 0
diff funcional:
- docs/tasks/T-304.md
- docs/tasks/log/T-304.md
- e2e/specs/request-states.spec.ts
```

## Dependencias observadas en el spec

```text
request-states.spec.ts
  importa @playwright/test
  importa @/domain/states
  importa @/domain/rpc-contracts

No importa ../fixtures.
No usa stagingContext.
No invoca RPC real.
No observa PostgreSQL después de la transición.
```

## Sondas estáticas

```text
L49, L106, L150, ...: transitionRequest(...)
L121-L122: transitionOffer(...) para simular aceptación/rechazo
L187-L222: expiración calculada en memoria
L484: admin in_transit -> cancelled con transitionRequest(...)
L564-L570: delivered no transiciona usando canTransitionRequest(...)
```

## Evidencia RED del autor

```text
docs/tasks/log/T-304.md L7/L12:
- afirma fase RED
- solo registra "expect(received).toBe(expected)"
- no registra mutación, archivo, regla, test ni salida concreta

blob del spec en el primer commit funcional: e6905a834759a24e04c0dd5072e1dcd522725f78
blob del spec en HEAD revisado:              e6905a834759a24e04c0dd5072e1dcd522725f78
```

No se afirma que la mutación temporal no haya ocurrido; no es reproducible con la evidencia registrada.

## Mutaciones que la corrección debe demostrar

### M01 — romper RPC real y exigir que el E2E caiga

Ejemplo conceptual sobre un worktree temporal de la implementación correcta:

```text
Mutar cancel_request para permitir delivered -> cancelled
=> debe caer el caso DoD delivered -> cancelled.

Mutar accept_offer para no rechazar las otras pending
=> debe caer la verificación persistida de una accepted y resto rejected.

Mutar publish_request para no renovar/calcular expires_at
=> debe caer la fila draft -> published.
```

El spec actual no depende de esas implementaciones productivas, por lo que no puede acreditar esos controles.

### M02 — regla P1 2-A: incidente obligatorio

Fuente:

```text
docs/master-plan.md:103
in_transit -> cancelled | admin | Solo por incidente.
```

Implementación observada:

```text
request_cycle permite admin + in_transit
exige AAL2
exige reason
no consulta public.incidents antes de cancel_request
```

Tras CC-015, demostrar:

```text
admin AAL2 + motivo + in_transit + 0 incidentes
=> RED/rechazo esperado

crear incidente real para el mismo request
admin AAL2 + motivo
=> cancelled y estado persistido
```

## Runtime de esta revisión

No se ejecutó Supabase/Docker local y no se disparó CI porque la ronda ya tiene bloqueantes. La detección H01/H02/H05 se apoya en el grafo de dependencias, código productivo y contratos leídos. Las mutaciones runtime quedan como requisito explícito para la corrección y deberán quedar registradas en la bitácora.

## Scope autorizado por D01

La ampliación puede incluir únicamente lo necesario para el arnés de T-304, por ejemplo:

- `e2e/specs/request-states.spec.ts`
- `e2e/fixtures/roles.ts`
- `e2e/fixtures/staging-seed.ts`
- `src/server/e2e/staging-seed.ts`
- `src/server/e2e/staging-seed.test.ts`
- `docs/tasks/T-304.md`
- `docs/tasks/log/T-304.md`

Si aparece necesidad de tocar otro archivo productivo/contrato/workflow, detenerse y pedir/crear el cambio de alcance correspondiente. En particular, la corrección de `cancel_request` **no va dentro de T-304**: corresponde al contract-change separado.
