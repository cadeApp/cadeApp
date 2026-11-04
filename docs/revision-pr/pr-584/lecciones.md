# Lecciones — PR #584 / T-402 — ronda 1

## Patrones observados

**PR584-H01 (P08):** un E2E que demuestra navegación en 390 px no demuestra el cambio de modo responsive en el umbral de lg. Es una aplicación de P08-control-no-cubre-lo-que-dice, no una categoría nueva. La prueba que falta debe ejercitar ambos lados del breakpoint y la geometría del contenido, y fallar ante lg:hidden→md:hidden.

**PR584-H02 (P15):** imágenes declaradas como generadas fuera del repositorio no equivalen a adjuntos publicados en la PR. El DoD incluye el acto de entrega, y cuando las imágenes pueden contener datos personales se necesita revisión y publicación humana controlada.

## Reglas existentes suficientes

No se asigna AG nuevo en ronda 1. Los principios 8 y 40 ya exigen mutaciones RED reales; P08 ya explica la debilidad de un proxy, y P15 cubre un entregable que no puede reproducirse/consultarse. Se documentan los casos concretos para la ronda 2 sin reclamar un número global no verificado contra todas las ramas remotas.

## Mejora de proceso para siguientes PR

En cambios responsive, listar puntos justo debajo, en y por encima de cada breakpoint relevante; comparar no solo visibilidad sino ancho útil, foco, rutas y acciones críticas. Cuando una entrega incluye evidencias fuera de Git, declarar un paso humano verificable antes de considerar satisfecho el DoD.

## Límites de esta ronda

La batería estructural de cuatro mutaciones corre por lectura de clases y no sustituye Playwright. No se verificó el CI ni un servidor local de la PR. No se llama arreglado-verificado a un cambio que el autor anunció pero aún no subió.


---

## Ronda 2

- **H01 / P08:** el autor añadió el borde de \`lg\`, geometría de main, iconos, nombre y Salir sin tocar producción ni debilitar 390 px. No amerita un AG nuevo, aplica P08 y regla 40.
- **Mutaciones CSS:** ante imposibilidad de compilar local, probar estilos computados mediante CSS en Preview puede validar sensibilidad de aserciones, pero no equivale a un commit TSX mutado; conservar script completo facilitaría reproducir. No calificar RED del autor como comprobación independiente.
- **H02 / P15:** generar capturas y adjuntarlas son tareas distintas; si contienen datos sensibles hay que publicar solo copias revisadas.
- La verificación independiente real de E2E y CI sigue pendiente; no exigir un CI nuevo por commit que solo toca docs/revision-pr.


---

## Ronda 3

- **H01/P08 cerrado por CI independiente:** la revisión verificó en el log de e2e-preview el checkout exacto de `4a265745` y los dos casos de admin-nav-mobile en verde, evitando confundir `repository_dispatch.head_sha` de develop con la rama efectivamente testeada.
- **H02/P15 cerrado por evidencia real:** se inspeccionaron las 15 capturas, tamaños y contenido; la publicación en el repositorio fue expresamente autorizada, no un cambio unilateral del agente. El texto histórico «DNI Hash: Pendiente» no contiene valores de hash, aunque T-401 lo elimina al integrar.
- **H03/P15 pendiente:** una rama con CI verde puede quedar inmergeable cuando develop acepta otra tarea que toca la misma feature. La revisión de cierre debe volver a consultar mergeabilidad y las diferencias de la base, no fiarse del CI anterior. T-401 y T-402 agregan código en la misma región de queries.test; el merge debe conservar ambas suites y no reintroducir DNI hash.
- **QA separado:** un E2E heredado que pasa recién en retry #2 no debe esconderse detrás del color verde; se abrió [#585](https://github.com/cadeApp/cadeApp/issues/585) sin atribuir causalidad a T-402.
- **Presupuesto advisory:** se compararon rutas contra el build base, no el color del job; los 263 kB en varias rutas son preexistentes y el delta de esta tarea fue 0 kB. Aplica AG-92, no se agrega regla nueva.

Sin lección AG numerada nueva en esta ronda.
