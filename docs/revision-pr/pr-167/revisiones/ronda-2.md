# Ronda 2 — PR #167 / T-322

**Fecha:** 2026-10-01  
**SHA funcional:** `3c94d0eb8116987cc605ce5b433ad05e89b1b470`  
**Resultado:** **CON BLOQUEANTE (1)**

## Verificación de R1

### PR167-H01 — arreglado-verificado
`registerSchema` exige ahora `displayName` y `phone` con `.trim().min(1)`. La batería cubre omitido, vacío y solo espacios para ambos y exige que `signUp` no se invoque.

### PR167-H02 — arreglado-verificado
`/auth/confirm` distingue onboarding incompleto/completo. Los tests ejercen merchant/courier con PKCE `code` y `token_hash + type=signup`; cuentas nuevas van a onboarding y cuentas completas conservan dashboard/feed. Recovery y defensas existentes siguen cubiertas.

### PR167-H03 — arreglado-verificado
El copy ya no afirma un envío: “Si pudimos procesar el registro...”. La prueba anti-enumeración exige el mismo estado observable para alta nueva, `identities: []`, `user_already_exists` y `email_exists`.

### PR167-H04 — arreglado-verificado
El control ahora omite deliberadamente `courierId`, dispara la carga y observa el valor recibido por `uploadCourierDocument`; reintroducir `temp-courier` o `temp-courier-id` deja de ser invisible al test.

## PR167-R01 — ALTO — contrato legal inconsistente con el registro

CI exact-head `36914443982` falla en `src/features/legal/legal-red.test.ts:57`.

La política v1.0 dice que `displayName` y teléfono son facultativos, mientras T-322 ahora los exige en servidor. No corresponde debilitar H01 ni editar fuera de alcance sin decisión.

### Decisión P1
Lautaro073 eligió **A**:
- mantener nombre/teléfono obligatorios;
- ampliar mínimamente T-322 a `src/features/legal/documents.ts` y `src/features/legal/legal-red.test.ts`;
- publicar **Privacy v1.1** en vez de reescribir v1.0 silenciosamente;
- conservar aceptaciones históricas;
- no reescribir otras secciones legales.

La ampliación oficial está en **PR #168**. Hasta que #168 esté mergeada en `develop`, agy no debe tocar esos archivos.

## CI R2

```text
typecheck       success
lint            success
build           success
bundle-budget   success
audit           success
db-tests        success — 1614/1614
unit            failure — 1580 passed / 1 failed
falla           src/features/legal/legal-red.test.ts:57
```

No se aprueba ni mergea #167 todavía.
