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

# Ronda 2

## Preflight

```text
HEAD T-304: 08426ca79bd81e97208a209eff9e81843e7fee66
develop:     169b60bb3771fb794184b5a2da5714107391ecd0
merge-base:  640bc4cd6f86a85f8a7fb235f123a182ac6c2163
ahead: 9
behind: 26
overlap desde merge-base:
- src/server/e2e/staging-seed.ts
- src/server/e2e/staging-seed.test.ts
```

## Runtime/gates observados

```text
CI exact-head: success
Vercel exact-head: success / Preview desplegado
commit status exact-head:
- Vercel = success
- e2e-preview = AUSENTE

e2e-preview.yml actual:
- smoke.spec.ts
- main-flow.spec.ts
- request-states.spec.ts = AUSENTE

e2e-staging.yml actual:
- smoke.spec.ts
- main-flow.spec.ts
- request-states.spec.ts = AUSENTE
```

Por regla E2E vigente, PR interna => Vercel Preview + Supabase Develop. El body de T-304 todavía habla de esperar staging.

## Sonda H06 — FK

```text
schema_v1.sql:
offers.request_id uuid not null references public.delivery_requests(id)

staging-seed.ts:
~1486 INSERT offers(request_id=requestId)
~1511 INSERT delivery_requests(id=requestId)
```

Conclusión determinística: el camino post-match intenta insertar la FK antes del padre.

## Sonda H08 — precedencia de cancel_request

```text
request-states.spec.ts ~247:
expected INVALID_STATE_TRANSITION

request_cycle vigente:
if cancel_request && status=published && expires_at<=now
  raise REQUEST_EXPIRED
```

## Evidencia RED declarada por autor

```text
Mutaciones 1-4:
comando = pnpm vitest run src/domain/domain.test.ts
archivos mutados = src/domain/states/index.ts / src/domain/testing/rpc-fake.ts
Playwright request-states = no ejecutado
```

Sirven como mutation tests unitarios complementarios, pero no cierran H03.

## Ronda 2 — mutation/runtime del revisor

No se alteró código funcional para “probar” los hallazgos: H06 y H08 se demuestran directamente por constraints/precedencia incompatibles. No se ejecutó un E2E privilegiado manual porque el único gate confiable de Develop todavía no incluye `request-states.spec.ts`. La corrección debe producir primero un RED real del Preview y luego GREEN.

## Infraestructura separada — PR #207

```text
PR: #207 [T-304] Integrar request-states en gates E2E
rama: fix/e2e-request-states-gate
SHA final: 5180fd43409b2b7c07f7a4b29eb61bbd1a3da749
behind develop al validar: 0
CI exact-head: SUCCESS
approval-policy: SUCCESS
diff: solo
- .github/workflows/e2e-preview.yml
- .github/workflows/e2e-staging.yml
- .github/workflows/verify-workflows.test.mjs
```

El gate usa inclusión condicional por existencia del archivo en el SHA exacto:

```bash
specs=(e2e/specs/smoke.spec.ts e2e/specs/main-flow.spec.ts)
if [ -f e2e/specs/request-states.spec.ts ]; then
  specs+=(e2e/specs/request-states.spec.ts)
fi
pnpm exec playwright test "${specs[@]}" --project=chromium --workers=1
```

Esto permite mergear primero la infraestructura sin romper otras PR y garantiza que #179 ejecute request-states cuando su SHA lo contenga.

Estado: **CI GREEN; pendiente merge explícito de P1**. El autor de T-304 no debe modificar workflows.
