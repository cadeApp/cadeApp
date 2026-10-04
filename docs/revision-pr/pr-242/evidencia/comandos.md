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
