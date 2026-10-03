# Lecciones — PR #224

## Ronda 1

No se agrega un número AG nuevo. Los hallazgos refuerzan reglas ya existentes:

- **AG-37 — enumerar la clase completa:** el primer fallo del bootstrap de admin no debía cerrar el análisis. Al recorrer DoD 1 completo aparecieron además la precondición `matched` incompleta y el contrato incompatible de `LoginPage.login()`.
- **AG-68 / AG-70 — un RED escrito no prueba que haya ocurrido:** `Expected: true / Received: false` sin mutación ni nombre de test no permite reproducir qué control se puso rojo.
- **AG-71 — develop se vuelve a mirar en cada ronda:** la PR quedó 49 commits detrás y, precisamente, develop incorporó helpers canónicos para admin/MFA y estados de solicitudes que evitan duplicar precondiciones parciales.
- **AG-75 — la batería de mutaciones es de la revisión:** en la ronda de reparación no se considerará verificado un control solo porque el autor lo nombre; se reproducirán sus RED y se agregarán sondas independientes sobre el SHA corregido.
