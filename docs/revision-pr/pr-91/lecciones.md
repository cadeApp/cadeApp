# Lecciones — PR #91 / T-203

## Resultado

No se agrega un número AG nuevo en esta ronda. Los agujeros encontrados ya están cubiertos por lecciones existentes y conviene reforzarlas antes de sumar otra regla:

- **pr-56/AG-37:** enumerar la clase completa. Aplica a las 5 variantes de payload y a las clases de status HTTP.
- **pr-83/AG-79:** privacidad con sentinelas y frontera real, no con una blacklist o una muestra parcial.
- **pr-83/AG-80:** un rojo de import/setup no valida la propiedad que el test dice proteger.
- **pr-83/AG-84:** la procedencia/integración de un dato o efecto se prueba en la frontera real que lo obtiene/ejecuta; un helper aislado no prueba el call site.
- **pr-83/AG-82:** la ficha vinculante se lee desde `develop`; la rama no puede fabricar su propio alcance.
- **pr-63/AG-68:** la evidencia declarada debe existir y reproducirse, no inferirse desde lo que se esperaba ver.

## Patrón dominante

Vuelve `P08-control-no-cubre-lo-que-dice`: el test arranca después de la frontera riesgosa (`WebPushTransport`), la transición post-commit existe solo dentro del test, y los nombres de dos tests describen matrices más grandes que sus datos reales.

También reaparece el problema de especificación: la regla 25 decidió `web-push (T-203)` y el fallo del Juez exige call sites fuera de `src/server/push/**`, pero la ficha oficial no incorporó esos archivos/dependencia. La corrección debe hacerse en la fuente oficial (`develop`), no en la rama que está siendo evaluada.
