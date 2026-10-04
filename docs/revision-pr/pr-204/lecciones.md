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

## Ronda 3

No se abre AG nueva.

- Cuando develop avanza sobre el mismo workflow durante una revisión, un CI GREEN del head no basta si el merge ref observable no refleja la base actual; hay que re-sincronizar y revalidar.
- Los informes pegados por CLI deben conservar saltos de línea; concatenar la cabecera rompe el formato literal aunque el contenido semántico esté presente.

## Ronda 4

No se abre AG nueva.

- Un cambio de infraestructura puede volver obsoleta una decisión de bootstrap sin cambiar su intención. T-331 resolvió de forma general el problema que 1-A/3-A habían resuelto de forma específica.
- Un status E2E GREEN solo sirve como evidencia de una tarea si el log demuestra que ejecutó el spec de esa tarea.
- Cuando el gate pasa de lista manual a autodiscovery, las PR viejas deben retirar su personalización local al sincronizar para no reintroducir el antipatrón.

## Ronda 5

No se abre AG nueva.

- T-331 permitió por fin verificar T-305 en remoto pre-merge: un GREEN útil requiere que el log nombre el spec y sus casos, no solo el status.
- Drift de base no debe bloquear mecánicamente si es irrelevante; en esta ronda sí es material porque T-334 modifica exactamente la capa de auth/guards que T-305 cubre.
- Cuando los rojos de CI pertenecen al baseline y sus fixes ya están en develop, no se corrigen desde la tarea atrasada: se integra la base y se revalida.

## Ronda 6

No se abre AG nueva.

- La evidencia funcional debe anclarse al último SHA que cambió código/tests; commits posteriores solo documentales no invalidan un E2E remoto ya ejecutado sobre el mismo árbol funcional.
- Un retry exitoso no borra una flake: si el síntoma pertenece a infraestructura compartida, se separa en un issue propio (#250) en vez de inflar el alcance de la tarea revisada.
- Un baseline rojo puede convivir con “SIN BLOQUEANTES” de una PR si se demuestra que no fue introducido por la PR y se documenta con precisión; no se lo maquilla como GREEN.
