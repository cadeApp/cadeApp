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
