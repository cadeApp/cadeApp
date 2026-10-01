# Informe de revisión — PR #139 / T-317 — Ronda 8

**Head revisado:** `d9232e7431610f4f5dd5ab1b665b0c0f8c581757`  
**develop vigente:** `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6`  
**merge sintético CI:** `24e32c8a9070fb7604cd8734504a04335ad16d8a`  
**Fecha:** 2026-09-30

## Resultado técnico

**SIN BLOQUEANTES DE CÓDIGO.**

PR139-H14 y PR139-H15 quedan `arreglado-verificado`. No aparecieron hallazgos nuevos.

La PR todavía **no está lista para merge** porque falta completar la evidencia manual obligatoria de `cadeapp-staging`.

## PR139-H14 — arreglado-verificado

La solución no cambia `getRoleDefaultPath('admin')`, cuyo valor histórico sigue siendo `/`. En su lugar, `resolvePostLoginRedirect` usa un `defaultPostLoginPath` específico para admin:

1. toma `/admin/applicants` como home administrativa;
2. evalúa esa ruta con el guard real y una sesión admin AAL1;
3. el guard devuelve `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`;
4. ese valor se usa como fallback seguro del login.

Esto preserva el contrato anterior de rutas y reutiliza la política MFA existente.

Verificado:
- admin sin `redirectTo` → MFA hacia applicants;
- admin con redirect hostil → mismo destino seguro;
- merchant → `/merchant/dashboard`;
- courier → `/courier/feed`;
- admin AAL1 en `/admin/applicants` → MFA;
- admin AAL2 en `/admin/applicants` → allow;
- `LoginForm` usa el resolver canónico tras el login.

El test nuevo de `LoginForm` cubre el submit real del cliente, no solo la función pura.

## PR139-H15 — arreglado-verificado

`verifyAdminMfaAction` queda enumerado así:

- error de `listFactors` o ausencia de data → `INTERNAL_ERROR`;
- lista válida sin TOTP verificado → `AAL2_REQUIRED`;
- factor inesperado sin id → `INTERNAL_ERROR`;
- error o ausencia de challenge → `INTERNAL_ERROR`;
- error de verify/código incorrecto → `VALIDATION_ERROR`;
- éxito → redirect admin saneado.

No se propaga `error.message` remoto.

`MfaForm`:
- `VALIDATION_ERROR` → mensaje de código inválido;
- `AAL2_REQUIRED` → `ADMIN_COPY.mfa.noActiveFactor`;
- otros códigos → diccionario de dominio.

El copy específico indica que no existe un factor activo y que debe completarse nuevamente el enrolamiento.

## Alcance

Desde R7 solo cambiaron:
- `docs/tasks/T-317.md`;
- `docs/tasks/log/T-317.md`;
- los nueve archivos auth/admin autorizados por la excepción de alcance.

`docs/revision-pr/pr-139/**` quedó byte-identical al commit de revisión R7 hasta esta ronda.

## RED / mutaciones del autor

La bitácora documenta:
- H14 natural: 9 fallos antes del arreglo;
- H15 natural: 2 fallos antes del arreglo;
- H14 mutación de regreso a destino `/`: 9 fallos;
- H15-A sin factor → INTERNAL_ERROR: 1 fallo;
- H15-B challenge → AAL2_REQUIRED: 1 fallo;
- H15-C eliminación del copy específico: 1 fallo;
- restauración GREEN focal: 96/96.

La revisión independiente verificó que las aserciones observan las propiedades reales y no son tests tautológicos.

## CI del merge realista

GitHub checkout:
`24e32c8a9070fb7604cd8734504a04335ad16d8a` = `d9232e7431610f4f5dd5ab1b665b0c0f8c581757` + develop `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6`.

Resultados:
- unit ✅ **108 archivos / 1520 tests**
- `tools/admin-mfa-enroll.test.ts` ✅ 34/34
- `src/features/auth/components/login-form.test.tsx` ✅ 4/4
- `src/features/admin/components/mfa-form.test.tsx` ✅ 7/7
- verify-workflows ✅ 31
- verify-adr ✅ 6
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- Supabase Preview skipped
- approval-policy ❌ únicamente porque el body todavía no contiene el informe final SIN BLOQUEANTES.

## Pendiente operativo

Repetir la evidencia manual desde cero:
1. terminar `pnpm admin:mfa-enroll` hasta confirmación de MFA activo;
2. cerrar/renovar la sesión web;
3. login de admin;
4. redirección automática al MFA;
5. verificar TOTP;
6. llegar a `/admin/applicants` con AAL2.

Hasta completar esto, no actualizar el body con el informe final y no mergear.
