# PR #427 — T-374: timeout del E2E de staging

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/427 |
| Tarea vigente | T-374 (#428, ficha mergeada en develop por #429) |
| Tarea histórica declarada en ronda 1 | T-315 (alcance incorrecto, ya regularizado) |
| Autor | @Lautaro073 |
| Rama | `fix/staging-e2e-timeout-45-20261019` → `develop` |
| SHA funcional revisado ronda 1 | `6f3cba766fb8ff4d0cf31ab4eb78da7c78681a46` |
| SHA revisado ronda 2 | `6fbd2de3542e991ed6eef4fb49c956e19d5464d1` |
| Estado ronda 2 | **SIN BLOQUEANTES técnicos (0)**; **NO MERGEAR** hasta CI E2E Preview verde y `approval-policy` verde |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `6f3cba76` | 1, de alcance | [ronda-1](revisiones/ronda-1.md) |
| 2 | `6fbd2de3` | PR427-H01 arreglado y verificado, ninguno nuevo | [ronda-2](revisiones/ronda-2.md) |

## Resultado técnico

- Ficha T-374 autorizada en `develop@1e69477d`.
- El único cambio de `e2e-staging.yml` es `timeout-minutes: 20 → 45`.
- `verify-workflows.test.mjs` exige 45 en el job real `e2e`, sin modificar cobertura o comando Chromium.
- El CI oficial `39305084513` del SHA revisado pasa las suites de código, DB, build y workflows.
- **Gate abierto:** E2E Preview `39305230026`. Su intento 1 terminó cancelado (85 passed, 4 flaky, 2 failed; 44.4m). Al cerrar esta revisión, el intento 2 seguía `in_progress` y su commit status `pending`; no equivale a verde.
- `approval-policy` rojo a la fecha de inspección por falta del informe en el cuerpo; no es defecto de implementación.

[Evidencia](evidencia/comandos.md) · [Hallazgos](hallazgos.jsonl) · [Lecciones](lecciones.md)

La autorización final de merge corresponde a Lautaro073. Esta revisión no aprueba, no mergea ni ejecuta despliegues.
