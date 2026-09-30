# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-317-admin-mfa-enroll` → `develop` |
| **Base actual de revisión** | `24b034f42c6a6345edc4e77701bfb8e7f0a57aa7` |
| **Head de implementación revisado** | `6cfa41e949b3ac81c17f4a3f6b545de8b27a10f1` |
| **Estado** | sin bloqueantes de código — pendiente evidencia manual en `cadeapp-staging` |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463` | 9 bloqueantes | `revisiones/ronda-1.md` |
| 2 | `4fb89bc79817650f747c2b12669687585ee526ec` | 9 cerrados + 3 nuevos | `revisiones/ronda-2.md` |
| 3 | `6cfa41e949b3ac81c17f4a3f6b545de8b27a10f1` | 12 cerrados · 0 nuevos | `revisiones/ronda-3.md` |

## Estado por hallazgo

- **PR139-H01** · alto · arreglado-verificado en `6cfa41e` · La rama está 13 commits detrás de develop y ejecuta una versión vieja de la ficha T-317
- **PR139-H02** · alto · arreglado-verificado en `6cfa41e` · admin:mfa-enroll carga .env.local completo y mete al proceso variables privadas fuera de la excepción T-317
- **PR139-H03** · critico · arreglado-verificado en `6cfa41e` · El flujo feliz imprime totp.secret y el runbook instruye mostrar la clave manual
- **PR139-H04** · alto · arreglado-verificado en `6cfa41e` · El contrato de QR acepta SVG crudo/base64 y el writer inyectado recibe la data URL completa
- **PR139-H05** · alto · arreglado-verificado en `6cfa41e` · promptSecret no falla cerrado fuera de TTY ni restaura raw mode en finally
- **PR139-H06** · medio · arreglado-verificado en `6cfa41e` · createClient omite detectSessionInUrl:false y ningún test observa las opciones reales
- **PR139-H07** · medio · arreglado-verificado en `6cfa41e` · El finally llama signOut() sin scope local y el mock pierde los argumentos
- **PR139-H08** · alto · arreglado-verificado en `6cfa41e` · Errores de listFactors y unenroll se ignoran y el flujo enrola igual
- **PR139-H09** · medio · arreglado-verificado en `6cfa41e` · Falta el caso DoD de una excepción real después de crear el QR
- **PR139-H10** · medio · arreglado-verificado en `6cfa41e` · Si borrar el QR falla, el finally salta signOut y no intenta cerrar la sesión local
- **PR139-H11** · alto · arreglado-verificado en `6cfa41e` · Un error o cierre de stdin deja readSecret pendiente y la terminal en raw mode
- **PR139-H12** · medio · arreglado-verificado en `6cfa41e` · El prefijo correcto permite persistir contenido que no es SVG

Datos estructurados: `hallazgos.jsonl` · comandos: `evidencia/comandos.md`

## Qué queda por hacer

1. Lautaro073 ejecuta la evidencia real de `cadeapp-staging`: promoción por SQL, `pnpm admin:mfa-enroll`, login → MFA → `/admin/applicants`.
2. Registrar en la bitácora solo resultado, fecha y ruta; nunca credenciales, QR, código ni secretos.
3. Pegar el informe completo `SIN BLOQUEANTES` en la sección `### Informe de revisión de agy` del cuerpo de la PR. `approval-policy` falla hoy únicamente porque esa sección sigue vacía.
4. Revalidar el head final si cualquiera de esos pasos crea un commit nuevo antes del merge.

## Para análisis posterior

No se agrega AG nueva. Ronda 3 confirma que H10–H12 quedaron protegidos por pruebas que fallan al retirar cada guarda correspondiente.
