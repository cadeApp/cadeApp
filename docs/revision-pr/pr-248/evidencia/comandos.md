# Evidencia y comandos reproducibles — PR #248

## Ronda 1

Base:

    59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3

SHA funcional:

    0638339d0b4a7027e17fba51310d93005d99cf1d

SHA revisado:

    752707bf5cc885d14924d01eb281d0313406298f

GitHub compare:

    ahead_by: 3
    behind_by: 0
    mergeable: true

## Estado de deploy

SHA funcional `0638339d0b4a7027e17fba51310d93005d99cf1d`:

    Vercel: success
    Preview: cadeapp-develop-git-feat-t-336-retorno-home-real-lautaroj073.vercel.app
    e2e-preview: pending al momento de la revisión

HEAD documental `752707bf5cc885d14924d01eb281d0313406298f`:

    Vercel: failure
    motivo: api-deployments-free-per-day

El failure del HEAD no cambia el código funcional; la verificación manual puede ejecutarse sobre el Preview Ready del SHA funcional.

## Reproducción H01

Agregar una tabla de casos reales sobre `evaluateRouteGuard`:

    admin AAL1 + /merchant/dashboard -> MFA /admin/applicants
    admin AAL2 + /merchant/dashboard -> /admin/applicants
    admin AAL1 + /courier/feed -> MFA /admin/applicants
    admin AAL2 + /courier/feed -> /admin/applicants
    admin AAL1/AAL2 + alias /requests o /feed -> mismo home real

Mutación temporal esperada:

    reemplazar uno de esos fallbacks por getRoleDefaultPath('admin')

La tabla debe quedar RED.

## Reproducción H02

El control nuevo debe fallar, como mínimo, con fuentes sintéticas:

    router.push('/')
    router.replace('/')
    redirect('/')
    return { redirectTo: '/' }

También debe fallar si un archivo allowlisteado agrega una segunda ocurrencia root no documentada.

Caso de RegExp stateful a proteger:

    sourceA contiene href="/" a offset alto
    sourceB contiene href="/" cerca del inicio

Ambas ocurrencias deben detectarse de forma independiente.

## H03

Eliminar tests tautológicos que solo construyen:

    '<Link href="/">...'
    const mutatedGuard = () => redirectTo '/'

La evidencia de mutación real vive en la bitácora y los tests permanentes deben depender de producción/helper real.

## H04

Preview Ready del SHA funcional:
- 404 anónimo -> /login;
- merchant completo/incompleto -> home correspondiente;
- courier completo/incompleto -> home correspondiente;
- admin AAL1/AAL2 -> MFA/home;
- viewport 360 px, sin overflow, targets >=48.

Registrar SHA, cuentas de prueba no sensibles y resultados. No persistir credenciales.


## Ronda 2

### CI SHA funcional f09b0088c44f33f767a2912901b956f1a65986ca

    run 37181655067
    Test Files 118 passed (118)
    Tests      1875 passed (1875)
    DB probe   Files=1, Tests=10, PASS
    DB suite   Files=18, Tests=1811, PASS
    /courier/feed    159 kB
    /courier/profile 178 kB

### E2E Preview

    run 37181721851
    TARGET_SHA=f09b0088c44f33f767a2912901b956f1a65986ca
    Chromium: 20 passed
    global-settings: 1 flaky, 2 passed
    RESULT=success

Flaky T-306 registrado en issue #249.

### Preview independiente

El revisor consultó directamente:

    https://cadeapp-develop-i68p3wept-lautaroj073.vercel.app/not-found-page-test-360

y verificó que el HTML real contiene:

    Página no encontrada
    href="/login"
    Ir al inicio

### Residual H02

El scanner actual detecta directos, pero estas formas no producen ocurrencia:

    const target = '/';
    router.push(target);

    const home = () => '/';
    router.replace(home());

El cierre requiere seguir estos productores indirectos simples.


## Ronda 3 final

SHA funcional final:

    76d174027202db06c3e06c7da6f8b53b7b98e2d4

Diff desde R2 reviewer commit:

    src/app/route-integrity.test.ts
    docs/tasks/log/T-336.md

CI exact-head:

    run 37184391888
    Test Files 118 passed (118)
    Tests      1879 passed (1879)
    DB probe   Files=1, Tests=10, PASS
    DB suite   Files=18, Tests=1811, PASS
    lint       PASS
    typecheck  PASS
    build      PASS
    bundle     PASS
    /courier/feed    159 kB
    /courier/profile 178 kB

Mutación indirecta registrada:

    const __t336Probe = '/';
    router.push(__t336Probe);

Resultado esperado y observado:

    PR248-H02 integrity test -> RED
    occurrence kind: router.push
    match: router.push(__t336Probe)

Tras restaurar:

    route-integrity.test.ts -> 66/66 GREEN

Vercel del SHA final:
- failure por `api-deployments-free-per-day`;
- no requiere revalidación visual porque R3 no modifica runtime/producto.


## Ronda 4 — validación manual que reabre H04

Origen informado:

    http://localhost:3000

Resultado:

    login courier -> /courier/feed
    404 -> visible
    Ir al inicio href=/login
    click -> /login   # FAIL, esperado /courier/feed

Anónimo:

    404 -> /login     # PASS

Diagnóstico requerido:

    misma page + mismo browser context
    inspeccionar solo cookie names/domain/path, nunca valores
    comparar antes de 404 / después de 404 / después de click
    si click queda en /login, hard navigate /login sin reloguear

Regresión E2E requerida:

    loginAsCourier()
    page.goto('/t336-404-session-regression')
    click 'Ir al inicio'
    expect pathname === '/courier/feed'
