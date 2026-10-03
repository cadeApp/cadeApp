# Comandos reproducibles — PR #234

Cada mutación de esta revisión se hizo sobre una copia en memoria del workflow; no se escribió `.github/workflows/ci.yml`.

## Ronda 1 — H01: presencia textual no prueba alcanzabilidad

Sobre `3fd36b865f5eeb8a957d7048aff9fb4d5911e78d`, el guard de R1 quedó:

```
baseline                           GREEN
exit 0 antes del audit            GREEN
if: false en el step              GREEN
continue-on-error en el job       GREEN
```

Las tres últimas debían ser RED.

## Ronda 2 — H01: el entorno del job/step seguía abierto

Sobre `2a3dc3a77cf453715d9806fba8bdc646aaafc40e`:

```
baseline                           GREEN
exit0                              RED
step_if_false                      RED
job_continue                       RED
step_shell_exit0                   GREEN
job_defaults_shell                 GREEN
extra_prior_step                   GREEN
```

Las tres últimas debían ser RED.

## Ronda 3 — allowlist del job verificada y residual global

Sobre `7b088c87fb97b93e5f90565268f35e858438f963`, reproduciendo la lógica del test actual:

```
baseline                          GREEN
r2_step_shell                     RED
r2_job_defaults                   RED
r2_extra_step                     RED
r1_exit0                          RED
r1_step_if                        RED
r1_job_continue                   RED
workflow_defaults_shell           GREEN
```

La mutación nueva es:

```yaml
defaults:
  run:
    shell: bash {0}; exit 0
```

insertada como clave top-level del workflow. El job `audit` queda textualmente idéntico, por eso la allowlist actual no la ve.

### Mutación obligatoria para el próximo arreglo

Una por vez y restaurada:

1. agregar a nivel workflow:
   ```yaml
   defaults:
     run:
       shell: bash {0}; exit 0
   ```
2. ejecutar:
   ```bash
   pnpm vitest run tools/verify-audit-exceptions.test.ts
   ```
3. Esperado: RED por la allowlist de claves top-level.
4. Restaurado: GREEN `5 passed (5)`.

Después volver a correr las seis mutaciones anteriores para asegurar que siguen RED.

## T-333 / verify-fichas

El test `tools/verify-fichas.test.ts` construye la celda DoD del plan y exige que sea idéntica al primer ítem del DoD de cada ficha no exceptuada. T-333 incumple esa igualdad en develop `bc6329d941a510cc37d23827f5e3798e3839c065`.

Se registró en issue #229. No corregir desde T-332.
