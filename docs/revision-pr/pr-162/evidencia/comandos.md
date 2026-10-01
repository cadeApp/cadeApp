# Evidencia reproducible — PR #162 / T-320

## Fuente y alcance

```text
base: develop@905b51ffb2c79d963d6716db05fa6d7034ead2d0
head: 49bc8c92ddd225e65cc930a71f2104957eb1ef7e
ahead_by: 3
behind_by: 0
changed_files: 15
archivos fuera de ficha: 0
autor tocó docs/revision-pr/**: no
```

Lecturas obligatorias realizadas desde `develop`:
- `docs/revision-pr/COMO-ENTREGAR.md`
- `docs/revision-pr/README.md`
- `.agents/skills/revisar-pr/SKILL.md`
- `docs/tasks/T-320.md`

También se leyó `docs/tasks/log/T-320.md` desde el HEAD y las lecciones de PR #139 y #142.

## RED original

Commit: `0de9f8589ff5dd44228dfd85702e35ee9a409238`  
CI run: `36818656439`  
unit job: `110229214497`

```text
Failed Tests 25

Test Files  4 failed | 106 passed (110)
Tests       25 failed | 1527 passed (1552)
```

Ejemplos observados:
- `registerAction`: faltaba `emailRedirectTo`.
- `requestPasswordResetAction`: faltaba `redirectTo`.
- `updatePasswordAction`: acciones/errores aún no cumplían T-320.
- `isPublicRoute('/auth/confirm')`: false.
- confirm route y reset form todavía no cumplían las nuevas pruebas.

## HEAD verde

CI run: `36820292693`

```text
typecheck       success
lint            success
unit            success
build           success
bundle-budget   success
audit           success
db-tests        success

Test Files  110 passed (110)
Tests       1552 passed (1552)

Files=13, Tests=1611
Result: PASS
```

## Supabase Auth — contrato actual consultado

Documentación oficial consultada mediante el conector Supabase:

```text
signOut({ scope: 'others' })
-> const { error } = await supabase.auth.signOut({ scope: 'others' })
```

El scope `others` termina las demás sesiones preservando la actual. El punto relevante para H01 es que el fallo puede llegar como `{ error }`, por lo que envolver solo el `await` en `try/catch` no observa esa clase.

También se verificó que `resetPasswordForEmail` soporta PKCE y `redirectTo`, y que `exchangeCodeForSession` es el intercambio previsto en callback SSR.

## Mutaciones/adversariales independientes

### M01 — signOut resuelve error

Fixture semántica:

```ts
signOut.mockResolvedValue({ error: { code: 'request_failed' } })
```

Con el código actual, la acción ignora el resultado y continúa a `ok({redirectTo})`.

### M02 — signOut rechaza

```ts
signOut.mockRejectedValue(new Error('network failure'))
```

El `catch` actual lo absorbe y la acción vuelve a continuar a éxito.

### M03 — mensaje contiene “session” pero no es session_missing

```text
code: unknown_failure
name: AuthApiError
message: Session backend unavailable

esperado por ficha: INTERNAL_ERROR
actual: UNAUTHENTICATED
```

### M04 — clase de next codificado

La suite actual no contiene requests con:

```text
next=%2F%2Fevil.com
next=https%3A%2F%2Fevil.com
next=%2F%5Cevil.com
```

La frontera está implementada, pero no queda fijada por prueba pese a figurar expresamente en el DoD.

## Accesibilidad

`reset-password-form.tsx` introduce:
- `Link > Button` en el CTA del enlace inválido;
- dos toggles con `focus:outline-none` sin ring de reemplazo;
- ambos toggles sin el target 48×48 que sí usa `login-form.tsx`.

El patrón canónico existente es:

```text
h-12 min-h-12 w-12 min-w-12
focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
```

## Residual manual

No se ejecutó ni se marca como hecho:
- configuración de Redirect URLs en Supabase;
- registro/confirmación real en staging;
- recuperación/cambio de contraseña real en staging.
