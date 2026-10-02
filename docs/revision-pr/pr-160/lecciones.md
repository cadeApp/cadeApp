# Lecciones — PR #160

## Rondas 1-3

Se mantienen los patrones documentados P08, P04, P06, P03, P19, P16, P10 y P01.

## Ronda 4

No se abre AG nuevo.

- **P01-contrato-de-framework-no-verificado:** crear un `BrowserContext` manual no equivale a usar la fixture `context`; opciones como `baseURL` deben propagarse explícitamente.
- **P08-control-no-cubre-lo-que-dice:** para privacidad, comparar solo el string original no alcanza si el producto puede formatear el dato antes de mostrarlo. Conviene normalizar ambos lados a una representación canónica.
- **P19-cuerpo-de-pr-fuera-de-template:** pegar una salida roja y mantener el checkbox compuesto en verde sigue siendo evidencia contradictoria.
- **P10-desvio-de-ficha-sin-consultar:** incluso una rama recién sincronizada puede quedar atrás durante rondas largas; cada ronda debe volver a comprobar ahead/behind.

### Decisión P1

La mutación RED local de la guarda SQL queda dispensada para T-303. La sustitución aceptada es una corrida real de staging/CI con el oráculo fuerte ya implementado.
