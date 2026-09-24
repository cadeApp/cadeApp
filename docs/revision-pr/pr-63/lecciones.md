# Lecciones — PR #63 (T-103)

Numeración continua del proyecto. `AG-01`…`AG-63` están en las carpetas de las PRs anteriores.

**Fuente:** 12 registros en la ronda 1 (7 bloqueantes, 3 decisiones, 2 mejoras) y 6 más en la ronda 2 (5 bloqueantes contando los parciales, 1 desvío aceptado, 1 mejora). Datos crudos en
[`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

**`P08-control-no-cubre-lo-que-dice`, por tercera PR seguida, y esta vez medido.** La matriz de pgTAP es buena:
afirma el estado persistido de cada celda, y por eso la mutación que deja `mark_picked_up` sin cambiar el estado
la pone roja. Pero el DoD no es «el estado de cada transición», es **cada fila de la tabla §5.1**, y cada fila trae
efectos. De trece mutaciones sobre `request_cycle`, **diez pasan con las 1.153 aserciones en verde**. En la #62 el
control medía conjuntos en vez de orden; en la #64, llamadas en vez de concurrencia; acá mide el estado en vez de
los efectos. Siempre es el mismo mecanismo: el control mide el proxy barato del invariante.

---

## `AG-64` · La expiración perezosa tiene dos caras: rechazar lo vencido y habilitar lo que solo se puede hacer con lo vencido

**Origen:** `H02`

La regla 30 dice «toda RPC trata `expires_at < now()` como expirada», y la lectura natural es defensiva: no
aceptar ofertas sobre algo vencido, no cancelar algo vencido. T-103 la aplicó así, bien, y con un control. Pero
`republish_request` es una transición que **solo existe** para lo vencido, y para ella la regla significa lo
contrario: **permitir**. Validarla contra el estado persistido deja al comercio esperando al cron, que en Vercel
Hobby corre una vez por día.

> **Regla propuesta.** Una RPC con expiración perezosa calcula el **estado efectivo** una sola vez al principio
> (`published` con `expires_at` vencido ⇒ `expired`) y valida todas sus transiciones contra ese estado, las que
> rechazan y las que habilitan. La prueba de expiración perezosa tiene dos filas por RPC: la que rechaza y, si la
> RPC acepta `expired` como origen, la que habilita sin barrido previo.

## `AG-65` · Un texto libre se clasifica por la fila más visible a la que puede llegar, no por el estado donde se escribe

**Origen:** `H03`. Propone el patrón `P22-texto-libre-en-columna-de-visibilidad-amplia` para el catálogo del
README del directorio (no lo toco desde esta carpeta: lo agrega quien mantiene el catálogo).

`cancel_reason` suena a columna de solicitudes canceladas, que solo ven el comercio y el admin. Pero el bloque
compartido la escribe también en las transiciones que **devuelven la solicitud a `published`**, y una publicada
la lee cualquier repartidor aprobado, fila entera. El autor sabía que el texto era sensible —lo sacó a propósito
del `audit_log`— y aun así terminó en la columna más visible del esquema.

> **Regla propuesta.** Antes de escribir texto libre en una columna, se enumeran **todos los estados en que la fila
> puede quedar después de esa escritura** y la policy de `select` más amplia de cada uno. Si alguno es visible a
> actores sin relación, el texto va a otra tabla con su propia policy. Es `AG-32` (la matriz de RLS por operación)
> visto desde la escritura.

## `AG-66` · Un comentario que promete una propiedad de privacidad es una prueba que falta

**Origen:** `H09`, y `H03` como contraste

`:194` dice «los motivos libres y datos privados nunca van al audit log». Es cierto hoy. Pero el único guardián
es la frase: agregar `p_reason` al `after` deja la suite en verde. Y la zona que ese comentario cuida es
exactamente la que `D02` va a tocar.

> **Regla propuesta.** Cuando un comentario en SQL afirma algo sobre datos privados —«nunca va a X», «solo IDs»—,
> esa frase se convierte en una aserción negativa en la misma PR y se muta una vez para verla roja. Si no se puede
> probar, el comentario dice por qué. Un comentario de privacidad sin prueba es la forma más barata de `P08`.

## `AG-67` · Una ronda que no deja carpeta commiteada se pierde entera, incluida la evidencia

**Origen:** esta revisión (lección sobre la revisión, no sobre el código)

El borrador de esta ronda existía solo como texto en otra sesión. Tenía conclusiones correctas, pero sus
catorce mutaciones, sus diecinueve sondas y sus comandos no quedaron en ningún lado: hubo que rehacerlos. Al
rehacerlos corriendo (y no leyendo) aparecieron un conteo distinto (`D01`: 14 de 15, no 13), tres efectos ciegos
que la tabla de `H06` no tenía, y un hallazgo nuevo (`H09`). Nada de eso invalida el borrador; muestra que sin
evidencia escrita no había cómo saber qué estaba medido y qué supuesto.

> **Regla propuesta.** Ya está escrita en `COMO-ENTREGAR.md` («commitear al cerrar cada ronda») y se repite en la
> consigna de la revisión. Lo que agrega este caso: **la evidencia se escribe mientras se corre, no al final**,
> porque es lo primero que se pierde. Y una ronda que afirma cosas «leídas en el SQL» cuando se puede correr la
> base tiene que decir por qué no la corrió.

---

## Ronda 2

### `AG-68` · Nombrar una aserción por la mutación que debe matar no prueba que la mate

**Origen:** `H10`

La ronda 1 dejó una tabla de mutaciones (M02 a M12), y la ronda 2 trajo una aserción por fila, nombrada con el
ID de cada mutación. Ocho matan a su mutación. Dos, «M06a» y «M06b», no pueden: la fixture ya siembra el valor
que la RPC produce, y dentro de una transacción `now()` no se mueve. Nadie corrió M06 contra ellas; si alguien lo
hubiera hecho, en un minuto habría visto 1.196 en verde.

> **Regla propuesta.** Cuando una revisión entrega una mutación junto con el hallazgo, el arreglo no está hecho
> hasta que esa mutación se corrió contra la prueba nueva y se vio roja, y el rojo quedó en la bitácora. Una
> aserción que el estado inicial ya satisface es la forma más común de que no pase: antes de afirmar un efecto, se
> siembra un valor distinto del que el código va a escribir.

### `AG-69` · Un arreglo que abre una transición nueva hereda todas las obligaciones de prueba de una transición

**Origen:** `H11`, `H12`

Los dos arreglos más grandes de la ronda crearon cosas que antes no existían: `H02` abrió «publicada vencida →
publicada», y `D02` agregó una tabla con RLS. Las dos están bien construidas y las dos llegaron sin la prueba que
su propia clase exige: los efectos de la transición (`H06`) y la matriz de RLS (`AG-32`). El arreglo se probó
contra el hallazgo que lo motivó (S15, H03a), no contra la clase a la que pertenece lo que creó.

> **Regla propuesta.** Si un arreglo agrega una transición, una tabla, una policy o una RPC, entra a la lista de
> su clase y se le aplica la misma enumeración que a las demás: una transición, con sus efectos; una tabla con
> RLS, con su matriz por rol y operación. Y quien revisa corre la batería de la clase entera sobre el SHA nuevo,
> no solo las sondas de la ronda anterior: `H11` y `H12` no salieron de las sondas de la ronda 1, salieron de
> agregar mutaciones para lo nuevo.

---

## Advertencias

- **Ronda 1 de una PR abierta.** `AG-64` y `AG-65` salen de un solo caso cada una.
- **`H04` no es lección nueva:** es `AG-62` otra vez (prueba secuencial disfrazada de concurrencia), y esta vez
  con una aserción que se cumple antes de llamar a la RPC. Que se repita una PR después de escrita confirma que
  `AG-62` necesita un control, no más prosa.
- **`H06` repite el olor de `AG-57`:** la ventana de 24 h se prueba sembrando `delivered_at` a mano. Cuando una
  prueba prepara el estado que el código debería producir, es porque nadie comprobó que el código lo produce.
- **Nada de esto desmerece el diseño.** Orden de locks, grants, dispatcher privado, wrapper estricto y contador
  según CC-004 están bien. Los bloqueantes son de bordes: contrato, plan, RLS y controles.

## Lo que dice el dato entre PRs

`P08` suma dos casos más (`H06`, `H09`) y encadena tres PRs seguidas (#62, #64, #63). Es candidato firme a regla
en `AGENTS.md`, y la forma concreta ya está en `AG-61`/`AG-63`: **mutá el control antes de confiar en él**. Esta
PR agrega el dato de que la mutación también sirve para medir la cobertura de una suite grande: 13 mutaciones
en un minuto dijeron más sobre 1.153 aserciones que leerlas.

`P11-api-publica-inconsistente` vuelve con `H01`, `D01` y `H07`: tres casos de dos implementaciones de la misma
cosa que eligen distinto. `D01` es `PR62-H10` en otra tarea: la precedencia no escrita se vuelve a inferir dos
veces.

El reparto de `origen`: 8 `agente`, 3 `ambos` (`D01`, `H02`, `D02`) y 1 `ficha` (`D03`, donde la regla 30 no
cubre las transiciones de ciclo exclusivas de admin).

### Después de la ronda 2

`P08` suma dos casos más (`H11`, `H12`) y `P04` uno (`H10`). En la ronda 2 **ningún hallazgo es de código**: la
RPC hace lo correcto en las 15 sondas nuevas y en las 27 combinaciones de doble falla. Todo lo abierto es un
control que no puede fallar o un texto que no dice lo que hay. Es el patrón dominante de esta PR, ahora sin la
parte de código.

`R01` repite `H05`: la PR reincidió en describir algo que no es. En la ronda 1 era una prueba que ya no existía;
en la 2, código con otra forma. Las dos veces el texto se escribió desde la intención y no desde el diff.
