# Comandos reproducibles — PR #234

## Ronda 5 — cierre H01

Sobre `05e746356da224990ef35af89c619d7a20956628`, reproduciendo la lógica exacta del guard de `tools/verify-audit-exceptions.test.ts`:

```
baseline                          GREEN
no_develop                       RED
paths_ignore                     RED
no_pr                            RED
global_defaults                  RED
step_shell                       RED
job_defaults                     RED
extra_step                       RED
exit0                            RED
step_if                          RED
job_continue                     RED
```

Las diez mutaciones cubren el trigger, el contexto global, el job, sus steps y el branch bloqueante.

## CI final inspeccionado

Run: `37144999309` / #1043.

### audit

Job `111267001324` → success.

Fragmento relevante:

```
pnpm audit --audit-level=high
3 vulnerabilities found
Severity: 2 moderate | 1 high (1 ignored)
```

### unit

Job `111267001266` → failure.

Resumen:

```
Test Files  1 failed | 114 passed (115)
Tests       1 failed | 1742 passed (1743)
```

Único fallo:

```
FAIL tools/verify-fichas.test.ts
Desincronizadas: T-333
```

## Causalidad del rojo externo

Comparando `bc6329d941a510cc37d23827f5e3798e3839c065...05e746356da224990ef35af89c619d7a20956628`, el diff de la PR no contiene archivos de T-333. El fallo de `unit` no puede atribuirse a un cambio de T-333 realizado por esta PR.

No corregir T-333 desde T-332.
