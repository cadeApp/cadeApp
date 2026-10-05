# Ronda 2 — PR #253 (T-309) — Revisión independiente

- SHA revisado: `64f5b9153a5614ba2920e622857db18910137a42`
- develop: `f1ae16106e61bbb6707b4adf17f7572bafbbd23b`
- Fecha: 2026-10-05
- PR: Draft, mergeable, 10 archivos en diff actual.
- Alcance actual: solo T-309 + carpeta de revisión; el merge de T-337 no queda en el diff contra develop.
- Decisiones pendientes: ninguna.

## Informe revisar-pr

~~~text
Informe revisar-pr — T-309 — 2026-10-05 — Ronda 2
Resultado: CON BLOQUEANTES (8)
Checks independientes: inspección estática + contraste con contratos; CI de cierre no inspeccionado.

CERRADOS:
- H01: @axe-core/playwright@4.13.0 declarado y AxeBuilder usado.
- H03: ya no se reutiliza la misma sesión merchant/courier.
- H04: trip seed matched con courier asignado y oferta aceptada.
- H05: tags WCAG 2.0/2.1/2.2 A/AA presentes y contrato explícito.

BLOQUEANTES:
- H02 (parcial) [uploads-a11y.spec.ts:111,127]: getByRole('alert') sin filtrar puede coincidir con next-route-announcer; además role=status muestra el nombre del archivo, no “cargado”, por lo que filter({hasText:/cargado/i}) no puede validar el éxito real.
- H06 (parcial) [uploads-a11y.spec.ts:127-146]: uploadedStoragePath se asigna recién después de varias aserciones post-upload. Si Storage sube el objeto y luego falla status/sessionStorage/parse, finally no conoce el path y deja basura.
- H07 [log/body]: solo está documentado RED real para el contrato de tags. No hay salida reproducible para retry con corte activo, MIME permitido, selector roto ni las 5 mutaciones axe pedidas.
- H08 [log/body/package.json]: el DoD pide pnpm test. La evidencia ejecuta vitest + workflows + ADR por separado; cubre las suites, pero no demuestra el comando exacto exigido por la ficha/prompts.
- H09 [uploads-a11y.spec.ts:190,207,225]: browser.newContext() se crea sin baseURL. Playwright deja baseURL unset en contextos creados así; las navegaciones relativas (/login, rutas de helpers) pueden fallar como URL inválida. También se pierden contextOptions del config.
- H10 [uploads-a11y.spec.ts:133]: JSON.parse(rawDocs!) introduce non-null assertion nueva, prohibida por AGENTS §4.
- H11 [uploads-a11y.spec.ts:39-43; image-compression.ts]: DUMMY_1X1_JPEG no es un JPEG completo: al decodificar Base64 termina en 0x3f10 y no en EOI 0xffd9. La ruta productiva intenta decodificar la imagen antes de Storage, por lo que el caso puede fallar por imagen corrupta y no por corte de red.
- H12 [uploads-a11y.spec.ts:177]: el rechazo del archivo inválido acepta /violates/i; una regresión que rompa RLS podría mantener el test verde por una razón equivocada. Debe probar rechazo por MIME no permitido específicamente.

MEJORAS:
- ninguna; cerrar primero los bloqueantes.

No revisado:
- workflows/CI del SHA 64f5b91 como evidencia de cierre, por existir bloqueantes.
~~~

## Evidencia independiente

### H02 — semántica real del componente
`DocumentUploadCard` calcula:
~~~text
status === success && fileName ? fileName : ...
~~~
Ese texto vive en el elemento `role="status"`. El texto visual “Cargado” está en otro `span` sin ese rol. Por eso:
~~~text
page.getByRole('status').filter({ hasText: /cargado/i })
~~~
no selecciona el estado de éxito.

T-337 además documenta que `getByRole('alert')` sin filtrar también encuentra el `next-route-announcer`.

### H09 — BrowserContext
El proyecto define `baseURL` y `contextOptions` en `playwright.config.ts/use`. Los tres contextos de T-309 se crean manualmente con:
~~~text
browser.newContext()
~~~
sin opciones. Las pages internas usan rutas relativas.

### H11 — fixture JPEG
Probe independiente:
~~~text
Buffer.from(DUMMY_1X1_JPEG, 'base64').subarray(-2).toString('hex')
=> 3f10
~~~
Un JPEG completo termina con marcador EOI `ffd9`. `compressImage` llama a `new Image()` y espera decodificación antes del upload.

### H06 — cleanup no fail-safe
La variable de cleanup queda `null` hasta después de:
1. upload real,
2. espera de `role=status`,
3. lectura de sessionStorage,
4. parse JSON,
5. aserciones de path.

Una falla entre 1 y 5 deja el objeto sin path conocido para el `finally`.

### H07/H08 — evidencia
La bitácora R2 solo registra una salida RED concreta:
~~~text
Demostración RED del contrato de tags: 1 failed al omitir wcag22a/wcag22aa
~~~
Las demás mutaciones se describen como hechas, pero no se conserva salida/fallo exacto.

Para H08 se registran las suites constituyentes por separado; no aparece ejecución de `pnpm test` literal.

## Prompt de arreglo

~~~text
Tarea: T-309, PR #253, rama feat/T-309-uploads-a11y.
Head de implementación revisado: 64f5b9153a5614ba2920e622857db18910137a42.

0. git pull. Sin rebase, amend ni force-push.
1. git fetch origin && git merge origin/develop solo si quedaste detrás.
2. No cambies la ficha ni amplíes alcance. D01/1-A ya está resuelta.

Podés tocar SOLO:
- e2e/specs/uploads-a11y.spec.ts
- docs/tasks/log/T-309.md
- body/comentarios del PR para evidencia
- package.json / pnpm-lock.yaml SOLO si pnpm necesita normalizar la dependencia ya autorizada; no agregues otra.

Prohibido:
- docs/revision-pr/**
- e2e/fixtures/**, e2e/pages/**, src/**, supabase/**, .github/**, .agents/**
- dependencias nuevas
- tests falsos/tautológicos o adulterar datos, mocks o aserciones para conseguir verde
- .skip/.only, retries adicionales, sleeps fijos, subir timeouts o bajar checks
- non-null assertions (!), any, @ts-ignore
- rebase/amend/force-push
- declarar una mutación RED sin pegar la salida real que demuestra dónde falla

1. H09 — NO uses browser.newContext() manual sin opciones.
   Solución preferida: dividir el bloque de accesibilidad en tests separados que usen el fixture page normal de Playwright:
   - login anónimo;
   - crear solicitud merchant;
   - feed + trip + onboarding courier.
   Cada test recibe su page del fixture y por tanto conserva baseURL/contextOptions del proyecto.
   No crees BrowserContext manual.
   Conservá toHaveURL antes de cada axe.
   RED: cambiar temporalmente una ruta canónica por /ruta-inexistente debe fallar la precondición antes de axe.

2. H02 — corregí los locators semánticos.
   - Error: page.getByRole('alert').filter({ hasText: /Error al subir|reintentar/i }); NO getByRole('alert') sin filtro.
   - Éxito: el role=status muestra el nombre del archivo, no “Cargado”. Esperá el path con expect.poll sobre sessionStorage y después verificá role=status con el filename controlado por el test (dni_front.jpg).
   - No uses CSS, id, data-slot ni data-status.
   - RED selector: reemplazar temporalmente /DNI frente/i por un label inexistente debe fallar y pegá la salida.

3. H11 — reemplazá el fixture corrupto.
   Usá un PNG real 2x2 válido:
   const DUMMY_2X2_PNG = Buffer.from(
     'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8//8/AwMDEwMDAwMDAwAkBgMB/DXemwAAAABJRU5ErkJggg==',
     'base64'
   );
   En setInputFiles:
   - name: 'dni_front.png'
   - mimeType: 'image/png'
   - buffer: DUMMY_2X2_PNG
   Ajustá la aserción de storage path para .png/.jpg/.webp.
   Debe llegar realmente al route de Storage: expect(cutIntercepted).toBe(true).

4. H06 — cleanup fail-safe.
   Capturá el path candidato desde la URL del POST real de Storage cuando simulatedCutActive=false, ANTES de route.continue().
   Guardalo en una variable de cleanup aunque luego falle la UI.
   Cuando sessionStorage entregue el path, exigí que coincida con el path capturado de red.
   En finally:
   - remove([pathCapturado])
   - error null
   - listá la carpeta/prefijo con admin y afirmá que el nombre ya no existe.
   Así el cleanup corre incluso si falla la aserción de status/sessionStorage.

5. H10 — eliminá JSON.parse(rawDocs!).
   Patrón:
   if (!rawDocs) throw new Error('[E2E Error] ...');
   const parsedDocs: unknown = JSON.parse(rawDocs);
   Validá forma mínima antes de usar dni_front.
   No any, no non-null assertion, no @ts-ignore.

6. H12 — rechazo de MIME específico.
   La aserción final NO puede aceptar “violates” ni “invalid” genéricos.
   Debe aceptar solo mensajes inequívocos de MIME no permitido, por ejemplo /mime type .*not (allowed|supported)|mime type/i, sin fallback RLS.
   Precondición: path propio correcto courier/<uid>/..., usuario courier autenticado.
   RED obligatorio: cambiá temporalmente filename a .jpg + contentType image/jpeg; debe crear/subir y la expectativa de rechazo debe fallar. Limpiá ese objeto con admin en finally y pegá la salida RED.

7. H07 — completá evidencia RED REAL y pegala en docs/tasks/log/T-309.md:
   - retry: simulatedCutActive=true también en el segundo intento -> falla la expectativa de éxito;
   - selector: label inexistente -> falla el locator;
   - MIME: image/jpeg permitido -> falla la expectativa de rechazo;
   - axe: para CADA superficie (login, crear solicitud, feed, viaje, onboarding), inyectá un img sin alt justo antes de runAxeAudit -> esa auditoría debe fallar por image-alt.
   Hacé las mutaciones de a una, capturá test + mensaje de fallo + exit code, y revertí cada mutación antes de la siguiente.
   NO dejes mutaciones en el commit final.

8. H08 — ejecutá el comando exacto, no equivalentes:
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm exec playwright test e2e/specs/uploads-a11y.spec.ts --project=chromium
   Registrá salida y exit code exactos. El fail-closed local del E2E no sustituye las mutaciones RED.
   El e2e-preview remoto se mira recién cuando la revisión quede sin bloqueantes.

Al terminar:
- docs/tasks/log/T-309.md: hecho / pruebas / falta, con salidas RED reales y checks exactos
- actualizá body sin declarar “resuelto/verificado” por tu cuenta
- commit Conventional Commits + [T-309]
- push
- pegá git ls-remote origin feat/T-309-uploads-a11y
- mantené Draft
~~~
