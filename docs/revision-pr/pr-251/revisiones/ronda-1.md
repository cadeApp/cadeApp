# PR #251 · T-313 — Ronda 1

- PR: #251 · feat/T-313-merchant-registration-e2e → develop
- Tarea: T-313 · Issue #45
- SHA revisado: afdb326128cef1972b42bb3822a43cbd468fbd61
- Base develop: e2ff65cd29aee3292f280afc268b1c406fddc18c
- Fecha: 2026-10-04
- Resultado: CON BLOQUEANTES (4)

Método: revisión estática y enumeración mecánica. Con bloqueantes abiertos no se usa CI como evidencia de aprobación.
Sí se leyó el comentario de Vercel porque explica por qué no existe Preview ejecutable.

## Decisión de Lautaro073

D01 — A. En Develop el E2E no debe depender de SMTP real; Staging conserva SMTP/sender.
Si el alta E2E falla por correo, no se cambia el test, no se usa un email real y no se toca Staging.

## H01 · Cobertura incompleta de (merchant) · BLOQUEANTE

Ubicación: e2e/specs/merchant-registration.spec.ts:207-214

El loop actual visita solo:
- /merchant/dashboard
- /merchant/onboarding
- /merchant/requests/new
- /merchant/plan
- /requests/new

La clase completa de páginas del route group en develop contiene:
- canónicas: /merchant/dashboard, /merchant/history, /merchant/onboarding, /merchant/plan,
  /merchant/requests, /merchant/requests/new, /merchant/requests/[id]
- aliases: /onboarding, /requests, /requests/new, /requests/[id]

Faltan history, el índice de requests, ambos detalles dinámicos y aliases adicionales.
La ficha dice “un courier no entra a (merchant)”, no “estas cinco rutas”. Es pr-56/AG-37.

Qué hacer: usar una tabla completa de rutas y recorrerla. Para dinámicas usar, por ejemplo,
 /merchant/requests/e2e-denied y /requests/e2e-denied. Cada caso debe terminar en /courier/feed y no mostrar
el heading del panel merchant.

Patrón: P06-enumeracion-incompleta.

## H02 · Se silencia cleanup si ya falló el test · BLOQUEANTE

Ubicación: e2e/specs/merchant-registration.spec.ts:35-51

El catch actual solo relanza cleanupError si no existía testError. Si fallan ambos, se pierde la señal de cleanup.
En Develop compartido esto puede dejar datos transitorios sin que la corrida lo denuncie.

El patrón correcto ya existe en e2e/fixtures/roles.ts: cuando fallan ejecución y cleanup se construye
[E2E Lifecycle Error] conservando ambos; cuando solo falla cleanup, se relanza cleanup.

Qué hacer: replicar ese comportamiento dentro de registrationContext. No tocar fixtures compartidos.

Patrón: P08-control-no-cubre-lo-que-dice.

## H03 · Checks obligatorios marcados sin haber sido ejecutados · BLOQUEANTE

Ubicación: docs/tasks/log/T-313.md:25-29 + cuerpo actual de PR #251.

La ficha exige pnpm typecheck && pnpm lint && pnpm test.
La bitácora registra typecheck OK, lint n.a. y test n.a., mientras el cuerpo marca el ítem completo como cumplido.

Qué hacer: correr los tres comandos sobre el SHA corregido, registrar resúmenes reales en la bitácora y solo
mantener el checkbox de la PR en verde si los tres pasaron. No fabricar verde modificando pruebas.

Patrón: P15-entregable-declarado-pero-no-ejecutable.

## H04 · Sin RED comportamental ni GREEN de Preview · BLOQUEANTE

Ubicación: docs/tasks/log/T-313.md:26-37

La única ejecución registrada da 3 failed por la barrera fail-closed de entorno. La bitácora lo reconoce como
“RED de ambiente, no de comportamiento” y deja pendiente demostrar el RED real.

Después Vercel respondió:
Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")

No existe todavía una corrida GREEN de e2e-preview sobre este SHA.

Qué hacer: cuando Vercel permita desplegar, ejecutar el spec contra el Preview de Develop y registrar GREEN.
Para el RED no adulterar el spec ni crear tests falsos: hay que romper temporalmente la propiedad de producción
(consentimiento/guarda), no la expectativa. Si no puede hacerse sin secretos o sin salir del alcance, dejarlo
como bloqueo y reportarlo en vez de inventar evidencia.

La decisión D01 aplica: si Develop falla por correo, el arreglo es de configuración de Develop, no del spec ni de Staging.

Patrón: P08-control-no-cubre-lo-que-dice.

## Lo que está bien

- La PR toca solo e2e/specs/merchant-registration.spec.ts y docs/tasks/log/T-313.md; ambos están permitidos.
- La ficha no fue modificada.
- Las versiones legales salen de getLegalDocument; no están hardcodeadas.
- El flujo principal usa UI real y oráculos server-side sobre profiles, consents y merchants.
- El caso sin consentimiento usa Auth real y comprueba pending, consents vacíos y bloqueo al panel.
- No vi .only, .skip ni sleeps en el archivo nuevo.
- La rama está al día con develop al cierre de esta ronda: behind_by = 0.

## Checks / condiciones

- typecheck: declarado OK por el autor; no reproducido por la revisión.
- lint: no ejecutado según bitácora.
- test: no ejecutado según bitácora.
- e2e-preview: no ejecutado; no hubo deployment.
- RED comportamental: faltante.
- visto bueno P3: faltante.

## Veredicto

CON BLOQUEANTES (4). No apruebo ni mergeo.
