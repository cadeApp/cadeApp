# Lecciones — PR #370 / ronda 1

No se enumeran nuevos hallazgos de implementación ni se asigna un nuevo número AG: esta ronda revisó una detención de trabajo correcta y un único archivo de bitácora, no código nuevo. El bloqueo contractual no se atribuye como defecto al autor.

## Patrones ya documentados a vigilar al retomar

- **AG-74** (pr-68): guarda condicional de expiración debe volver a validar `status` y `expires_at` bajo lock; auditoría y efectos solo desde filas realmente cambiadas.
- **AG-37** (pr-56): enumerar toda la clase afectada (estados, actores, tablas, RPC, paginaciones) antes de dar la corrección por buena.
- **AG-75** (pr-68): la batería de mutaciones es del revisor, no del autor.
- **P08**: tests que inspeccionan strings SQL o mocks sin ejecutar un caso real no prueban permisos/transacciones.

Criterio para ronda 2: ningún hallazgo puede darse como `arreglado-verificado` solo por la declaración de Kira o por checks verdes. Exigir ensayo que falle por la propiedad comprobada, prueba sin mutar y verificación en SHA publicado.
