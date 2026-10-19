# Prompt detallado para agy — PR #427 — Ronda 1

Regularizá el alcance antes de mergear. Usá una tarea cuya ficha en `develop` autorice explícitamente `.github/workflows/e2e-staging.yml`, o incorporá esa autorización mediante el flujo separado aprobado para ampliar alcance.

Conservá el cambio funcional exactamente en `timeout-minutes: 20` → `45`. No modifiques comandos de Playwright, cobertura, aserciones, specs, triggers, proyectos ni workers. No agregues `.skip`, `.only`, retries o mocks. Actualizá la referencia de tarea/PR según corresponda y pedí una nueva revisión independiente sobre el nuevo HEAD.

No edites estos archivos de revisión. No merges la PR mientras PR427-H01 siga abierto.
