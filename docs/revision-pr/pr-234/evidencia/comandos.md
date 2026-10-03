# Comandos reproducibles — PR #234

Las mutaciones de la revisión se aplican sobre copias en memoria o temporalmente y se restauran. `.github/workflows/ci.yml` no queda modificado en la rama.

## Ronda 1

```
baseline                           GREEN
exit 0 antes del audit            GREEN
if: false en el step              GREEN
continue-on-error en el job       GREEN
```

## Ronda 2

```
baseline                           GREEN
exit0                              RED
step_if_false                      RED
job_continue                       RED
step_shell_exit0                   GREEN
job_defaults_shell                 GREEN
extra_prior_step                   GREEN
```

## Ronda 3

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

## Ronda 4

Sobre `3b93acf2433c8ae0dd44ae854add2f395c99cf0e`:

```
baseline                          GREEN
workflow_defaults_shell           RED
r2_step_shell                     RED
r2_job_defaults                   RED
r2_extra_step                     RED
r1_exit0                          RED
r1_step_if                        RED
r1_job_continue                   RED
pr_develop_removed                GREEN
pr_paths_ignore_all               GREEN
pr_event_removed                  GREEN
```

`verify-workflows.test.mjs` solo exige que exista el texto `pull_request:`; por eso cubre `pr_event_removed`, pero no `pr_develop_removed` ni `pr_paths_ignore_all`.

### Mutaciones obligatorias para el próximo arreglo

Una por vez:

1. `branches: [develop, staging, main]` → `branches: [staging, main]` bajo `pull_request`;
2. agregar `paths-ignore: ['**']` bajo `pull_request`;
3. quitar por completo el bloque `pull_request`.

Esperado: las tres RED por la igualdad del bloque `on:`.

Después volver a reproducir las siete mutaciones anteriores. Restaurado: `5 passed (5)`.
