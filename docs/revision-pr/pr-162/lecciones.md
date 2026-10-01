# Lecciones — PR #162 / T-320

## Ronda 1

No se agrega numeración AG nueva.

- **H01 / P08:** una llamada no demuestra una postcondición; en Auth hay que observar tanto `{ error }` como rechazo de Promise.
- **H02 / P07:** no clasificar semántica por texto libre del proveedor cuando existe una señal estructurada.
- **H03 / P06 + AG-37:** si la ficha enumera percent-encoding, esa representación debe aparecer en la batería.
- **H04 / P13:** una pantalla nueva debe reutilizar el patrón accesible existente para foco, target táctil y semántica.

## Ronda 2

- H01 confirma que `toHaveBeenCalledWith` no alcanza si la API devuelve un resultado con error.
- H02 queda protegido por un contraejemplo cuyo mensaje contiene “session” pero cuyo código no representa falta de sesión.
- H03 fija la propiedad en la frontera HTTP real mediante `NextRequest`.
- H04 observa solo el contrato mínimo accesible y evita snapshots frágiles.
- La divergencia histórica con `develop` no invalida por sí sola una verificación: los 3 commits nuevos solo modifican documentación de T-319.
- No se agrega numeración AG nueva.
