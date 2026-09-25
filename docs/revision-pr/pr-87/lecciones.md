# Lecciones de la PR #87 para AGENTS.md y las reglas

**Fuente:** 12 hallazgos de R1 + 7 registros nuevos en R2 + 5 hallazgos nuevos en R3 + 2 hallazgos nuevos en R4.

## Patrón dominante

R2 confirma el patrón de R1: controles basados en presencia de archivos/strings pueden quedar verdes mientras el comportamiento real contradice contratos. Los ejemplos más fuertes son enums de DB incompatibles, error boundaries que existen pero nunca reciben el error, y un footer fuera del array auditado que conserva enlaces rotos y text-xs.

El segundo patrón es de coordinación: un arreglo que necesitaba contrato UI ignoró el freno de contract-change y modificó directamente \`src/ui/**\`.

## Lecciones propuestas

No hace falta inventar una AG nueva todavía; refuerzan reglas existentes:
- AG-37 / P06: enumerar la clase completa, no una lista de ejemplos.
- AG-58 / AG-61 / P08: el test debe ejercer el contrato real, no buscar strings.
- AG-36: evidencia sólo desde SHA publicado.
- P10: si la ficha y una decisión posterior del dueño divergen, registrar la excepción en ficha/bitácora/PR para que la revisión pueda distinguir una autorización real de una autoampliación.

## Qué cambiar, en orden de impacto

1. Agregar un control de alcance por ficha (globs permitidos) y un lugar explícito para excepciones autorizadas por el dueño antes de declarar DoD.
2. Para queries nuevas, testear enums/tipos contra el contrato real y fallos de Supabase, no sólo source matching.
3. Toda paginación nueva debe traer prueba 51+/segunda página/filtro+cursor y verificar que no altera consumidores compartidos.
4. La evidencia visual debe existir en el PR real; un archivo Markdown local no sustituye body/capturas.

## Advertencias

- A01/A02 fueron resueltos por decisión explícita de P1; la lección es documentar esa excepción, no revertirla ni reemplazarla con deep imports.
- H15 sugiere que la evidencia “typecheck verde” del autor no puede tomarse como independiente hasta reejecutarla.


## Ronda 3

R3 vuelve a mostrar el mismo patrón dominante, ahora con dos ejemplos muy medibles.

- **P08 / AG-61:** ampliar el scan a “todo el alcance” no sirve si la propiedad que se comprueba sigue siendo una blacklist. El helper de rutas conoce cuatro strings, por eso una ruta arbitraria inexistente sigue pasando; de hecho el código real conserva exactamente ese defecto en `resolvePostLoginRedirect`.
- **AG-66 reincide:** `paid_until` es un `date` civil y el test lo transformó en timestamp. Eso hizo verde una prueba que no representa el dato real; el probe con `TZ=America/Argentina/Buenos_Aires` muestra el corrimiento al día anterior.
- **Arreglar un límite no habilita quitar el límite:** R02 dejó de truncar métricas a 50, pero la solución fue una lista sin paginar. La prueba de 60 filas mide exactitud y no el presupuesto/contrato de lectura.
- **La referencia vinculante también es contrato:** C07 quedó con tabs y paginación correctas, pero el set “Todas” y los campos de cada fila no fueron enumerados contra el README (cadete + monto). Es otra forma de AG-37.
- **Evidencia visual:** escribir “verificado en /browser” no crea el entregable. El DoD pide adjuntos; el PR tiene cero imágenes.

No hace falta proponer un AG nuevo: H16/H19 refuerzan AG-66 y H01/H09/R03 vuelven a reforzar AG-37/AG-61.


## Ronda 4

R4 vuelve a mostrar dos formas del mismo patrón de controles incompletos:

- **H09 / P08:** cambiar una blacklist por un resolutor de filesystem no basta si el extractor sigue leyendo sólo strings literales. El producto usa links dinámicos con template literals; la mutación del prefijo debe entrar al control.
- **R04 / AG-61:** “cada query está acotada a 50” y “el resultado total es exacto” son propiedades distintas. El test midió la primera y el arreglo rompió la segunda con `MAX_METRICS_BATCHES=10` y `slice(0,50)`.
- **H20 / AG-37:** separar C07 de C02 corrigió el historial pero no enumeró el conjunto visible de C02. La referencia dice “solicitudes activas”; la query conserva “all”.
- **H10:** el entregable visual debe compararse contra la matriz exacta, no contra “una muestra por familia”. Tener 23 PNG no cubre C05/R02/R05, y una referencia mal nombrada (P04 legal como forgot-password) da falsa trazabilidad.

No hace falta una AG nueva; son refuerzos de AG-37/AG-61 y del criterio de evidencia ejecutable.
