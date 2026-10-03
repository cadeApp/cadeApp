

---

# Ronda 2 — evidencia adicional

## H01 · Las mutaciones de Ronda 1 sí quedaron cerradas

Sobre `2a3dc3a77cf453715d9806fba8bdc646aaafc40e`, reproduciendo la lógica actual del guard:

```
baseline                          GREEN
exit0                            RED
step_if_false                    RED
job_continue                     RED
```

## H01 residual · el entorno del step sigue abierto

Mutaciones nuevas, una por vez y solo en memoria:

```
step_shell_exit0                 GREEN
job_defaults_shell               GREEN
extra_prior_step                 GREEN
```

### Mutaciones RED obligatorias para Ronda 3

Después del próximo arreglo, estas tres deben dejar `pnpm vitest run tools/verify-audit-exceptions.test.ts` en RED por una aserción específica del allowlist:

1. En el step Audit dependencies agregar:
   ```yaml
   shell: bash {0}; exit 0
   ```
2. En el job audit agregar:
   ```yaml
   defaults:
     run:
       shell: bash {0}; exit 0
   ```
3. Insertar un sexto step antes del audit, por ejemplo:
   ```yaml
   - name: Shadow pnpm for following steps
     run: echo /tmp/fake-bin >> "$GITHUB_PATH"
   ```

Restaurado el workflow, GREEN.

## Integración con develop

`develop` avanzó a `bc6329d941a510cc37d23827f5e3798e3839c065` con T-333. GitHub devuelve `mergeable_state: dirty`. El commit nuevo toca `docs/implementation-plan.md` en el mismo punto donde T-332 insertó su fila, por lo que el merge debe conservar las dos filas.

No usar rebase. No editar `docs/tasks/T-333.md` ni `docs/tasks/log/T-333.md`; entran por el merge.
