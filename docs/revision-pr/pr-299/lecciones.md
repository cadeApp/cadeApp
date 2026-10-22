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

## Ronda 2 (2026-10-08)

- **AG-37, refuerzo (H11/H12):** revisar contra la función canónica completa al sobrescribir `CREATE OR REPLACE FUNCTION`; un cambio de `now()` a `clock_timestamp()` y un movimiento de una guarda provocaron 7 fallos del contrato antiguo y fueron omitidos en R1.
- **AG-68 / AG-70, refuerzo (H13):** `plan(45)` puede coincidir con 45 aserciones y seguir sin correr ninguna: una zona inválida en INSERT abortó la transacción del fixture. El control correcto es el log pgTAP que termina con PASS, además del conteo.
- **AG-62, refuerzo (H05):** rotular una prueba como «carrera» no crea concurrencia: el autor declara mutación RED de lock, pero el SQL usa un único cliente y llamada secuencial, incapaz de detectar el interleaving. Esto confirma la ausencia de prueba, sin especular sobre intención.
- **Disciplina de revisión:** H11–H13 no aparecieron por las correcciones recientes; ya estaban en R1. Reconocer el agujero propio y registrar el hallazgo nuevo ahora, sin culpar erróneamente al arreglo.

No proponer número AG nuevo sin verificar el máximo de todas las ramas.

## Ronda 3 — 2026-10-08

- **pr-63/AG-68 / H14:** test de «cero efectos» que lee bajo rol sin consentimiento puede pasar por enmascaramiento de RLS. Leer postcondiciones como inspector autorizado y comprobar que una mutación de datos se detecta.
- **pr-64/AG-62 / H15:** fixture de segunda oferta no debe sembrar estados artificiales imposibles después de matched. Construir con RPC pública antes del match y comprobar rechazo posterior.
- **pr-63/AG-68 / H16:** E2E cuyo nombre dice «consentimiento denegado» sin llamar RPC sería verde incluso sin gate; eliminar o crear actor con estado real y ejecutar operación + oráculo.
- **H05:** Vercel verde no significa Playwright ejecutado: el gate e2e-preview bloquea por migración y requiere coordinación del dueño, no relajar políticas por el agente.

## Ronda 4 — 2026-10-08

- **pr-63/AG-68, refuerzo:** el arreglo de H14 dejó de contar como usuario oculto por RLS y pasó pgTAP REAL; no bastaba el detector del agente, el job de DB completo es la evidencia definitiva.
- **pr-64/AG-62, refuerzo:** H15 fue solucionado creando la segunda oferta con la RPC pública ANTES de aceptar y comprobando ambos estados. Ya no hay fixture artificial ni bypass RLS.
- **pr-63/AG-68, refuerzo:** H16 correctamente se eliminó, en vez de conservar test «CC-007» que no hacía RPC. La validación autorizada se concentra en pgTAP + futura integración real.
- **CI ambiental compartido:** una vulnerabilidad crítica publicada después del último green puede convertir el mismo lockfile en `audit` rojo sin cambios del autor. Antes de generar un hallazgo culpando al PR, comparar HEAD develop y buscar corrección upstream: issue #311 / PR #312 resueltos; problema actual es **rama 11 commits atrás**, no que T-339 introduzca dependencia.
- **Excepción E2E:** registrar dónde corre REALMENTE la prueba tras migración. `migrate-develop` se ejecuta en push develop, pero `e2e-preview` requiere PR abierta sin migración; no prometer ejecución automática por haber mergeado.

