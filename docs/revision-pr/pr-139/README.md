# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-317-admin-mfa-enroll` → `develop` |
| **Base actual de revisión** | `24b034f42c6a6345edc4e77701bfb8e7f0a57aa7` |
| **Head revisado** | `4fb89bc79817650f747c2b12669687585ee526ec` |
| **Estado** | bloqueada — ronda 2 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463` | 9 bloqueantes | `revisiones/ronda-1.md` |
| 2 | `4fb89bc79817650f747c2b12669687585ee526ec` | 9 cerrados + 3 nuevos | `revisiones/ronda-2.md` |

## Estado por hallazgo

- **PR139-H01** · alto · arreglado-verificado en `4fb89bc7` · La rama está 13 commits detrás de develop y ejecuta una versión vieja de la ficha T-317
- **PR139-H02** · alto · arreglado-verificado en `4fb89bc7` · admin:mfa-enroll carga .env.local completo y mete al proceso variables privadas fuera de la excepción T-317
- **PR139-H03** · critico · arreglado-verificado en `4fb89bc7` · El flujo feliz imprime totp.secret y el runbook instruye mostrar la clave manual
- **PR139-H04** · alto · arreglado-verificado en `4fb89bc7` · El contrato de QR acepta SVG crudo/base64 y el writer inyectado recibe la data URL completa
- **PR139-H05** · alto · arreglado-verificado en `4fb89bc7` · promptSecret no falla cerrado fuera de TTY ni restaura raw mode en finally
- **PR139-H06** · medio · arreglado-verificado en `4fb89bc7` · createClient omite detectSessionInUrl:false y ningún test observa las opciones reales
- **PR139-H07** · medio · arreglado-verificado en `4fb89bc7` · El finally llama signOut() sin scope local y el mock pierde los argumentos
- **PR139-H08** · alto · arreglado-verificado en `4fb89bc7` · Errores de listFactors y unenroll se ignoran y el flujo enrola igual
- **PR139-H09** · medio · arreglado-verificado en `4fb89bc7` · Falta el caso DoD de una excepción real después de crear el QR
- **PR139-H10** · medio · abierto · Si borrar el QR falla, el finally salta signOut y no intenta cerrar la sesión local
- **PR139-H11** · alto · abierto · Un error o cierre de stdin deja readSecret pendiente y la terminal en raw mode
- **PR139-H12** · medio · abierto · El prefijo correcto permite persistir contenido que no es SVG

Datos estructurados: `hallazgos.jsonl` · comandos: `evidencia/comandos.md`

## Qué queda por hacer

1. Corregir H10–H12 sin tocar la ficha ni la carpeta de revisión.
2. Ejecutar mutaciones RED propias para los tres bordes nuevos.
3. Repetir suite focal + eslint + typecheck + lint + test.
4. Volver a revisión independiente.
5. La evidencia real de `cadeapp-staging` sigue reservada a Lautaro073 para el cierre, cuando no queden bloqueantes.

## Para análisis posterior

No se agrega AG nueva en Ronda 2. H10 refuerza enumeración completa de cleanup; H11/H12 refuerzan `P08-control-no-cubre-lo-que-dice`.
