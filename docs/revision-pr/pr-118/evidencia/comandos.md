# Evidencia y comandos — PR #118

## Ronda 5 — SHA `f53d8856b99c359d14982a7ceee5ff905115c04a`

### Sync
`develop...HEAD`: 0 behind / 13 ahead.

### Delta desde R4
Un commit; único archivo del autor: `docs/tasks/log/T-206.md`.

### CI exacto
Run `36466803301` — completed/success.

Unit:
```text
Test Files 93 passed (93)
Tests      1280 passed (1280)
# tests 22
# tests 6
```

DB:
```text
All tests successful.
Files=12, Tests=1601
Result: PASS
```

typecheck, lint, build, audit y bundle-budget: success.

### Evidencia del autor inspeccionada
Merchant null: RED observable por push indebido.

Offers null: retirar solo la guarda deja GREEN. La bitácora lo declara explícitamente y explica el catch best-effort. No se acepta ese GREEN como demostración RED, pero tampoco se acusa evidencia inventada.

### Batería de revisión propuesta para el residual
Control: test `cancel_request NO despacha push si offers devuelve data: null sin error` GREEN.

Mutación semántica compuesta, temporal y solo en producción:
1. retirar `offersRes.data == null` de la guarda;
2. cambiar temporalmente el catch interno del branch `cancel_request` para relanzar el error.

Objetivo: romper la propiedad pública `result.ok === true` ante anomalía post-commit. El fallo válido debe ser una aserción semántica del resultado, no un fallo de setup/mock. Revertir ambas mutaciones y confirmar GREEN.

No tocar test, mocks ni expectativas.
