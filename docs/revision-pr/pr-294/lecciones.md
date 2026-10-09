# Lecciones de la PR #294

**Fuente:** 2 bloqueantes, 1 decisión aceptada y 1 mejora.

## H01

Separar `trusted/` de `target/` no equivale a aislar ejecución. Si un workflow con secretos ejecuta scripts/build/tests de un checkout no mergeado en el mismo runner, ese código tiene acceso potencial a los secretos.

## H02

`secrets` solo a nivel step y excluir `.env*` no garantizan artifacts limpios si stdout/stderr o reportes producidos por procesos con secretos se persisten directamente.

La corrección debe tener una prueba con canario que inspeccione la evidencia persistida.

## Decisión

Lautaro073 eligió reducir T-347 a `target=develop` únicamente, suficiente para la validación post-merge requerida.
