# Comandos reproducibles — PR #138

## H01 · Contratos raíz contradictorios

```bash
grep -n "Supabase remoto\|credenciales" AGENTS.md docs/onboarding.md .agents/rules/00-confianza-y-seguridad.md
```

En `f280bc9`, AGENTS prohíbe Supabase remoto de forma general y onboarding conserva “Credenciales de staging o producción”.

## H02 · Ficha sin fila del plan

```bash
grep -n "^| T-317 |" docs/implementation-plan.md
grep -n "if (!esperado) continue" tools/verify-fichas.test.ts
pnpm exec vitest run tools/verify-fichas.test.ts
```

En `f280bc9`, el primer grep no devuelve fila T-317 y el test igualmente pasa, demostrando el hueco P08.

### RED/GREEN esperado para el arreglo

1. Agregar el test “toda ficha no exceptuada tiene fila” sin tocar el plan → RED por T-317.
2. Agregar la fila T-317 → GREEN.

## H03 · Referencia muerta

Comprobar en Issue #137 que `verifyMfaAction` se reemplazó por `verifyAdminMfaAction`.

## CI observado

Workflow `CI` run #629 sobre `f280bc918d3203cc29a2381c68da82611154112f`: `success`.
