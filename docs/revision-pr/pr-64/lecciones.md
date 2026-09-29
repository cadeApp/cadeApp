# Lecciones de la PR #64 (T-102) para `AGENTS.md` y las reglas

**Fuente:** 8 registros en dos rondas, los 8 cerrados y verificados. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

**El invariante que le da nombre a la tarea es el único que no tiene control.** `T-102` se llama «`accept_offer`
atómica e idempotente» y su DoD abre con «10 llamadas concurrentes → una sola ganadora». La atomicidad está bien
implementada —lock de fila sobre `delivery_requests`, re-lectura bajo READ COMMITTED, cascada en la misma
transacción— y las tres piezas que dicen verificarla no la verifican: dos pruebas secuenciales disfrazadas de
carrera y una aserción estática que pasa aunque se saque el lock.

Es `P08-control-no-cubre-lo-que-dice` otra vez, y por segunda PR seguida el mecanismo es el mismo: **el control
mide un proxy barato del invariante en vez del invariante.** En la #62 fue comparar *conjuntos* de códigos en
lugar del *orden*; acá es contar *llamadas* en lugar de *concurrencia*, y buscar *la palabra* `for update` en
lugar de *la cláusula en su sentencia*.

---

## `AG-61` · Un comodín que cruza sentencias convierte una aserción por tabla en una aserción por archivo

**Origen:** `H01`

```ts
expect(body).toMatch(/from\s+public\.delivery_requests[\s\S]*?for\s+update/i);
expect(body).toMatch(/from\s+public\.offers[\s\S]*?for\s+update/i);
```

Leídas de a una, dicen «cada una de estas tablas se lee con `FOR UPDATE`». Lo que afirman de verdad es «en algún
punto después del nombre de esta tabla aparece un `for update`», y como `[\s\S]*?` no se detiene en el `;`, las
dos se satisfacen con **un solo** `for update` en cualquier parte del cuerpo. Mutando la migración: sacar el lock
de `offers` deja las tres en verde; sacar el de `delivery_requests`, también. Recién fallan si se sacan los dos.

Es pariente de `AG-58` de la #62 —«una aserción de texto sobre un archivo con N funciones prueba como mucho una
de las N»— un nivel más abajo: allá el comodín cruzaba funciones, acá cruza sentencias dentro de una función. El
autor ya aplicó `AG-58` en esta misma PR (el test 8 separa por bloque de función); lo que faltaba era el
siguiente corte.

> **Regla propuesta.** Una aserción de texto sobre SQL se ancla a la **unidad que nombra**. Si la aserción dice
> «esta tabla se lee con `FOR UPDATE`», el patrón no puede poder saltar el separador de sentencias: se usa
> `[^;]*?` en vez de `[\s\S]*?`, o se parte el cuerpo por `;` y se busca dentro de la sentencia. Y cuando el
> orden importa —un orden de locks es una defensa contra deadlocks— se afirma el orden comparando índices, no la
> mera presencia.
>
> **Y toda aserción estática se muta antes de darla por buena:** se rompe a propósito la propiedad que dice
> cuidar y se comprueba que se pone roja. Cuesta un minuto y es la única diferencia entre un control y un
> adorno. Las tres de esta PR se escribieron sin ese paso y dos de las tres son ciegas.

## `AG-62` · Un invariante que la infraestructura de pruebas no puede ejercer necesita un control estructural, no una prueba que se le parezca

**Origen:** `H02`, `D01`

pgTAP corre en una sesión y una transacción: **no puede** montar una carrera real sin `dblink` o `pg_background`.
Vitest contra un fake síncrono tampoco: `Promise.all` arranca diez promesas pero cada handler corre entero sin
ceder el event loop. Las dos pruebas de esta PR están bien escritas y prueban algo cierto —competencia
secuencial e idempotencia—, y ninguna puede fallar por una razón de concurrencia.

El problema no es que existan: es que ocupan el lugar del control que falta y tildan el ítem del DoD. Con las dos
en verde, quitar el `FOR UPDATE` de `delivery_requests` no rompe nada. Es la segunda vez que pasa en esta serie:
en T-101 el mismo ítem terminó en la decisión `D04`, reformularlo.

> **Regla propuesta.** Cuando un ítem del DoD enuncia un invariante que la infraestructura disponible no puede
> ejercer, hay dos salidas honestas y una trampa. Las salidas: **(a)** montar la infraestructura y ejercerlo de
> verdad, o **(b)** reformular el ítem para que diga lo que sí se demuestra y **sustituir el invariante por un
> control estructural** sobre el mecanismo que lo garantiza — acá, que el lock exista, sobre la tabla correcta y
> en el orden correcto. La trampa es dejar una prueba que se le parece y tildar el ítem.
>
> Si se elige (b), el control estructural pasa a ser lo único que protege el invariante, así que es exactamente
> el que hay que mutar (`AG-61`).

---

## Advertencias

- **`AG-62` ganó su caso en la ronda 2.** La apuesta era: si el arreglo de `D01` dejaba el control estructural
  sano y mutado, la lección quedaba demostrada y no solo argumentada. Eso pasó — el DoD nombra el mecanismo y el
  mecanismo tiene un control que detecta las tres regresiones (`AG-63`). Las dos lecciones se leen juntas.
- **Nada de esto toca el diseño, que es bueno.** La parte difícil —serializar sin deadlocks, la idempotencia con
  `matchedAt` preservado, la cascada en una transacción, y cerrar `PR56-H21` con algo *más* restrictivo que lo
  que pedía la ficha— está bien resuelta. Los tres bloqueantes son de control y de contrato, no de lógica.
- **`H03` es de otra familia** y vale anotarlo por separado: no es un control flojo, es una escritura que no
  ocurre. Lo notable es que la regla estaba escrita por el mismo autor, un día antes, en la migración de T-101 que
  ya está en develop. Una regla aprendida en una tarea no viaja sola a la siguiente si no queda en un control; es
  el mismo argumento de `no-podar-reglas-por-silencio` visto desde el otro lado.

## Lo que dice el dato entre PRs

`P08-control-no-cubre-lo-que-dice` aparece **tres veces en esta sola ronda** (`H01`, `H02`, `H05`) y viene de
encadenar con la #62, donde fue la causa de `H10` y de `H14`. Es candidato firme a regla en `AGENTS.md` con el
criterio del README —2 o más PRs distintas con el mismo patrón—, y la forma concreta que conviene escribir no es
«probá mejor» sino la de `AG-61`: **mutá el control antes de confiar en él**.

El reparto de `origen` sigue la tendencia: 5 de 6 hallazgos son `agente` y uno solo es `ambos` (`H02`, donde la
ficha enuncia un invariante en prosa sin control que lo haga cumplir, igual que en T-101). Las fichas siguen sin
ser la fuente de los problemas.

---

## `AG-63` · Una mutación que queda escrita en el test deja de ser un acto de revisión y pasa a ser un control

**Origen:** la ronda 2, y no la propuse yo.

`AG-61` pide mutar el control antes de confiar en él. Eso es un acto puntual: lo hace quien revisa, una vez, y
después no queda nada. El arreglo de `H01` fue un paso más allá y dejó la mutación **dentro del test**:

```ts
const m1WithoutOffersLock = body.replace(offerLockRegex, (stmt) => stmt.replace(/for\s+update\s*;/i, ';'));
expect(m1WithoutOffersLock).not.toMatch(offerLockRegex);
```

Leído rápido parece un adorno: mutar el texto y comprobar que el regex ya no matchea suena a tautología. No lo
es, y lo que lo demuestra es la mutación que le hice yo al control: **si alguien afloja el regex al comodín viejo
`[\s\S]*?`, esa misma aserción se pone roja.** Con el comodín, el `replace` deja de ser específico —arrastra el
`for update` de otra sentencia— y el `not.toMatch` falla.

O sea que la aserción no protege el código: **protege el control que protege el código.** Es el único mecanismo
que vi hasta ahora que impide que una aserción se degrade en silencio, que es precisamente cómo nacieron `H01`,
`AG-58` y la mitad de los `P08` del catálogo.

> **Regla propuesta.** Cuando un control es una aserción de texto sobre código —SQL, una migración, un
> workflow—, la mutación que lo valida se escribe **al lado, en el mismo test**: se rompe a propósito la
> propiedad en una copia en memoria y se afirma que el control la detecta. Cuesta tres líneas, corre en cada CI,
> y hace que debilitar el control sea un test rojo en vez de un cambio que nadie nota.
>
> Es el complemento de `AG-61`: aquella dice *mutá antes de confiar*; esta dice *dejá la mutación escrita para
> no tener que volver a confiar*.

## Advertencia para T-103, que está en curso

`H03` —una escritura antes de un `raise`, que la excepción revierte— nació de que la regla estaba escrita por el
mismo autor un día antes, en T-101, y no viajó. **T-103 tiene «expiración perezosa» en su DoD** (plan §8) y se
está trabajando ahora. Si la implementa con `update` + `raise`, es `H03` otra vez, y esta vez sobre la tarea que
*posee* el ciclo de vida de la solicitud. Conviene mirarlo en la ronda 1 de esa PR, no en la tercera.

El barrido es de una línea y ya está en `evidencia/comandos.md`: buscar `update public.<tabla>` seguido de
`raise exception` sin un `exception when` en el medio.
