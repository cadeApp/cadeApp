# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-317-admin-mfa-enroll` → `develop` |
| **Head R8 revisado** | `d9232e7431610f4f5dd5ab1b665b0c0f8c581757` |
| **Merge sintético CI** | `24e32c8a9070fb7604cd8734504a04335ad16d8a` = head + develop `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6` |
| **Estado** | sin bloqueantes de código — pendiente evidencia manual final en `cadeapp-staging` |

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
| 8 | `d9232e7431610f4f5dd5ab1b665b0c0f8c581757` | H14–H15 cerrados; 0 bloqueantes de código |

## Estado

H01–H15 están `arreglado-verificado`.

## R8

- H14: el login del admin sin destino ya entra al circuito MFA hacia `/admin/applicants`, sin cambiar el contrato histórico `getRoleDefaultPath('admin') === '/'`.
- El destino se deriva del guard existente con una sesión admin AAL1; no se duplica la política MFA ni se confía en un redirect externo.
- H15: `verifyAdminMfaAction` distingue error de listado, ausencia de factor verificado, error de challenge y código incorrecto.
- La UI muestra un mensaje específico ante `AAL2_REQUIRED` y mantiene mensajes separados para error interno/código inválido.
- La ampliación de alcance quedó registrada explícitamente en la ficha T-317 y los cambios de R7 se limitaron a los archivos autorizados.
- El autor no modificó `docs/revision-pr/pr-139/**`.
- GitHub probó el merge sintético con el develop vigente: **108 archivos / 1520 tests**, enrolador 34/34, login-form 4/4, mfa-form 7/7, typecheck/lint/db/build/audit/bundle verdes.
- `approval-policy` sigue rojo intencionalmente: falta la evidencia manual final y todavía no corresponde completar el informe SIN BLOQUEANTES en el body.

## Qué queda

1. Ejecutar `pnpm admin:mfa-enroll` hasta que la herramienta confirme MFA activo.
2. En una sesión web nueva: `/login` → redirección automática a `/login/mfa?redirectTo=%2Fadmin%2Fapplicants`.
3. Ingresar un TOTP válido y comprobar llegada a `/admin/applicants`.
4. Confirmar que la sesión está en AAL2.
5. Registrar únicamente fecha, éxito, AAL2 y ruta final; nunca contraseña, QR, secreto, URI, código ni token.
