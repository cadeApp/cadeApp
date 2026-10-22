# Informe de revisión — PR #139 / T-317 — Ronda 7

**Head revisado:** `061121ad055232e9a618313cbeece26db4a4a601`  
**Fecha:** 2026-09-30  
**Resultado:** **CON BLOQUEANTES (2)**

La segunda corrida de staging avanzó hasta el flujo web y expuso dos defectos que impiden completar el DoD end-to-end.

## Decisión de alcance de Lautaro073

Lautaro073 autorizó explícitamente corregir estos defectos dentro de PR #139 / T-317.

La ampliación debe ser **mínima y explícita**, no `src/**` genérico. Antes de tocar runtime, actualizar `docs/tasks/T-317.md` con esta decisión y autorizar únicamente los archivos necesarios de auth/admin y sus tests.

## PR139-H14 — login admin no entra automáticamente al MFA

Código actual:

`getRoleDefaultPath('admin') -> '/'`.

`loginAction` calcula el destino con `resolvePostLoginRedirect`; sin `redirectTo`, el fallback para admin termina en `/`.

El guard sí sabe hacer:
`/admin/applicants` + admin AAL1 → `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`.

Por lo tanto falta unir ambos comportamientos.

### Resultado esperado

Un login exitoso con rol admin debe acabar en:
- si la sesión necesita segundo factor: `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`;
- después de verificar MFA: `/admin/applicants`.

No debe existir el salto por defecto a `/`.

Agregar tests del login real/resolver que fallen con el comportamiento actual.

## PR139-H15 — INTERNAL_ERROR no identifica el estado del MFA

La captura de staging muestra que `verifyAdminMfaAction` devuelve:

`{ ok:false, code:'INTERNAL_ERROR' }`.

Antes de verificar el código, el action tiene dos caminos distintos que producen ese mismo resultado:
1. `listFactors()` falla **o no hay factor TOTP verificado**;
2. `mfa.challenge()` falla.

Además, Supabase documenta que `mfa.enroll()` crea inicialmente un factor `unverified`; solo después de su verificación queda listo como factor TOTP.

### Corrección requerida

- error real de `listFactors` → `INTERNAL_ERROR`;
- lista válida pero sin TOTP verificado → resultado de dominio recuperable, usando un código existente (preferentemente `AAL2_REQUIRED`) y mensaje específico de la pantalla que indique que no hay un factor MFA activo y que debe completarse el bootstrap;
- `challenge` error → `INTERNAL_ERROR`;
- código TOTP inválido → `VALIDATION_ERROR` como hoy;
- nunca exponer `error.message` remoto.

Agregar tests independientes para las cuatro ramas.

## Evidencia final

Después del arreglo, Lautaro073 vuelve a ejecutar:
1. `pnpm admin:mfa-enroll` hasta “MFA activo”;
2. `/login` con admin;
3. redirección automática a `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`;
4. código TOTP;
5. llegada a `/admin/applicants`;
6. sesión AAL2.

No registrar contraseña, QR, secret, URI, código ni token.
