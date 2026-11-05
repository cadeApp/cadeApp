# Lecciones — PR #612 / T-422

## Patrón observado

La configuración pública de una integración real puede estar estructuralmente presente en un workflow, pero seguir **vacía** y pasar el build porque el esquema la admite opcional. El test nuevo garantiza que la expresión `vars.*` no se sustituya por una clave falsa, pero todavía no exige un diagnóstico temprano de configuración incompleta (H01). La ficha también conserva una premisa anterior ya contradicha por el diff (H02).

Esto es una nueva instancia de **P08-control-no-cubre-lo-que-dice** y **P03-comentario-contradice-codigo**; no se propone un número AG nuevo con tan poca evidencia adicional. Se reutilizan las lecciones sobre pruebas de controles y mutaciones independientes (pr-64/AG-61, pr-68/AG-75).

## Cambio concreto recomendable

Cuando un gate necesite un valor de configuración pública para funcionar, comprobar en el mismo runner que ese valor **no está vacío** antes de compilar o iniciar el E2E, y exigir en `verify-workflows` que exista la guarda y que corte en rojo. Un control textual de que `vars.NOMBRE` aparece no prueba que `vars.NOMBRE` esté configurada. No imprimir valores al fallar.

Cada decisión P1 que reemplaza una premisa de la ficha debe actualizar ficha, runbook y bitácora en una misma corrección, sin que el autor escriba ni certifique la carpeta `docs/revision-pr/`.

## Alcance y reservas

- No atribuir a la aplicación un `RefererNotAllowedMapError` no visto: es una condición futura para activar la alternativa B aceptada por Lautaro073.
- No convertir la falta de E2E previo al merge en afirmación de fallo: `workflow_run` usa el archivo de `develop`.
- No requerir un nuevo CI GREEN por una corrección exclusivamente de bitácora/documentación; para una corrección efectiva del YAML, sí corresponde verificar el control RED→GREEN y el CI de código.
- No declarar «arreglado-verificado» hasta que otra sesión compruebe un nuevo SHA.


## Ronda 2 — verificación (2026-11-05)

Los hallazgos H01 y H02 se verificaron en `4dfca216` mediante inspección estructural independiente con nueve mutaciones propias (pr-68/AG-75) y cruce documental, sin que el agente editara la carpeta de revisión (pr-56/AG-36). No surgió un nuevo patrón que justifique numerar otra regla AG.

El límite de inferencia más importante: conservar las guardas y que `verify-workflows` pase no demuestra que Google autorice la clave desde `localhost:3100`; ese riesgo solo se resuelve con el gate real y la decisión D01.
