# Lecciones — PR #179 / T-304

## Ronda 1

No se crea un AG nuevo en esta ronda.

Se refuerzan patrones ya conocidos:

- **P08:** el nombre del runner no demuestra el alcance del control. Un archivo bajo `e2e/specs` ejecutado por Playwright puede seguir siendo una prueba puramente de dominio.
- **AG-76:** una aserción negativa contra una abstracción puede quedar verde aunque la implementación real que debía proteger esté rota.
- **AG-88:** comprobar que una función devuelve el estado esperado no equivale a demostrar que la fuente real fue consultada/persistida.
- **P19:** el body libre no sustituye el template obligatorio ni el informe literal de `revisar-pr`.

La discrepancia “admin — solo por incidente” muestra por qué el E2E debe atravesar la fuente de verdad: la matriz pura y los pgTAP existentes aceptaban una precondición menos estricta que la escrita en §5.1.

## Ronda 2

No se crea un AG nuevo.

Se refuerzan:

- **P08:** un mock de Supabase no valida FKs ni orden relacional. Un seed puede pasar 52 unitarios y ser imposible en PostgreSQL real.
- **P15:** “el spec existe” no equivale a “el gate lo ejecuta”. Todo E2E nuevo debe quedar incluido explícitamente en Preview/Staging y producir status para el SHA exacto.
- **P03:** un E2E debe derivar los códigos de error de la precedencia contractual real; no de una interpretación del estado.
- **P06:** cubrir una fila de §5.1 incluye sus precondiciones y efectos, no solo comprobar el status final.

La existencia de Supabase Develop + Vercel Preview elimina el motivo para cerrar T-304 sin una corrida real del spec.

## Ronda 3

No se crea un AG nuevo.

Se refuerzan patrones existentes:

- **P08:** un cleanup mockeado puede parecer correcto y aun violar el orden FK real cuando aparecen entidades nuevas como `incidents`.
- **P03:** los helpers E2E también deben respetar contratos de bootstrap; crear `role=admin` contradice directamente `handle_new_user`.
- **P08 / oráculos:** un fallback silencioso no es evidencia de que se consultó la fuente de verdad.
- **P03 / capas:** observar solo la RPC de DB no permite concluir que una responsabilidad de aplicación no existe. `cancel_request` sí dispara push en `callRequestRpc`.
- **P06:** un negativo no termina en comprobar el error; cuando importa atomicidad, también debe comprobar ausencia del efecto persistido.

La corrida remota fue valiosa precisamente porque encontró fallos que 1692 unitarios verdes no podían representar: constraints reales, trigger de signup y teardown sobre datos persistidos.

## Ronda 4

No se agrega AG nuevo.

- **H16/H18** repiten **pr-82/AG-76** y `P08-control-no-cubre-lo-que-dice`: consultar una tabla no demuestra que el dato llegue al control, y `[]` no distingue ausencia real de fallo de fuente.
- **H17** aplica **pr-82/AG-97**: un log append-only conserva el conocimiento histórico y corrige hacia adelante.
- **H03** refuerza la regla ya explícita de mutación: cambiar el `expect` no rompe la propiedad protegida; cambia el instrumento de medida.
- H16 es también un agujero de la propia Ronda 3: pedir `incidents.length === 0` sin revisar primero si el helper fallaba cerrado dejó una vía de falso verde. La R4 corrige esa omisión.

## Ronda 5

No se agrega AG nuevo.

- H03 quedó cerrado aplicando la regla ya existente: la mutación cambia la propiedad/dato test-owned, nunca el `expect`.
- H16/H18 confirman **pr-82/AG-76**: los negativos solo son útiles cuando la fuente falla cerrado y el test afirma la acción positiva que transporta el dato.
- H17 confirma **pr-82/AG-97**: la corrección documental se hace hacia adelante, no reescribiendo el pasado.
- El audit rojo es un buen ejemplo de por qué el color global del workflow no basta: todos los jobs de T-304 están verdes y el único fallo proviene de un lockfile idéntico a develop.
