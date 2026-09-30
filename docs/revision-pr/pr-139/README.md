# PR #139 — T-317 · Alta de admin y enrolamiento del primer factor MFA

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/139 |
| **Tarea** | T-317 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-317-admin-mfa-enroll → develop |
| **Base actual de revisión** | 24b034f42c6a6345edc4e77701bfb8e7f0a57aa7 |
| **Head revisado** | 7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463 |
| **Estado** | bloqueada — ronda 1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | 7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463 | 9 bloqueantes | revisiones/ronda-1.md |

## Estado por hallazgo

- **PR139-H01** · alto · abierto · La rama está 13 commits detrás de develop y ejecuta una versión vieja de la ficha T-317
- **PR139-H02** · alto · abierto · admin:mfa-enroll carga .env.local completo y mete al proceso variables privadas fuera de la excepción T-317
- **PR139-H03** · critico · abierto · El flujo feliz imprime totp.secret y el runbook instruye mostrar la clave manual
- **PR139-H04** · alto · abierto · El contrato de QR acepta SVG crudo/base64 y el writer inyectado recibe la data URL completa
- **PR139-H05** · alto · abierto · promptSecret no falla cerrado fuera de TTY ni restaura raw mode en finally
- **PR139-H06** · medio · abierto · createClient omite detectSessionInUrl:false y ningún test observa las opciones reales
- **PR139-H07** · medio · abierto · El finally llama signOut() sin scope local y el mock pierde los argumentos
- **PR139-H08** · alto · abierto · Errores de listFactors y unenroll se ignoran y el flujo enrola igual
- **PR139-H09** · medio · abierto · Falta el caso DoD de una excepción real después de crear el QR

Datos estructurados: hallazgos.jsonl · comandos: evidencia/comandos.md

## Qué queda por hacer

1. Merge de origin/develop, conservando la ficha oficial.
2. Corregir H02–H09 con las pruebas y mutaciones indicadas.
3. Dejar eslint focal, typecheck, lint y test verdes.
4. Volver a revisión independiente.
5. Recién sin bloqueantes, Lautaro073 ejecuta la evidencia real en cadeapp-staging.

## Para análisis posterior

No se propone AG nueva. Se refuerzan pr-63/AG-71, pr-56/AG-37, pr-68/AG-75 y P08-control-no-cubre-lo-que-dice.
