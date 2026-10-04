# Evidencia reproducible — PR #242

## Ronda 4

HEAD:

    c14fead12f0e42ecf42216b1de9b8ea2f3546907

SHA funcional combinado:

    ef40e47e8c5c6f7bd7b9850fc40fa88e626e67b3

Base:

    develop@3e5d5381dbf59717763f1927e1cf080504a9ebf1

GitHub compare:

    status: ahead
    ahead_by: 12
    behind_by: 0
    mergeable: true

### H05

Árbol combinado conserva:

    onboardingComplete: courier.vehicle_type !== null
    licenseStatus: courier_documents[license].status ?? none
    insuranceStatus: courier_documents[insurance].status ?? none
    "Completá tu registro"
    "Continuar registro"
    "Notificaciones"
    /legal/terms
    /legal/privacy
    /legal/courier

Mutaciones registradas por el autor:

    onboardingComplete=true -> 1 failed | 4 passed
    badge incompleto roto   -> 1 failed | 1 passed | 59 filtered
    restaurado              -> 90 passed

CI #1094 HEAD actual:

    Test Files 118 passed (118)
    Tests      1835 passed (1835)
    lint       success
    typecheck  success
    build      success
    bundle     success
    /courier/feed    159 kB
    /courier/profile 178 kB

DB seguía en ejecución al cerrar R4.

### H06

No existen:

    src/features/courier-onboarding/evidence/T-325/360-07-profile-documents.jpg
    src/features/courier-onboarding/evidence/T-325/360-08-profile-settings.jpg

Vercel:

    ef40e47 -> failure: api-deployments-free-per-day
    633aace -> failure: api-deployments-free-per-day
    c14fead -> failure: api-deployments-free-per-day

No hay Preview combinado ni e2e-preview para cerrar H06.

Cuando se libere la cuota:
- reintentar deployment del HEAD actual;
- abrir /courier/profile a 360 px;
- capturar documentos y ajustes;
- verificar 3 destinos legales y overflow;
- registrar evidencia y solicitar ronda final.


## Ronda 5 final

SHA verificado:

    6c68e2feb1b2cf9ed2528efae9a9ac2cfef6e7b0

CI:

    run 37171385728
    Test Files 118 passed (118)
    Tests      1835 passed (1835)
    DB probe   Files=1, Tests=10, Result=PASS
    DB suite   Files=17, Tests=1807, Result=PASS
    /courier/feed    159 kB
    /courier/profile 178 kB

Preview:

    Vercel      success
    e2e-preview success
    run 37171444673
    Chromium        20 passed
    global-settings 3 passed
    TARGET_SHA=6c68e2feb1b2cf9ed2528efae9a9ac2cfef6e7b0
    RESULT=success

Evidencia manual inspeccionada por el revisor:
- /courier/profile, viewport interior 360 px, documentos en En revisión;
- /courier/profile, viewport interior 360 px, Notificaciones + 3 links legales;
- Lautaro073 confirmó apertura correcta de /legal/terms, /legal/privacy y /legal/courier;
- sin overflow horizontal visible.

Los archivos exportados de screenshot incluyen marco de DevTools y por eso sus dimensiones exteriores exceden 360 px. No se alteraron para aparentar otra medida.
