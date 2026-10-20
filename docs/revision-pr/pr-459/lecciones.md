# Lecciones — PR #459 / T-382 · Ronda 1

**Fuente:** PR459-H01, H02 y H03 (por inspección; sin repro Vitest independiente). No se asigna un nuevo identificador AG mientras no se compruebe el máximo vigente de *todas* las ramas remotas. No modifica `AGENTS.md`.

## P08 · El test protege el camino feliz pero no una falla parcial

H01: el flujo de baja tiene **dos operaciones** (navegador y backend) y solo se probó que las dos tuvieran éxito. Al fallar la segunda, la UI siguió prometiendo algo que ya no era cierto. Regla candidata para la 2ª PR del patrón: toda operación multi-paso necesita tests en cada corte, persistencia del estado intermedio y reintento después de remontar la vista.

H03: un test que comprueba «no se filtra el endpoint» con `Error.message` inocuo no detecta si se imprime directamente un mensaje que *sí* contiene secretos. Inyectar explícitamente valores sensibles en el texto de la excepción y afirmar que **ninguna** llamada a log los contiene.

## P06 · Enumerar la fase completa, no solo la operación central

H02: `pushManager.subscribe()` está cubierto; `serviceWorker.ready` y `pushManager.getSubscription()`, ejecutados antes, no lo están. Listar las etapas que pueden rechazar y clasificarlas de acuerdo con su origen sin convertir errores del navegador en errores de backend.

## Propuestas para la siguiente revisión

- Revisión independiente: comprobar RED por comportamiento faltante, GREEN restaurado y nueva mutación propia de la revisión que ataque directamente el arreglo del autor, sin aceptar sus harness como prueba independiente.
- La decisión autorizada de Lautaro073 (H01-C y H03-B) debe quedar en la bitácora de implementación para trazabilidad.
- No agregar una regla global por esta PR sola; contrastar recurrencia con el histórico antes de asignar AG y mover a `AGENTS.md`.

## Ronda 2 — Lecciones adicionales

- **H04 / P06:** no condicionar una operación remota pendiente a las capacidades nativas que originalmente la crearon. Probar ausencia de PushManager, fallos de ready/getSubscription, permiso denegado y presencia/ausencia de endpoint pendiente.
- **H03 / P08:** al sanear un objeto de log, cubrir **todos** los campos dinámicos, incluido `Error.name`, no solo `Error.message`; tests de campos contaminados por separado.
- No asignar `AG` sin verificar el máximo histórico de ramas ni modificar `AGENTS.md` por una PR aislada.
