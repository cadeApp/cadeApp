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


## Ronda 5

H09 muestra una distinción útil para P08/AG-61: **reconocer más sintaxis no equivale a seguir el origen real del destino**. El scanner ya entiende template literals directos, pero las rutas también nacen en arrays de configuración, helpers y resultados de actions. Una prueba que promete “cualquier ruta interna inexistente” debe cubrir esos productores o bajar explícitamente su promesa.

R04/H20 sí demuestran un cierre más robusto: los tests nuevos atacan el umbral exacto que rompía la semántica (501/51) y verifican el filtro activo antes del límite.


## Ronda 6 — cierre

H09 finalmente quedó cerrado cuando el control dejó de pensar sólo en “formas sintácticas de un link” y empezó a seguir **productores de destinos**: configuración de nav, helpers y variables/resultados de actions. La mutación útil no era otra cadena concreta, sino agregar un destino nuevo por un camino indirecto que antes el scanner no observaba.

El cierre también deja una distinción operativa importante: un warning de CI no es automáticamente un bloqueante. En este repo Prettier, audit de dependencias y bundle budget están configurados explícitamente como advisory. Deben quedar visibles como deuda/mejora, pero no reinterpretarse como DoD bloqueante de una tarea que no fijó esos umbrales.


## Ronda 7 — optimizar sin cambiar la semántica

El cierre de R6 fue correcto para ese SHA, pero una optimización posterior introdujo dos regresiones aun con CI verde.

- **R05:** copiar una regla de validación para evitar cargar Zod no es tree-shaking: es crear otra fuente de verdad. Peor, la copia ya nació distinta. Un presupuesto de bundle nunca justifica separar la validación de cliente de la validación de la Server Action.
- **R06:** lazy-load de UI auxiliar (toast/dialog) es válido sólo si su fallo queda aislado. Cuando `import(notify)` participa del mismo `Promise.all` o `try` que una mutación, una falla de chunk puede cambiar el rollback, dejar estado local viejo o transformar un éxito real en un error.
- **H21:** `approval-policy` verde no prueba que el informe sea del head actual; sólo valida que exista texto con la forma esperada. Después de cualquier commit semántico, la evidencia del body debe refrescarse.

Lección general: **performance es una propiedad adicional, no una licencia para debilitar contratos o control de flujo**.


## Ronda 8 — cierre después de optimizar

R8 valida la corrección de las dos regresiones creadas por performance:

- **R05:** la manera robusta de conservar semántica fue volver a una sola fuente de verdad. El ahorro de bundle seguía cumpliéndose incluso importando el schema compartido desde un componente ya diferido; no hacía falta copiar reglas.
- **R06:** un módulo de feedback puede ser lazy, pero su fallo debe quedar fuera del camino crítico. Las pruebas útiles simulan precisamente el fallo del chunk y comprueban el estado observable posterior a la mutación.
- **H21:** cuando hay un commit semántico después de una ronda verde, la evidencia del body tiene que renovarse contra ese SHA. Un commit posterior exclusivamente de revisión no invalida esa evidencia porque no cambia implementación.

La PR termina con una lección clara: **optimizar bundle sin degradar contratos, UX ni trazabilidad exige probar los fallos de la propia optimización, no sólo medir kilobytes**.
