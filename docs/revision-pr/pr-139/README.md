# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-317-admin-mfa-enroll` → `develop` |
| **Head funcional final verificado** | `d9232e7431610f4f5dd5ab1b665b0c0f8c581757` |
| **Merge sintético CI** | `24e32c8a9070fb7604cd8734504a04335ad16d8a` = head funcional + develop `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6` |
| **Estado** | **SIN BLOQUEANTES — evidencia manual final completada** |

## Rondas

| Ronda | SHA revisado | Resultado |
|---|---|---|
| 1 | `7645c4e` | 9 bloqueantes |
| 2 | `4fb89bc` | 9 cerrados + H10–H12 |
| 3 | `6cfa41e` | H01–H12 cerrados |
| 4 | `d6fac40` | revalidación, 0 nuevos |
| 5 | `8b347e4` | staging descubre H13 |
| 6 | `b9115b7` | H13 cerrado |
| 7 | `061121a` | staging descubre H14–H15 |
| 8 | `d9232e7` | H14–H15 cerrados |
| 9 | evidencia manual | recorrido real completo; cierre final |

## Estado

H01–H15 están `arreglado-verificado`.

## Evidencia manual final

Lautaro073 confirmó en `cadeapp-staging`:
- herramienta de enrolamiento completada;
- MFA TOTP activo;
- login de admin;
- redirección automática a `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`;
- verificación correcta del TOTP;
- sesión `aal2`;
- llegada a `/admin/applicants`.

No se guardó ningún secreto.

## Follow-up fuera de T-317

Después de superar el guard y ejecutar la página admin, staging expuso defectos preexistentes del panel:

1. `getApplicantsQueue`: embed PostgREST ambiguo sobre `couriers/profile_id`.
2. `getAdminMerchants`: embed PostgREST ambiguo sobre `merchants/profile_id`.
3. `getPlatformSettings`: falta `min_offer_ars` en el remoto; el valor existe en `supabase/seed.sql`, no como garantía de migración remota.

Estos fallos ocurren después del MFA/AAL2 y pertenecen a T-122/T-123/bootstrap de staging. No reabren T-317.

## CI previo al cierre

GitHub probó el merge sintético `24e32c8a9070fb7604cd8734504a04335ad16d8a`:
- unit ✅ 108 archivos / 1520 tests
- enrolador ✅ 34/34
- login-form ✅ 4/4
- mfa-form ✅ 7/7
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅

El commit de R9 solo agrega evidencia/documentación; revalidar CI/approval-policy sobre el head final antes del merge.
