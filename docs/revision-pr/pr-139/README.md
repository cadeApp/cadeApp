# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-317-admin-mfa-enroll` → `develop` |
| **Head R6 revisado** | `b9115b7e388a490e51461f5085fc5918a4bd6740` |
| **Merge sintético CI** | `d85ee4ac17921e46ca4d228fdfe8ef26b070116d` = head + develop `4de495e7ab2b63ce3d9907a66400ce7e5cef9cd6` |
| **Estado** | bloqueada — Ronda 7: staging descubre H14 y H15 en login/MFA web |

## Rondas

| Ronda | SHA revisado | Resultado |
|---|---|---|
| 1 | `7645c4e` | 9 bloqueantes |
| 2 | `4fb89bc` | 9 cerrados + H10–H12 |
| 3 | `6cfa41e` | H01–H12 cerrados |
| 4 | `d6fac40` | revalidación, 0 nuevos |
| 5 | `8b347e4` | staging descubre H13 |
| 6 | `b9115b7e388a490e51461f5085fc5918a4bd6740` | H13 cerrado; 0 bloqueantes de código |
| 7 | `061121ad055232e9a618313cbeece26db4a4a601` | H14–H15 abiertos por evidencia real de staging |

## Estado

H01–H13 están `arreglado-verificado`. H14 y H15 están abiertos por la evidencia real de staging.

## R6

- Parser acepta el formato real de Supabase: prefijo exacto + SVG crudo con declaración XML/comentarios opcionales antes de la raíz.
- No usa `decodeURIComponent`.
- Raw SVG, base64, prefijo incorrecto y cuerpos sin raíz SVG siguen fail-closed.
- La ficha T-317 corrige únicamente el caso de prueba del QR para describir el contrato real.
- El autor no tocó `docs/revision-pr/pr-139/**`.
- GitHub ejecutó CI sobre el merge sintético con el develop vigente: 107 archivos / 1498 tests; enrolador 34/34; typecheck/lint/db/build/audit/bundle verdes.
- `approval-policy` sigue rojo intencionalmente mientras falte la evidencia manual final y el body no tenga el informe final.

## Qué queda

Repetir `pnpm admin:mfa-enroll` en `cadeapp-staging`, escanear el QR, verificar TOTP, y comprobar `/login → /login/mfa → /admin/applicants` con AAL2. Registrar solo fecha, éxito, AAL2 y ruta final.
