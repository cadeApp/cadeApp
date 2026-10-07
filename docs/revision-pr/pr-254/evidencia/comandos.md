# Comandos y evidencia reproducible — PR #254

## Ronda 4 — SHA `2033b931e192b822f4e0b26578d174465f099fbc`

### Sincronización

```text
develop @ 6e2da8fb02d4797b9add222206342e6055f1d81c
head    @ 2033b931e192b822f4e0b26578d174465f099fbc
ahead 11 / behind 0
merge-base = develop
```

### Diff propio de la corrección R4

Commit exact-head `2033b931...`:

```text
docs/tasks/log/T-302.md
e2e/specs/courier-onboarding.spec.ts
```

El resto de cambios desde R3 corresponde al merge de `develop`.

### Barrido de antipatrones en el spec

```text
.only: 0
.skip: 0
fixed-sleep: 0
any: 0
ts-ignore: 0
locator-index (.first/.nth): 0
optional-ui if(isVisible/isEnabled): 0
fallback page.goto(status)/admin RPC: 0
```

### CI principal

Run `37548946258`: success.

```text
lint          success
unit          success
db-tests      success
typecheck     success
audit         success
build         success
bundle-budget success (advisory)
```

Unit exact-head:

```text
Test Files 121 passed (121)
Tests      1921 passed (1921)
verify-workflows: 57/57
ADR: 6/6
```

DB:

```text
Files=19, Tests=1827
Result: PASS
```

### E2E Preview exact-head

Run `37549090092`, job `112560087591`.

Checkout:

```text
HEAD is now at 2033b93 fix(e2e): corregir locators ambiguos de DNI y vehiculo moto [T-302]
2033b931e192b822f4e0b26578d174465f099fbc
```

T-302:

```text
✓ DoD MFA
✓ DoD DNI duplicado
✓ Flujo 1 onboarding
✓ Flujo 2 DNI duplicado
✓ Flujo 3 admin MFA/UI
```

Suite completa:

```text
42 passed (chromium)
3 passed (global-settings)
```

No hay retries fallidos de T-302 en el log.

### Bundle budget advisory

```text
/admin/applicants       235 kB  Supera el límite
/admin/applicants/[id]  235 kB  Supera el límite
/admin/audit            235 kB  Supera el límite
/admin/merchants        235 kB  Supera el límite
/admin/settings         235 kB  Supera el límite
/login/mfa              235 kB  Supera el límite
```

T-302 R4 solo cambia E2E/bitácora y esos tamaños llegan desde `develop`; se registra pero no se atribuye a esta tarea.

### approval-policy

Run `37550894658`:

```text
El PR requiere aprobación vigente de Lautaro073.
```

No hay otro fallo técnico.

### D01

Lautaro073 eligió opción A el 2026-10-06:

- H05 pasa a `aceptado`, no `arreglado-verificado`.
- Evidencia compensatoria: exact-head Preview GREEN + tests unitarios de los códigos críticos.
- Follow-up creado: Issue #289.
