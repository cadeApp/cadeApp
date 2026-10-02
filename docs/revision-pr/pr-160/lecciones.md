# Lecciones — PR #160

## Rondas 1-4

Se mantienen los patrones documentados P08, P04, P06, P03, P19, P16, P10 y P01.

## Ronda 5

No se abre AG nuevo.

- **Gate de merge ≠ gate de cierre para E2E:** P1 aclaró que una PR de un spec E2E puede quedar lista para `develop` con revisión estática + CI de la rama, mientras la verificación real contra staging ocurre después de la promoción. La tarea no se marca Hecha hasta esa corrida.
- **El smoke de staging no sustituye el spec de la tarea:** `e2e-staging.yml` actual solo ejecuta T-301/smoke. Para T-303 hay que ejecutar explícitamente `main-flow.spec.ts` después de la promoción.
- **P10 sigue siendo operativo, no necesariamente culpa del autor:** Kira sincronizó correctamente, pero `develop` avanzó durante la ronda. El control debe mirar ahead/behind inmediatamente antes de aprobar.

### Decisiones P1 vigentes

- Ronda 1 — 1-A: ampliación mínima del arnés T-303.
- Ronda 4 — 1-B: sin mutación RED local de la guarda SQL; la prueba real se sustituye por ejecución en staging.
- Ronda 5 — criterio de proceso: T-303 se considera terminada solo después de `develop → staging` y E2E real verde.
