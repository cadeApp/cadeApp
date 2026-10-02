# Lecciones — PR #204

## Ronda 1

No se abre numeración AG nueva.

- H01 aplica un contrato ya conocido: service-role no reemplaza identidad/AAL del actor.
- H02/H03 refuerzan P08: un rojo fabricado cambiando el expected no demuestra sensibilidad y un spec que ningún gate ejecuta no protege el DoD.
- H03 tiene origen en la ficha; P1 resolvió el caso concreto ampliando T-305 solo a `e2e-preview.yml`.
- H04 se barrió como clase completa: son dos `getByText` y se corrigen juntos.
- H05 repite P19: el body no puede certificar evidencia que la bitácora todavía declara faltante.

## Ronda 2

No se abre numeración AG nueva.

- Un helper de login no implica cambio de identidad: si se reutiliza el mismo `Page`, primero hay que considerar cookies/sesión y las propias guardas de `/login`. H06 es P01, no una falla de Playwright.
- El rollback de un PR debe apuntar al cambio funcional o al commit de merge/squash; usar “HEAD actual” es peligroso cuando el último commit es solo documentación.
- Cuando develop convierte un gate en una lista dinámica de specs, las descripciones del status deben mantenerse genéricas para no quedar obsoletas al agregar el siguiente spec.
