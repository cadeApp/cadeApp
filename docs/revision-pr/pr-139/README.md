# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-317-admin-mfa-enroll` → `develop` |
| **Head funcional validado** | `6cfa41e949b3ac81c17f4a3f6b545de8b27a10f1` |
| **Head actual revalidado** | `d6fac40e01202c99f6db800e4057017ffee3c80c` |
| **develop al revisar R4** | `158f83b2b1bf6211a2bf8e53ae7cd90130edc445` |
| **Estado** | sin bloqueantes de código — pendiente evidencia manual obligatoria en `cadeapp-staging` |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463` | 9 bloqueantes | `revisiones/ronda-1.md` |
| 2 | `4fb89bc79817650f747c2b12669687585ee526ec` | 9 cerrados + 3 nuevos | `revisiones/ronda-2.md` |
| 3 | `6cfa41e949b3ac81c17f4a3f6b545de8b27a10f1` | 12 cerrados · 0 nuevos | `revisiones/ronda-3.md` |
| 4 | `d6fac40e01202c99f6db800e4057017ffee3c80c` | 0 nuevos · implementación revalidada | `revisiones/ronda-4.md` |

## Estado por hallazgo

- **PR139-H01** · alto · arreglado-verificado en `6cfa41e`
- **PR139-H02** · alto · arreglado-verificado en `6cfa41e`
- **PR139-H03** · critico · arreglado-verificado en `6cfa41e`
- **PR139-H04** · alto · arreglado-verificado en `6cfa41e`
- **PR139-H05** · alto · arreglado-verificado en `6cfa41e`
- **PR139-H06** · medio · arreglado-verificado en `6cfa41e`
- **PR139-H07** · medio · arreglado-verificado en `6cfa41e`
- **PR139-H08** · alto · arreglado-verificado en `6cfa41e`
- **PR139-H09** · medio · arreglado-verificado en `6cfa41e`
- **PR139-H10** · medio · arreglado-verificado en `6cfa41e`
- **PR139-H11** · alto · arreglado-verificado en `6cfa41e`
- **PR139-H12** · medio · arreglado-verificado en `6cfa41e`

Los datos estructurados permanecen en `hallazgos.jsonl`; R4 no agrega hallazgos nuevos.

## Qué queda por hacer

1. Completar la evidencia real obligatoria en `cadeapp-staging`: cuenta admin confirmada, `pnpm admin:mfa-enroll`, luego `/login` → `/login/mfa` → `/admin/applicants` con `aal2`.
2. Registrar en la bitácora solo fecha, resultado, AAL2 y ruta final; nunca contraseña, código, QR, token ni secreto TOTP.
3. Recién después, actualizar el cuerpo de la PR con el informe completo `Resultado: SIN BLOQUEANTES` para que `approval-policy` quede verde.
4. Revalidar el head final si aparece cualquier commit nuevo antes del merge.

## Nota sobre divergencia actual

La rama está 12 commits detrás del `develop` actual, pero esos commits son exclusivamente documentación/revisión de T-318/PR #143 y no cambian T-317, workflows ni código ejecutable. No se considera bloqueante para esta ronda; sí se volverá a comprobar antes del merge final.
