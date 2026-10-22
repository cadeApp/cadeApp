# Informe de revisión — PR #139 / T-317

**PR:** https://github.com/cadeApp/cadeApp/pull/139  
**Head SHA revisado:** 7645c4e3f55cc349a72443b2b0ea0e7fa5cdc463  
**Base actual:** develop @ 24b034f42c6a6345edc4e77701bfb8e7f0a57aa7  
**Fecha:** 2026-09-30

## Resultado

**CON BLOQUEANTES (9).** No se inspeccionó CI de readiness porque el protocolo lo reserva para cuando la ronda esté en condiciones de aprobar. Se comparó el target actual, la ficha desde develop, bitácora, reglas y se reprodujeron los hallazgos runtime indicados sobre el contenido exacto del SHA revisado.

La rama está 13 commits detrás de develop. La ficha vigente endureció el flujo MFA después del fork: no mostrar totp.secret, QR utf-8 estricto, TTY fail-closed, detectSessionInUrl:false, signOut local y casos de prueba adicionales.

## Resumen

| ID | Sev. | Archivo | Problema |
|---|---|---|---|
| H01 | alto | docs/tasks/log/T-317.md:7 | La rama está 13 commits detrás de develop y ejecuta una versión vieja de la ficha T-317 |
| H02 | alto | package.json:21 | admin:mfa-enroll carga .env.local completo y mete al proceso variables privadas fuera de la excepción T-317 |
| H03 | critico | tools/admin-mfa-enroll.mjs:111 | El flujo feliz imprime totp.secret y el runbook instruye mostrar la clave manual |
| H04 | alto | tools/admin-mfa-enroll.mjs:16 | El contrato de QR acepta SVG crudo/base64 y el writer inyectado recibe la data URL completa |
| H05 | alto | tools/admin-mfa-enroll.mjs:158 | promptSecret no falla cerrado fuera de TTY ni restaura raw mode en finally |
| H06 | medio | tools/admin-mfa-enroll.mjs:187 | createClient omite detectSessionInUrl:false y ningún test observa las opciones reales |
| H07 | medio | tools/admin-mfa-enroll.mjs:137 | El finally llama signOut() sin scope local y el mock pierde los argumentos |
| H08 | alto | tools/admin-mfa-enroll.mjs:87 | Errores de listFactors y unenroll se ignoran y el flujo enrola igual |
| H09 | medio | tools/admin-mfa-enroll.test.ts:139 | Falta el caso DoD de una excepción real después de crear el QR |

## H01 · La rama está 13 commits detrás de develop y ejecuta una versión vieja de la ficha T-317

**Archivo:** docs/tasks/log/T-317.md:7  
**Detección:** analisis

### Diagnóstico

La implementación salió desde la rama de la ficha antes de consolidarse #138 y no volvió a sincronizar el target antes de review.

### Evidencia

compare develop..feat/T-317-admin-mfa-enroll: status=diverged, behind_by=13, ahead_by=1; develop actual 24b034f y head revisado 7645c4e.

### Por qué pasó los checks

Las pruebas del autor validan la especificación vieja de la rama; no incluyen los requisitos agregados en develop.

### Arreglo requerido

Antes de cualquier arreglo: git fetch origin && git merge origin/develop. Para docs/tasks/T-317.md gana íntegramente develop. No editar la ficha para acomodarla al código viejo.

## H02 · admin:mfa-enroll carga .env.local completo y mete al proceso variables privadas fuera de la excepción T-317

**Archivo:** package.json:21  
**Detección:** analisis

### Diagnóstico

Se usó --env-file como comodidad aunque la excepción operativa vigente enumera solo URL pública, anon key y credenciales finales interactivas.

### Evidencia

scripts[admin:mfa-enroll] usa node --env-file-if-exists=.env.local; .env.example documenta SUPABASE_SERVICE_ROLE_KEY, VAPID_PRIVATE_KEY, DNI_HMAC_SECRET, CRON_SECRET y DISCORD_ERROR_WEBHOOK_URL además de las dos variables públicas permitidas.

### Por qué pasó los checks

La suite focal no inspecciona el launcher de package.json ni el conjunto de variables que Node carga antes del módulo.

### Arreglo requerido

Cambiar scripts[admin:mfa-enroll] a exactamente: node tools/admin-mfa-enroll.mjs. La herramienta valida solo NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY; no abre ni carga .env.local.

## H03 · El flujo feliz imprime totp.secret y el runbook instruye mostrar la clave manual

**Archivo:** tools/admin-mfa-enroll.mjs:111  
**Detección:** verificado-runtime

### Diagnóstico

La rama conserva la decisión vieja de ofrecer carga manual del secreto TOTP; develop la reemplazó por D03/3-A: solo QR temporal.

### Evidencia

Harness independiente sobre enrollAdminMfa del SHA revisado devolvió ok:true y output con el sentinel SECRET-TOTP-XYZ. El runbook línea 48 también promete mostrar la clave.

### Por qué pasó los checks

El test de confidencialidad solo excluye PASSWORD y CODE aunque el mock ya contiene totp.secret.

### Arreglo requerido

Eliminar toda impresión/retorno de totp.secret y toda mención del runbook a carga manual. La única salida de enrolamiento es la ruta del QR temporal. Probar también access token, refresh token, totp.secret y otpauth:// como sentinelas prohibidos.

## H04 · El contrato de QR acepta SVG crudo/base64 y el writer inyectado recibe la data URL completa

**Archivo:** tools/admin-mfa-enroll.mjs:16  
**Detección:** verificado-runtime

### Diagnóstico

El helper tolerante y el writer CLI esconden la transformación fuera de la lógica inyectada; la ficha vigente exige prefijo utf-8 exacto y writer recibiendo solo XML.

### Evidencia

Harness: rawSvgRejected=false e injectedWriterReceivesSvgOnly=false. El test de camino feliz espera written=[QR] y además considera base64/raw válidos.

### Por qué pasó los checks

Los tests protegen explícitamente la semántica vieja, por lo que quedan verdes frente al requisito vigente roto.

### Arreglo requerido

Aceptar únicamente el prefijo data:image/svg+xml;utf-8,. Quitar el prefijo dentro de la lógica inyectada y pasar a writeQr solo XML que empiece con <svg. Raw SVG y base64 deben fallar cerrado antes de escribir.

## H05 · promptSecret no falla cerrado fuera de TTY ni restaura raw mode en finally

**Archivo:** tools/admin-mfa-enroll.mjs:158  
**Detección:** verificado-runtime

### Diagnóstico

Se silenció readline sobrescribiendo _writeToOutput, pero no se implementó el contrato operativo de TTY incorporado luego a la ficha.

### Evidencia

Ejecutando la función exacta con stdin.isTTY=false simulado resolvió piped-password; el helper no contiene isTTY, setRawMode ni finally.

### Por qué pasó los checks

El test solo comprueba que se inyecta promptSecret; no prueba la implementación CLI del helper.

### Arreglo requerido

Implementar entrada oculta con input/output inyectables. No-TTY rechaza antes de leer. En TTY, raw mode solo durante captura, sin eco, y restauración de estado/listeners en finally también ante error/Ctrl+C.

## H06 · createClient omite detectSessionInUrl:false y ningún test observa las opciones reales

**Archivo:** tools/admin-mfa-enroll.mjs:187  
**Detección:** analisis

### Diagnóstico

La lógica recibe un cliente inyectado y la suite nunca ejerce el wrapper que lo construye.

### Evidencia

La configuración actual es auth:{persistSession:false,autoRefreshToken:false}; detectSessionInUrl no aparece en el archivo.

### Por qué pasó los checks

Typecheck/lint y tests de negocio no observan opciones de construcción del cliente.

### Arreglo requerido

Construir el cliente con persistSession:false, autoRefreshToken:false y detectSessionInUrl:false. Hacer observable/injectable la factory para que el test afirme exactamente las tres opciones.

## H07 · El finally llama signOut() sin scope local y el mock pierde los argumentos

**Archivo:** tools/admin-mfa-enroll.mjs:137  
**Detección:** verificado-runtime

### Diagnóstico

El mock se diseñó para orden de llamadas, no para el contrato del cierre de sesión.

### Evidencia

Harness independiente capturó signOutArgs=[[]]; el DoD vigente exige signOut({scope:'local'}). Los tests solo registran la palabra signOut.

### Por qué pasó los checks

La aserción de orden pasa igual con cualquier argumento o sin él.

### Arreglo requerido

Cambiar typedef, implementación y mock para signOut({scope:'local'}); afirmar los argumentos en camino feliz y en un camino de error posterior al sign-in.

## H08 · Errores de listFactors y unenroll se ignoran y el flujo enrola igual

**Archivo:** tools/admin-mfa-enroll.mjs:87  
**Detección:** verificado-runtime

### Diagnóstico

Se manejaron errores de sign-in/enroll/verify, pero no se enumeraron todas las llamadas remotas previas al enrolamiento.

### Evidencia

Harness: listFactors con data:null,error llamó enroll y terminó ok:true; unenroll con error llamó unenroll, luego enroll y terminó ok:true.

### Por qué pasó los checks

Los mocks de listFactors y unenroll siempre devuelven éxito; no hay casos negativos.

### Arreglo requerido

Fail-closed: error o data inválida de listFactors aborta antes de enroll; cualquier unenroll con error aborta antes de enroll. Mensaje operativo estable, sin imprimir el mensaje remoto.

## H09 · Falta el caso DoD de una excepción real después de crear el QR

**Archivo:** tools/admin-mfa-enroll.test.ts:139  
**Detección:** verificado-runtime

### Diagnóstico

La suite representa errores remotos como valores {error} y no como promesas que rechazan/excepciones.

### Evidencia

Control con challengeAndVerify lanzando tras writeQr: el código actual borró /tmp/qr.svg. Mutación propia que pierde qrFile solo en catch dejó removed=[]; la suite del autor no tiene mock throwing/rejected en ese tramo.

### Por qué pasó los checks

Los caminos normales y verifyError no ejercen la semántica de finally frente a throw.

### Arreglo requerido

Agregar un test donde challengeAndVerify o AAL lance/rechace después de crear el QR; debe observar rechazo + removeFile + signOut local. Mutación RED: perder/saltar cleanup solo en esa rama excepcional.

## NO TOCAR — falsos positivos descartados

- writeFile con mode 0o600 es correcto; H04 trata del contenido/contrato, no de permisos.
- profiles.role corta a no-admin antes de enrolar.
- Un TOTP verificado corta antes de crear otro.
- El finally actual sí borra QR frente a throw; H09 es un hueco de cobertura demostrado por mutación propia.
- No se usa service_role directamente dentro del módulo.

## Checks / pendientes

- Suite focal declarada por el autor: 12/12 sobre la especificación vieja.
- pnpm test del autor: rojo, 1 failed / 1392 passed según bitácora; debe repetirse tras sincronizar develop.
- CI de readiness: no inspeccionado por existir bloqueantes.
- Evidencia real en cadeapp-staging: pendiente y la ejecuta Lautaro073, no el agy.
- No hubo decisiones 🔵: la ficha vigente ya fija los contratos relevantes.

## Metodología

Ficha leída desde develop; comparación develop...head; comentarios de PR (ninguno); bitácora; AGENTS/rules; lecciones pr-56, pr-62, pr-64, pr-63, pr-68 y pr-82. Se enumeraron todas las llamadas Supabase del flujo y se usaron harnesses propios para secreto, QR, no-TTY, signOut, errores de factores y cleanup excepcional.
