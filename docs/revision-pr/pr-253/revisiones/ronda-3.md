# Ronda 3 — PR #253 (T-309) — Revisión independiente

- SHA revisado: `d7b7f40a80d8619ad126df6369ddaa8e45f9ad10`
- develop: `6e2da8fb02d4797b9add222206342e6055f1d81c`
- Fecha: 2026-10-06
- PR: Draft, mergeable.
- Diff contra develop: 11 archivos, limitados a T-309 + `docs/revision-pr/pr-253/**`.
- Rama: 19 commits delante y 2 detrás de develop.
- Decisiones pendientes: ninguna.

## Informe revisar-pr

~~~text
Informe revisar-pr — T-309 — 2026-10-06 — Ronda 3
Resultado: CON BLOQUEANTES (2)
Checks independientes: inspección estática + probes de fixture; CI de cierre no inspeccionado.

CERRADOS EN R3:
- H02: alert filtrado por copy semántico; success observado por sessionStorage + role=status con filename real.
- H06: el path se captura desde el POST de Storage antes de continue(); finally elimina y verifica ausencia.
- H09: se eliminaron browser.newContext() manuales; las pruebas usan fixture page y conservan baseURL/contextOptions.
- H10: no queda non-null assertion; JSON se trata como unknown y se valida.
- H11: el fixture PNG 2x2 es decodificable y válido; la prueba exige cutIntercepted=true.
- H12: el rechazo exige mensaje MIME; ya no acepta violates/invalid genéricos.

SIGUEN BLOQUEANTES:
- H07 [docs/tasks/log/T-309.md, sesión 2026-10-06 19:22]: la evidencia RED sigue incompleta. Hay salida concreta para tags 2.2, una mutación axe solo en login y una precondición URL. Faltan retry con corte activo, selector inexistente, MIME permitido y demostración image-alt para crear solicitud, feed, viaje y onboarding.
- H08 [docs/tasks/log/T-309.md; PR body]: el comando exacto pnpm test ya se ejecutó, pero terminó exit 1. La ficha exige pnpm typecheck && pnpm lint && pnpm test como DoD. El body lo marca [x] pese al exit 1. En develop actual cc007.test.ts ya aísla sus mutaciones en un git worktree temporal; la rama está 2 commits detrás, por lo que debe mergear develop y repetir pnpm test sin procesos/mutaciones paralelos.

MEJORAS:
- ninguna.

No revisado:
- CI exact-head / e2e-preview como evidencia de cierre, porque H07/H08 siguen abiertos.
~~~

## Revalidación de R2

### H02
El alert ahora está filtrado:
~~~text
page.getByRole('alert').filter({ hasText: /Error al subir|reintentar/i })
~~~
El éxito espera el path en sessionStorage y luego busca `role=status` por `dni_front.png`, que coincide con la semántica real de `DocumentUploadCard`.

### H06
La ruta captura `capturedStoragePath` antes de `route.continue()`. El `finally`:
1. borra con admin;
2. exige `removeError === null`;
3. lista el folder;
4. exige ausencia del filename.

El cleanup ya no depende de que las aserciones UI posteriores terminen bien.

### H09/H10/H11/H12
- no quedan `browser.newContext()` manuales;
- no queda `rawDocs!`;
- el PNG Base64 abre como PNG RGB 2×2 y carga correctamente;
- la regex del error ya exige MIME.

## H07 — evidencia que falta

La bitácora conserva:
- RED de tags 2.2;
- RED `image-alt` solo en login;
- RED de `toHaveURL(/ruta-inexistente/)`.

Pero el prompt R2 exigía explícitamente:
- retry con el corte todavía activo;
- selector accesible inexistente;
- MIME permitido;
- `image-alt` en las cinco superficies.

Como los casos dependientes de staging fallan localmente por el guard fail-closed, esta evidencia debe obtenerse en `e2e-preview`, sin dejar las mutaciones en el head final.

## H08 — pnpm test

Bitácora:
~~~text
pnpm test -> exit 1
117 test files passed / 2 failed
~~~

El DoD no pide “equivalente serial”; pide el comando exacto.

En `develop` actual, `src/server/rpc/cc007.test.ts` ya crea un `git worktree --detach` temporal para las mutaciones y explica que así evita contaminar tests paralelos. La rama revisada está 2 commits detrás de ese develop. Sin tocar archivos fuera de T-309, debe sincronizarse y repetir `pnpm test`.

## Prompt de arreglo

~~~text
Tarea: T-309, PR #253, rama feat/T-309-uploads-a11y.
Head funcional revisado: d7b7f40a80d8619ad126df6369ddaa8e45f9ad10.
Ronda 3: solo quedan H07 y H08. No hay decisiones para Lautaro.

0. git pull.
1. git fetch origin && git merge origin/develop. La rama estaba 2 commits detrás. Sin rebase, amend ni force-push.
2. Después del merge, confirmá que el diff contra develop sigue limitado a:
   - e2e/specs/uploads-a11y.spec.ts
   - docs/tasks/T-309.md
   - docs/tasks/log/T-309.md
   - package.json
   - pnpm-lock.yaml
   - docs/revision-pr/pr-253/** (NO tocar; pertenece a revisión)

Archivos que podés modificar en el resultado final:
- e2e/specs/uploads-a11y.spec.ts
- docs/tasks/log/T-309.md
- body/comentarios de la PR
- package.json/pnpm-lock.yaml solo si el merge de develop necesita resolverlos conservando únicamente @axe-core/playwright@4.13.0 como cambio propio de T-309.

Prohibido:
- tocar docs/revision-pr/**
- arreglar cc007, vitest.config.ts u otros archivos fuera de ficha desde T-309
- tests falsos/tautológicos o adulterar mocks/aserciones para verde
- .skip/.only, retries nuevos, sleeps fijos, timeouts mayores
- rebase/amend/force-push
- dejar una mutación RED en el head final

A. H08 — cerrar primero pnpm test.
1. Con working tree limpio y SIN ninguna mutación RED activa ni otro pnpm/vitest corriendo:
   pnpm typecheck
   pnpm lint
   pnpm test
2. pnpm test DEBE terminar exit 0.
3. Si sigue exit 1 después de mergear develop:
   - NO cambies archivos fuera de T-309;
   - pegá en la bitácora test file, error, exit code y SHA;
   - detenete. No marques el DoD como cumplido.
4. Si exit 0, registrá la salida exacta. Recién ahí el checkbox de ese DoD puede quedar [x].

B. H07 — hacer la evidencia RED en Preview sin multiplicar ocho runs.
Primero, en el código FINAL, dividí el test actual
  "axe AA en feed, viaje y onboarding (repartidor)"
en TRES tests independientes:
- axe AA en lista del repartidor
- axe AA en viaje
- axe AA en onboarding
Cada uno usa fixture page normal, su login/precondición propia y su runAxeAudit. No compartas page entre tests.
Resultado final esperado: 8 tests en uploads-a11y.spec.ts:
1 contrato tags
2 upload retry
3 MIME inválido
4 login axe
5 crear solicitud axe
6 feed axe
7 viaje axe
8 onboarding axe

Esto permite demostrar las 5 superficies axe en un solo run de mutación.

C. Mutación remota M1 — retry + MIME + las cinco superficies axe.
Sobre el código final anterior, hacé TEMPORALMENTE y en el mismo commit:
1. Retry: no desactives el corte antes del segundo setInputFiles; simulatedCutActive debe seguir true.
2. MIME: en el test inválido usá temporalmente filename .jpg y contentType image/jpeg.
3. Axe: justo antes de runAxeAudit en CADA uno de los 5 tests (login, crear solicitud, feed, viaje, onboarding), inyectá:
   await page.evaluate(() => {
     const img = document.createElement('img');
     img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
     document.body.appendChild(img);
   });
4. Commit temporal:
   test(e2e): prove T-309 RED retry mime and axe surfaces [T-309]
5. Push y esperá e2e-preview.
6. El run debe demostrar, como fallos independientes:
   - upload retry no alcanza success;
   - MIME permitido hace fallar la expectativa de rechazo;
   - login -> image-alt;
   - crear solicitud -> image-alt;
   - feed -> image-alt;
   - viaje -> image-alt;
   - onboarding -> image-alt.
7. Guardá en docs/tasks/log/T-309.md:
   - SHA temporal;
   - run/job;
   - nombre de cada test fallido;
   - mensaje/violación relevante;
   - exit/failure del job.
8. Revertí ese commit con:
   git revert --no-edit <SHA_MUTACION_M1>
   git push
No uses reset, rebase, amend ni force.

D. Mutación remota M2 — selector accesible.
1. TEMPORALMENTE cambiá:
   page.getByLabel(/DNI frente/i)
   por:
   page.getByLabel(/selector-inexistente-t309/i)
2. Commit temporal:
   test(e2e): prove T-309 RED accessible selector [T-309]
3. Push y esperá e2e-preview.
4. El test de upload debe fallar en el locator accesible antes del upload.
5. Registrá SHA + run/job + nombre del test + error exacto en bitácora.
6. Revertí:
   git revert --no-edit <SHA_MUTACION_M2>
   git push

E. Final limpio.
1. Confirmá que NO queda ninguna mutación:
   git diff origin/develop...HEAD -- e2e/specs/uploads-a11y.spec.ts
2. Corré otra vez:
   pnpm typecheck
   pnpm lint
   pnpm test
3. Todos exit 0.
4. Ejecutá localmente el spec; el fail-closed local está permitido y debe documentarse como tal, no como RED:
   pnpm exec playwright test e2e/specs/uploads-a11y.spec.ts --project=chromium
5. Esperá el e2e-preview FINAL del head limpio; debe quedar GREEN.
6. Actualizá body:
   - primer DoD [x] solo con e2e-preview final GREEN;
   - pnpm test [x] solo con exit 0;
   - no digas “verificado por revisión”.
7. Bitácora: hecho / pruebas / falta, incluyendo los dos runs RED y el run GREEN final.
8. Commit de documentación si hace falta, push y:
   git ls-remote origin feat/T-309-uploads-a11y
9. Mantené Draft para Ronda 4.
~~~
