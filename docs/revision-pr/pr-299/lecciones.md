# Lecciones — PR #299 / T-339

Ronda 1 sobre `6fbde29f48cc502ff497d18c4488fcd442246bf6`. Hay **9 bloqueantes** y **1 mejora**. No asigno un AG nuevo sin comprobar el máximo global de todas las ramas; refuerzo patrones existentes, con referencias por carpeta.

## Patrón dominante

La PR afirma «implementación completa» y «concurrencia cubierta», pero el CI del mismo SHA tiene dos fallos reales y el pgTAP nuevo no contiene operaciones concurrentes. Una prueba que comprueba una respuesta aislada no verifica las garantías del contrato que requieren dos transacciones.

- **AG-37 (pr-56): enumerar la clase entera.** En una RPC transaccional revisar creación, aceptación, retiro, cancelación, reintentos y locks de **todas** las rutas que comparten filas, no solo `take_request`.
- **AG-62 (pr-64) / AG-68 (pr-63): un test secuencial no prueba concurrencia ni una prueba mal planteada verifica su descripción.** H05 y H07 requieren oráculo de dos sesiones y precondición probada, respectivamente.
- **AG-35 (pr-56): comprender la semántica de pgTAP.** Además del mensaje SQLSTATE, cuadrar `plan(N)` con aserciones realmente invocadas y comprobar RED sobre la propiedad.
- **AG-74 (pr-68): guards y locks.** La revalidación después de lock debe proteger todos los efectos posteriores; fijarse en otras funciones (`accept_offer`) que toman oferta antes de solicitud.
- **AG-36 (pr-56): autorrevisión ≠ revisión independiente.** No basta con la sección «Informe de revisión de agy» escrita por el autor.

## Criterios de control propuestos

1. Para migraciones largas: compilar/aplicar íntegramente en CI, no solo revisar SQL; un error de variable hace irrelevantes los tests que nunca corrieron (H01).
2. La prueba de «rate limit agotado» debe afirmar explícitamente la precondición de agotamiento antes de probar la precedencia, y cada intento válido debe tener recurso distinto (H07).
3. La prueba E2E del formulario debe utilizar el formulario real y verificar el payload persistido; un seeder no reemplaza la transición que se está entregando (H08).
4. Con un helper de match que modifica ofertas hermanas, comparar todas las rutas de lock, incluidas aceptaciones paralelas (H02).

No modificar `AGENTS.md` por una sola PR. Priorizar nuevo control objetivo y revalidación independiente en la próxima ronda.

