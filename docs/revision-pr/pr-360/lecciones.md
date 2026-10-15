# Lecciones PR #360

Ronda 2: las correcciones H01/H03/H04/H06 son consistentes por inspección; H02 evidencia que `router.refresh()` no constituye bloqueo sincrónico de acciones con props viejas.

- P08: `expect(mockRefresh).toHaveBeenCalled()` no prueba que los botones Aceptar desaparezcan durante la carrera.
- P01: el oráculo de DB puede adelantarse a la navegación SPA; seleccionar `winnerPage` requiere espera observable, no un ternario inmediato por URL.
- AG-36: GREEN de CI no reproduce los RED previos, y autor no puede certificar `verificado_en_sha`.

**Corrección del propio revisor:** la batería de ronda 1 usaba un ancla `result.request.status` que no existe después de `const { request } = result`; se habría reportado SIN OBJETIVO. Esta es falla del instrumento, no del autor. La ronda 2 corrige esa ancla; sin ejecución no afirma mutaciones verificadas.

No se asignan lecciones AG-xx nuevas sin relevar la numeración de todas las ramas.
