# Informe de revisión — PR #139 / T-317 — Ronda 9

**Fecha:** 2026-09-30  
**Resultado:** **SIN BLOQUEANTES**

## Evidencia manual final

Lautaro073 confirmó el recorrido real en `cadeapp-staging`:

`pnpm admin:mfa-enroll` → MFA activo → `/login` → `/login/mfa?redirectTo=%2Fadmin%2Fapplicants` → TOTP válido → `/admin/applicants` con sesión `aal2`.

No se registran credenciales ni secretos.

Esta evidencia cierra el último DoD operativo de T-317.

## Errores observados después de AAL2

La consola mostró errores al ejecutar consultas internas del panel:

- cola de postulantes: PostgREST no puede resolver el embed por más de una relación;
- comercios: error equivalente de embed;
- settings: `min_offer_ars` ausente o inválido.

No son fallos del flujo T-317:

- el error de applicants aparece dentro de `getApplicantsQueue()` después de que `ApplicantsPage` ya fue alcanzada;
- los otros errores aparecen al navegar a páginas de T-123;
- `src/features/admin/queries.ts` proviene de T-122/T-123 y no fue introducido por T-317.

### Diagnóstico de follow-up

Las consultas usan:
- `profiles:profile_id (...)` desde `couriers`;
- `profiles:profile_id (...)` desde `merchants`.

La documentación de Supabase/PostgREST exige seleccionar explícitamente la FK cuando varias relaciones pueden coincidir, mediante `relation!foreign_key(...)` (con alias si corresponde).

Además, `min_offer_ars` está sembrado en `supabase/seed.sql`; una base remota creada/aplicada solo con migraciones puede no tener ese seed.

Estos puntos deben ir en una tarea separada de saneamiento del panel/bootstrap; no se amplía #139 otra vez.

## Estado de hallazgos

H01–H15: `arreglado-verificado`.

## Checks

Último merge sintético con cambios funcionales:
`24e32c8a9070fb7604cd8734504a04335ad16d8a` = `d9232e7` + develop `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6`.

- unit: 1520/1520 ✅
- admin-mfa-enroll: 34/34 ✅
- login-form: 4/4 ✅
- mfa-form: 7/7 ✅
- typecheck/lint/db-tests/build/bundle-budget/audit ✅

El commit de esta ronda solo modifica documentación/evidencia.

## BLOQUEANTES

Ninguno.

## MEJORAS

Follow-up separado para consultas admin y bootstrap de `platform_settings`.

## No revisado / dudas para Lautaro073

Ninguna pendiente para T-317.

No aprobé ni mergeé la PR.
