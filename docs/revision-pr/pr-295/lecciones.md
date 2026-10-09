# Lecciones — PR #295 · R4

- **AG-37:** una refactorización de tests que parece inocua (dynamic import→static import) puede violar la frontera feature→app. Ejecución CI real detectó la regresión; no confiar en lint declarado por la bitácora.
- **AG-63:** un test del happy path de lazy-loading no demuestra recuperación ante rechazo. Un botón «Reintentar» es una promesa funcional y debe tener control discriminante que falle si vuelve a renderizar un Lazy rechazado.
- **AG-68 / AG-70:** no declarar que un test prueba el CSS standalone cuando se ignora una excepción CDP o se admite aserción condicional que omite el wrapper; bitácora local != CI remoto.
- **Decisión P1 B:** permitir un cambio arquitectónico más amplio exige demostrar beneficios vs complejidad; el reexport directo de push elimina el await interpuesto, pero el presupuesto debe revalidarse en build real. No imponer opción más conservadora sin comparar.
- **Pruebas del gesto:** bandera booleana + queueMicrotask es un unit test útil de orden, pero no reemplaza pruebas de click real y restricciones del navegador.
- **R5 / PR295-R02 — falsos verdes por test que repara código de producción:** un E2E que inyecta `display:none !important` no verifica que el CSS real del producto oculte landing. Reto RED: mutar solo CSS productivo y exigir que el test falle. Priorizar observación nativa del navegador.
- **R5 / P1 A03:** un test JSDOM con `navigator.userActivation` falso prueba orden, no activación real. E2E aislado en Playwright es más mantenible que mezclar Push con standalone, pero debe visitar consumidor auténtico y explicar límites del permiso headless.
- **R5 / separación de calidad y gate manual:** pruebas Android físicas por P1 ocurren tras CI/E2E y revisión sin bloqueantes; no bloquean la emisión de informe técnico ni se deben invocar en cada ronda.
- **R6 / R03:** un comando de emulación CDP aceptado no asegura media query display-mode real. Probar la precondición nativa y, si falla, investigar contexto realmente instalado antes de cambiar DoD/CI.
- **R6 / H12:** E2E debe cotejar copy de código fuente; fallar por string no existente no demuestra falla funcional.
- **R6 / H13:** test data: con sleep es un control del navegador pero no mutación de código productivo; no registrarlo como RED de la tarea. Eliminar sleeps y probar mutaciones reales temporales.
