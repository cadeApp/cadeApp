# Lecciones — PR #295 · R4

- **AG-37:** una refactorización de tests que parece inocua (dynamic import→static import) puede violar la frontera feature→app. Ejecución CI real detectó la regresión; no confiar en lint declarado por la bitácora.
- **AG-63:** un test del happy path de lazy-loading no demuestra recuperación ante rechazo. Un botón «Reintentar» es una promesa funcional y debe tener control discriminante que falle si vuelve a renderizar un Lazy rechazado.
- **AG-68 / AG-70:** no declarar que un test prueba el CSS standalone cuando se ignora una excepción CDP o se admite aserción condicional que omite el wrapper; bitácora local != CI remoto.
- **Decisión P1 B:** permitir un cambio arquitectónico más amplio exige demostrar beneficios vs complejidad; el reexport directo de push elimina el await interpuesto, pero el presupuesto debe revalidarse en build real. No imponer opción más conservadora sin comparar.
- **Pruebas del gesto:** bandera booleana + queueMicrotask es un unit test útil de orden, pero no reemplaza pruebas de click real y restricciones del navegador.
