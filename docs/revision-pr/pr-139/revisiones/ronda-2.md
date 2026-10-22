# Informe de revisión — PR #139 / T-317 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/139  
**Head SHA revisado:** `4fb89bc79817650f747c2b12669687585ee526ec`  
**Base:** `develop` @ `24b034f42c6a6345edc4e77701bfb8e7f0a57aa7`  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (3 nuevos).** Los 9 hallazgos de Ronda 1 quedaron corregidos y fueron revalidados de forma independiente sobre este SHA. La rama está al día con develop y el autor no tocó `docs/revision-pr/pr-139/**` después del commit de revisión.

CI de readiness no se inspeccionó todavía porque el protocolo lo reserva para cuando no haya bloqueantes. La bitácora declara 25/25 en la suite focal; las verificaciones de esta ronda no se apoyan en esa batería.

## Hallazgos de Ronda 1

| ID | Estado R2 | Verificación independiente |
|---|---|---|
| H01 | ✅ arreglado-verificado | compare develop...head: status ahead, behind_by=0; docs/tasks/T-317.md tiene el mismo blob SHA 2e1f5d6 en develop y en 4fb89bc; compare desde 2ee1895 no muestra cambios del autor en pr-139. |
| H02 | ✅ arreglado-verificado | Inspección exacta de package.json @ 4fb89bc: scripts[admin:mfa-enroll] = node tools/admin-mfa-enroll.mjs. |
| H03 | ✅ arreglado-verificado | Harness independiente @ 4fb89bc: flujo feliz ok:true y salida sin sentinel TOTP-SECRET; runbook muestra solo la ruta temporal. |
| H04 | ✅ arreglado-verificado | Harness independiente @ 4fb89bc: writer recibe XML que empieza <svg; raw SVG y data URL base64 son rechazados. |
| H05 | ✅ arreglado-verificado | Harness/inspección @ 4fb89bc: no-TTY falla cerrado; readSecret activa y restaura raw mode en Enter/Ctrl+C. Residual nuevo sobre error/end se separa en H11. |
| H06 | ✅ arreglado-verificado | Harness independiente @ 4fb89bc capturó auth.persistSession=false, autoRefreshToken=false, detectSessionInUrl=false. |
| H07 | ✅ arreglado-verificado | Harness independiente @ 4fb89bc capturó signOutArgs=[[{scope:'local'}]] en camino feliz y excepción post-QR. |
| H08 | ✅ arreglado-verificado | Harness independiente @ 4fb89bc: listFactors error => FACTORS_UNAVAILABLE; unenroll error => CLEANUP_FAILED; ambos abortan antes de enroll. |
| H09 | ✅ arreglado-verificado | Harness independiente @ 4fb89bc: challengeAndVerify lanza tras crear QR y aun así removeFile('/tmp/qr.svg') + signOut({scope:'local'}). |

## Nuevos bloqueantes

### H10 · Si borrar el QR falla, el finally salta signOut

**Archivo:** `tools/admin-mfa-enroll.mjs:219-220`  
**Severidad:** medio · **Estado:** [VERIFICADO runtime]

El cleanup hace `await removeFile(qrFile)` y recién después `await signOut`. Si el primer await rechaza, el segundo no se intenta. La ficha exige ambos efectos de cleanup como obligaciones independientes.

**Reproducción:** con `removeFile` inyectado que lanza `Error('remove failed')`, el flujo lanzó ese error y `signOutArgs` quedó `[]`.

**Arreglo:** aislar los dos cleanups. Como mínimo, envolver el borrado en un `try` cuyo `finally` haga siempre `signOut({ scope:'local' })`; conservar una semántica de error explícita. Test: `removeFile` rechaza y aun así signOut se llama exactamente una vez con scope local.

### H11 · Error/end de stdin deja la terminal en raw mode

**Archivo:** `tools/admin-mfa-enroll.mjs:56-92`  
**Severidad:** alto · **Estado:** [VERIFICADO runtime]

`readSecret` solo escucha `data`. Si stdin emite `error` o termina (`end`) antes de Enter/Ctrl+C, la Promise queda pendiente y el `finally` que restaura el raw mode no se alcanza.

**Reproducción:** `error` dejó `isRaw=true`, 1 listener `data`, 0 listeners `error/end`; `end` dejó exactamente el mismo estado. En el caso `error`, el EventEmitter además lanzó fuera de la Promise.

**Arreglo:** registrar handlers propios de `error` y `end` (y limpiar todos los listeners en finally). Ambos deben rechazar con `OperatorError` seguro, sin propagar mensajes del stream. Tests: error y end restauran raw mode, dejan cero listeners y rechazan.

### H12 · Prefijo válido no garantiza que el cuerpo sea SVG

**Archivo:** `tools/admin-mfa-enroll.mjs:30`  
**Severidad:** medio · **Estado:** [VERIFICADO runtime]

La validación comprueba únicamente `data:image/svg+xml;utf-8,`. Después de decodificar no exige que el resultado empiece con `<svg`, aunque la ficha dice escribir solo XML SVG y su caso exacto exige ese prefijo en el contenido escrito.

**Reproducción:** `qrSvgFromDataUri('data:image/svg+xml;utf-8,not-svg')` devuelve `not-svg`; ese valor llega al writer.

**Arreglo:** después de `decodeURIComponent`, exigir que el XML resultante empiece con `<svg` (según el contrato exacto de la ficha) antes de devolverlo. Test con prefijo correcto + cuerpo `not-svg` debe fallar cerrado y no llamar writer.

## NO TOCAR — comprobado en esta ronda

- `package.json` ya no carga `.env.local`.
- El secreto TOTP ya no se imprime ni se documenta como carga manual.
- Raw SVG y data URL base64 ya fallan cerrado.
- `createClient` tiene los tres flags exactos.
- `listFactors`/`unenroll` ya fallan cerrado.
- `challengeAndVerify` lanzando después de crear QR sí ejecuta cleanup en el caso normal de `removeFile`.
- `signOut({scope:'local'})` está correcto cuando se alcanza.
- La ficha oficial no fue modificada por la rama.

## Decisiones

No hay decisiones 🔵 pendientes para Lautaro073.

## Checks

- Suite focal según bitácora del autor: 25/25.
- `pnpm test` según bitácora del autor: 2 fallos fuera de T-317; no se evalúan como readiness mientras existan H10–H12.
- CI de readiness: no inspeccionado aún.
- Evidencia real en staging: pendiente para Lautaro073, no para el agy.
