# Informe de revisión — PR #234 / T-332 — Ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/234  
**Head SHA revisado:** `7b088c87fb97b93e5f90565268f35e858438f963`  
**Base:** `develop` @ `bc6329d941a510cc37d23827f5e3798e3839c065`  
**Fecha:** 2026-10-03  
**Resultado:** **CON BLOQUEANTES (1)** — H01 residual

## Sincronización e integración

- La rama incorporó la Ronda 2 y mergeó `origin/develop` sin rebase.
- `docs/implementation-plan.md` conserva las filas T-332 y T-333.
- Los archivos de T-333 entraron desde develop; agy no los editó manualmente.
- Desde `ed1cadde` no hubo cambios del autor en `docs/revision-pr/pr-234/**`.
- GitHub vuelve a reportar la PR como mergeable.

## PR234-H02 — CERRADO

Sin regresiones. La regla 00 sigue alineada con D01 y el alcance de T-332 continúa limitado al archivo exacto aprobado.

## PR234-H01 — PARCIAL OTRA VEZ

La corrección de R2 está bien implementada para lo que se pidió:

- claves exactas del job `audit`;
- exactamente 5 steps;
- setup steps línea por línea;
- claves exactas del step Audit dependencies;
- branch bloqueante con un único `pnpm audit --audit-level=high`.

Reproducción independiente de las seis mutaciones pedidas:

```
baseline                          GREEN
shell en Audit dependencies       RED
defaults.run.shell en job         RED
step extra antes del audit        RED
exit 0 dentro del run             RED
if: false en el step              RED
continue-on-error en el job       RED
```

### Residual nuevo de la revisión

**Archivo:** `tools/verify-audit-exceptions.test.ts:~130`  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

El guard solo extrae el job `audit`. GitHub Actions permite `defaults.run.shell` **a nivel workflow**, heredado por todos los `run` de los jobs. Ese contexto global queda fuera de la allowlist actual.

Mutación propia:

```yaml
permissions:
  contents: read

defaults:
  run:
    shell: bash {0}; exit 0

concurrency:
  ...
```

Con esa mutación el guard actual queda **GREEN**, aunque el shell fuerza exit 0 después de cada script `run`, incluido `pnpm audit`.

Resultado del harness:

```
baseline                 GREEN
workflow_defaults_shell  GREEN  ← debía ser RED
```

La corrección anterior no estaba mal; el agujero sale de una capa que esta revisión no había enumerado en R2.

## Arreglo requerido

Extender la allowlist al nivel superior del workflow.

Agregar un helper que extraiga las claves de indentación 0, ignorando comentarios y líneas vacías, y exigir exactamente la estructura superior revisada:

```
name: CI
on:
permissions:
concurrency:
jobs:
```

La comparación debe ser positiva por igualdad, no otra blacklist. Así cualquier `defaults:`, `env:` u otra clave global nueva obliga a revisar explícitamente su efecto sobre el gate.

Conservar intacta la allowlist del job y de sus cinco steps.

## T-333 — bloqueo externo, no hallazgo de T-332

`verify-fichas` falla porque T-333 entró a develop con el primer ítem del DoD distinto a la celda DoD de su fila del plan. El propio test exige igualdad literal.

No se atribuye a T-332 y **no debe arreglarse desde esta rama**. Quedó registrado en issue #229 (comentario de revisión).

Mientras develop conserve esa desincronización, el CI completo de cualquier PR que la herede puede quedar rojo aunque T-332 esté correcta.

## CI

No se auditan logs para cierre en esta ronda porque H01 sigue abierto. Esta es una ronda estática + mutaciones independientes.

## Corrección de la propia revisión

En R2, al actualizar `evidencia/comandos.md`, la revisión sobrescribió por error el bloque de R1 en vez de preservarlo. R3 restaura en ese archivo la secuencia completa R1 + R2 + R3. Es un error de la revisión, no del autor.

## Checklist

- [x] HEAD remoto verificado.
- [x] Merge de develop limpio y PR mergeable.
- [x] Autor no tocó la carpeta de revisión.
- [x] Seis mutaciones de R1/R2 reproducidas y RED.
- [x] Mutación nueva de R3 reproducida y GREEN.
- [x] H02 sigue cerrado.
- [ ] H01 cubre contexto global del workflow.
- [ ] T-333 deja de romper verify-fichas en develop.
- [ ] CI final auditado.
