# Lecciones de la PR #57 para `AGENTS.md` y las reglas

**Fuente:** 24 hallazgos en tres rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Cerrada al darla por lista: 18 de 24 verificados, 3 aceptados por decisión, 0 bloqueantes.

## Patrón dominante

**Un documento de arquitectura que nombra el esquema es código, y se revisó como si fuera prosa.**

Los dos ADR argumentan bien y describen mal. La decisión —Supabase sobre Firebase sobre backend propio, Vercel sobre Cloudflare sobre VPS, expiración perezosa sobre cron frecuente— está tomada con los criterios correctos y explicada mejor que en el Master Plan. Pero cuando el texto baja a nombrar tablas, columnas, policies, índices, estados y claves de configuración, nombra **otro esquema**: trece identificadores que no existen, cuatro usos de un valor de enum que no existe, dos rutas de archivo equivocadas, una clave de `platform_settings` con el nombre y el valor cambiados.

Nada de eso es difícil de detectar. Un cruce de veinte líneas de Node entre los backticks de los ADR y `supabase/migrations/**` los encuentra todos de una vez, y está en [`evidencia/comandos.md`](evidencia/comandos.md). Lo que no había era **nadie que lo hiciera**: ni el agy, ni su autorrevisión, ni el test que escribió, ni —hasta la segunda pasada— esta revisión.

Y la consecuencia no es cosmética, porque este documento es la referencia. Dos ejemplos:

- **ADR-0001 afirma que `notes` está protegido.** No lo está: es columna de `delivery_requests` y todo repartidor aprobado la lee en la bolsa. El documento al que alguien va a ir a preguntar «¿esto se ve antes de aceptar?» hoy contesta mal.
- **ADR-0002 dice buscar `status = 'open'`.** T-104 va a implementar el barrido con esa consulta, que devuelve cero filas y no falla.

## Lecciones propuestas

### AG-39 · Un documento que nombra el esquema se cruza contra el esquema, no se lee
**Origen:** H01, H03, H04, H07, H10, H11, H12, H13, H15, H16

Trece identificadores inventados, cuatro `status = 'open'`, dos rutas muertas, una clave de configuración con nombre y valor cambiados, y tres citas al Master Plan apuntando a la sección equivocada. Todo eso pasó por: la escritura, la autorrevisión del agy, un test de 106 líneas escrito para verificar el DoD, ocho jobs de CI y la primera pasada de esta revisión.

Ninguno de los cinco filtros podía atraparlo, porque los cinco leen el documento como prosa. El cruce mecánico sí:

```bash
# extraer los identificadores snake_case entre backticks y cruzarlos contra migrations+seed
# 33 citados · 13 no existen  — salida completa en evidencia/comandos.md
```

> **Regla propuesta.** Cuando un documento cita identificadores del repo —tablas, columnas, policies, índices, rutas de archivo, variables de entorno, claves de configuración, valores de enum—, esos nombres son **verificables** y hay que verificarlos con un comando, no leyéndolos. El orden importa: primero el cruce mecánico, después la lectura. La lectura humana es buena juzgando si el argumento se sostiene y es mala contando si `matched_courier_id` existe; el grep es lo contrario. Usar cada uno para lo suyo.
>
> Y el corolario para quien revisa: **en una PR de documentación, el primer comando no es leer el diff, es cruzar los nombres.** Trece de los diecisiete hallazgos de esta ronda salieron de ahí.

### AG-40 · `[DATO]` es una afirmación sobre una fuente; sin la fuente es un `[SUPUESTO]` con mejor tipografía
**Origen:** H05, H14

El DoD pedía clasificar cada costo como dato o supuesto, y la clasificación se hizo con cuidado: 64 `[DATO]` y 35 `[SUPUESTO]` repartidos ítem por ítem. Lo que no hay es **una sola fuente**: cero URLs en ADR-0001, una en ADR-0002. El propio README define `[DATO]` como «verificable en la documentación vigente del proveedor **a la fecha de redacción**», y no queda registrado ni dónde ni cuándo.

Eso ya sería una molestia para revalidar precios que se mueven. Se vuelve un problema cuando la etiqueta se usa sobre una afirmación técnica: **ADR-0001 marca `[DATO]` que los backups de Supabase no copian los objetos del bucket, y el Master Plan §9.4 lo tiene escrito como pendiente de verificar.** De esa frase cuelga D8 —que la purga del DNI a los 30 días sea real— y el ítem a verificar se publicó como verificado.

> **Regla propuesta.** `[DATO]` obliga a fuente: URL y fecha de consulta, en una sección «Fuentes consultadas» del mismo documento. Sin eso la etiqueta correcta es `[SUPUESTO]`, aunque quien escribe esté seguro. Y una afirmación sobre el **comportamiento** de un proveedor —qué copia un backup, qué retiene un WAL, qué borra una purga— no es un dato de precio: si un documento del proyecto la tiene como pendiente de verificar, el ADR no puede cerrarla; puede citarla, marcarla `[SUPUESTO]` y nombrar la tarea donde se cierra.

### AG-41 · Si la ficha no permite tocar el archivo que conecta el control, el control no existe
**Origen:** H06

T-007 entregó `docs/adr/verify-adr.test.mjs`: 106 líneas que verifican los cinco ítems del DoD, con fase roja demostrada en la bitácora antes de escribir los ADR. Está bien hecho. Y no lo corre nadie: `pnpm test` es `vitest run && node --test .github/workflows/verify-workflows.test.mjs`, y ningún job de `ci.yml` mira `docs/`. Borrar los dos ADR deja los ocho jobs en verde.

**No es del agy.** «Archivos permitidos» de T-007 son `docs/adr/**`, `docs/tasks/**` y `docs/revision-pr/**`. `package.json` no está. El agy no podía encadenar el test sin desviarse del alcance, eligió `docs/adr/**` justamente para respetar la ficha, y lo dejó escrito en la bitácora. Hizo lo correcto con la ficha que tenía.

Es la tercera vez que aparece esta forma, y conviene mirarlas juntas: `PR47-A01`, `PR48-A01` y `PR49-A01` son todas «el DoD exige un entregable y la lista de archivos no da dónde ponerlo». Se resolvió agregando `docs/revision-pr/**` y `tools/**` a las 27 fichas. Esta es la misma familia con otra cara: no falta dónde poner el archivo, falta **dónde engancharlo**.

> **Regla propuesta.** Cuando una ficha pide un control automático, «Archivos permitidos» tiene que incluir el archivo donde ese control se conecta —`package.json`, `ci.yml`, la config del linter—. Si no lo incluye, lo entregado no es un control: es un script que alguien tiene que acordarse de correr, y hay que decirlo así en el DoD en vez de contarlo como verificación.
>
> Y para quien revisa, la pregunta de una línea: **¿qué pasa si borro el entregable y corro los checks?** Si quedan verdes, el control no existe. Es la misma pregunta de `PR51-H06`, ahora aplicada a una tarea de documentación.

**Addendum del arreglo, que hace la lección más incómoda.** Al aplicar la opción 1 apareció que **CI no corre `pnpm test` en ningún job**: `unit` corre `pnpm test:coverage` y el `node --test` de workflows. O sea que encadenar la suite al script `test` —que era exactamente lo que yo había propuesto— la habría dejado igual de fuera de CI, y el hallazgo se habría cerrado en falso. Hubo que agregar además el paso a `ci.yml`.

Lo que lo escondía es lo peor del asunto: `verify-workflows.test.mjs:37` afirma que `ci.yml` incluye `pnpm test`, y **eso se cumple por substring con `pnpm test:coverage`** (`H17`). Hay una aserción que declara cubierto en CI un script que CI no ejecuta, y está ahí desde la #51 — o sea que es un hueco de mi propia revisión de entonces, no de esta PR.

> **Corolario.** «Está en el script» y «CI lo ejecuta» son dos afirmaciones distintas, y la segunda solo se comprueba **leyendo los `run:` de los jobs**, nunca el `package.json`. Un control que afirma lo primero y se lee como lo segundo es peor que no tener control, porque cierra la pregunta.

### AG-42 · Contar etiquetas mide disciplina de formato; no mide nada más
**Origen:** H07, H15, H16, H17

La suite verifica el DoD así: que ciertas cadenas aparezcan (`/ACID/i`, `/Row Level Security/`, `/purge_after/`), que haya al menos 5 `[DATO]` y 3 `[SUPUESTO]`, y que los tres nombres de persona estén en el archivo. Todo eso está bien elegido para verificar **estructura**. El problema es que se usó para declarar conformes dos documentos con veintitantos errores de hecho.

El caso más claro es el ítem que más importa del DoD. **Borré las dos tablas de revisión enteras y los cinco tests siguieron en verde**, porque los tres nombres están en la línea 6 de cada ADR, en «Autores / Revisores». El test dice verificar «revisión de las 3 personas» y verifica que tres cadenas existan en el archivo.

> **Regla propuesta.** Una aserción sobre un documento afirma **estructura o relación**, nunca presencia de una palabra. «Hay una fila por persona dentro de la sección de revisión y ninguna dice `Pendiente`» se puede romper; «`persona2` aparece en el archivo» no. La prueba de que una aserción sirve es la de siempre: romperla a propósito una vez y ver si el test salta. Acá, borrar la sección que el test dice verificar no lo hizo saltar, y eso se podía comprobar en treinta segundos.

## Advertencias

- **Ronda 1.** `AG-39` es la única que ya tiene evidencia sólida —trece casos en un solo barrido—. Las otras tres salen de uno o dos hallazgos cada una.
- **`AG-39` y `AG-42` son la misma lección desde los dos lados.** Una dice qué tiene que hacer quien escribe el documento; la otra, qué tiene que afirmar el test que lo verifica. Si la PR cierra bien, probablemente convenga escribirlas como una sola.
- **`AG-41` no es una lección sobre el agy y hay que leerla así.** Es la tercera vez que la ficha produce el defecto, y las dos anteriores se arreglaron cambiando las fichas, no el comportamiento del agente.
- **Nada de esto desmerece los dos ADR.** La parte que suele salir mal en un ADR —comparar alternativas de verdad, no justificar a posteriori la que ya se eligió— está bien resuelta. La §3.2 de ADR-0002 explica la expiración perezosa mejor que el plan que la ordena. Lo que falló es el pegado con el repo, que es mecánico.
- **Esta revisión tampoco lo vio a la primera.** Los identificadores aparecieron recién cuando dejé de leer y corrí el cruce. Es `AG-37` otra vez, con otra clase: la clase acá no eran las policies, eran los nombres.

## Lo que dice el dato entre PRs

Con la #57, **104 hallazgos en 7 PRs**.

- **`P03-comentario-contradice-codigo` pasó de 2 a 6 casos** y suma su segunda PR (#47 y #57). Con eso entra en el criterio de 2+ PRs para candidato a regla, y es de lo que habla `AG-39`.
- **`P01-contrato-de-framework-no-verificado` llega a tres PRs** (#47, #49, #57). En las dos primeras era un comportamiento de Next.js asumido sin comprobar; acá es el comportamiento de backup de Supabase. La forma es la misma y `AG-40` es su versión para documentación.
- **`P04-test-tautologico` va por su quinta PR consecutiva** (#47, #48, #49, #56, #57). Es el patrón más persistente del proyecto y cada vez aparece con un disfraz distinto: una prueba de `server-only` que pasaba sin ejercer nada (#47), una `lives_ok` sobre un `update` que no matchea (#56), y ahora tres `assert.match` sobre el archivo entero. Vale la pena que `AG-42` lo nombre explícitamente.
- **`P15-entregable-declarado-pero-no-ejecutable` llega a cuatro PRs** (#49, #51, #54, #57) y es el que más rinde arreglar, porque el síntoma siempre es el mismo: algo declarado como verificación que nadie ejecuta.
- **`P19-cuerpo-de-pr-fuera-de-template` suma su segunda PR** (#51 y #57). El check existe y está rojo, así que acá el control funcionó: lo atrapó antes que la revisión.
- **El reparto de origen se mueve un poco**: 13 `agente`, 2 `ficha`, 1 `ambos` (16%). Después de tres PRs con 0% `ficha`, vuelve a aparecer — y las dos veces por lo mismo, que la lista de «Archivos permitidos» no contempla dónde se engancha lo que el DoD pide.

Y el dato de proceso, otra vez:

- **La autorrevisión del agy declaró «Hallazgos bloqueantes: Ninguno» y «Hallazgos no bloqueantes: Ninguno»** sobre dos documentos con trece identificadores inventados. Es el mismo resultado que en la #56 y por el mismo mecanismo: **revisarse a uno mismo no encuentra lo que uno no pensó al escribirlo.** Quien escribió `matched_courier_id` creyendo que existe no lo va a encontrar releyendo; lo encuentra un `grep`.
- **Pero esta vez la autorrevisión sí sirvió para algo comprobable:** el PR trae los checks corridos con su salida pegada, y la bitácora registra la fase roja 5/5 con el mensaje de error concreto, en una tarea de documentación donde saltearla era gratis. Eso es la regla 50 funcionando.
- **Y lo que no atrapó ninguno de los dos:** que el informe presenta `pnpm test: ✅ (72/72 Vitest + 19/19 workflows + 5/5 verify-adr)` como salida de un comando que no corre el último. Los tres números son ciertos por separado; juntos le atribuyen al check un alcance que no tiene. Es exactamente lo que `PR47-R01` enseñó a mirar: los checks verdes no dicen qué cubrieron.

---

# Lecciones de la ronda 2

**Fuente:** 5 hallazgos nuevos y 1 regresión sobre `3152068`.

## AG-43 · Un control nace muerto hasta que algo lo ejecuta y falla a propósito
**Origen:** H06, H17, H18, H19, H20

La ronda 1 encontró que la suite del DoD no la corría nadie. Al barrer la clase entera —**qué más se declara como control y no se ejecuta**— aparecieron otros cuatro, y el peor es de seguridad:

| Control | Cómo estaba |
|---|---|
| `docs/adr/verify-adr.test.mjs` | ni en `pnpm test` ni en CI (`H06`) |
| El guard de la regla 00 | ruta que no resuelve **y** formato de payload equivocado: nunca bloqueó nada (`H18`) |
| El job `audit` | `|| echo` en la única rama que corre: no puede fallar, esconde 23 `high`/`critical` (`H19`) |
| Prettier | instalado, con `.prettierrc`, sin script ni job (`H20`) |
| «CI corre `pnpm test`» | aserción que se cumple por substring con `pnpm test:coverage` (`H17`) |

Los cinco comparten una cosa: **nadie los ejercitó nunca en rojo.** El guard es el caso extremo — su lógica está bien escrita, con catorce reglas pensadas, y devolvía `ask` a `supabase db push --linked` y a leer `.env.local`. Dos defectos triviales, independientes, en el pegado.

> **Regla propuesta.** Un control entregado sin una prueba que lo invoque y lo vea fallar **no es un control, es un archivo**. Antes de contarlo como verificación hay que responder dos preguntas con un comando: *¿quién lo ejecuta?* (leyendo los `run:` de los jobs, nunca el `package.json` — ver `AG-41`) y *¿qué pasa si le doy lo que debería rechazar?* Si la segunda respuesta no es un fallo observable, el control está muerto aunque el código sea correcto.
>
> Y un corolario para quien revisa: cuando aparece **un** control muerto, la clase entera son todos los controles del repo, no los del diff. Los cuatro de esta ronda salieron de un barrido de veinte minutos sobre `package.json`, los `run:` de los workflows y los archivos de prueba.

## AG-44 · Cerrar una tautología prohibiendo el estado incómodo la empeora
**Origen:** H21 (regresión)

`H07` decía: el test afirma «revisado por las 3 personas» y pasa con las tablas borradas. El arreglo agregó vocabulario cerrado —bien— y después `assert.notEqual(estado, 'Pendiente')` para las tres filas. Con eso **la suite falla si alguien declara la verdad**, y el agy completó las dos filas con un checkpoint que inventó.

El arreglo se ve más riguroso que el defecto, y ese es justo el problema: extrae la sección correcta, usa un vocabulario cerrado y tiene mensajes claros. Lo único que hace mal es la pregunta.

> **Regla propuesta.** Una prueba sobre un estado declarado afirma que **hay evidencia del estado declarado**, nunca que el estado sea uno en particular. «Si dice `Aprobado`, la fila trae canal y fecha» se puede satisfacer diciendo la verdad; «no puede decir `Pendiente`» sólo se satisface afirmando lo que el control quiere oír. Cuando un arreglo de un `P04-test-tautologico` deja el test más exigente, hay que preguntarse **qué respuesta honesta acaba de volverse imposible**.

## AG-45 · La RLS acota filas; las columnas hay que acotarlas aparte, y la matriz no lo prueba
**Origen:** H22, y `PR56-H13` que ya estaba abierto

`notes` es columna de `delivery_requests` y `delivery_requests_select_courier` entrega la fila completa: cualquier repartidor aprobado lee la nota al cliente de cualquier solicitud publicada, haya ofertado o no. No hay ningún `grant select (…)` por columna en toda la migración.

Es la segunda instancia del mismo mecanismo: en la #56 fue `merchants` (`H03` → residual `H13`), ahora `delivery_requests`. Y las dos veces la matriz de RLS estuvo verde, **porque prueba qué filas ve cada actor y nunca qué columnas**. Un actor que ve la fila correcta se lleva todo lo que la fila contiene.

> **Regla propuesta.** `AG-32` decía que una matriz de RLS tiene una columna por operación. Le falta la otra mitad: para las tablas donde un actor ve filas que no son suyas —el feed, los perfiles visibles entre actores— la matriz afirma también **qué columnas** le llegan, comparando contra la lista esperada en vez de contar filas. Si la respuesta es «todas», eso es una decisión que hay que escribir, no un default.

## Lo que dice el dato entre PRs, actualizado

Con las dos rondas, **109 hallazgos en 7 PRs**.

- **`P08-control-no-cubre-lo-que-dice` se despega:** suma `H18` y `H19` y queda como el patrón más frecuente del proyecto por amplio margen. Ya no es un patrón, es **el** patrón, y `AG-43` es el intento de darle un control.
- **`P04-test-tautologico` va por su quinta PR consecutiva**, y esta vez con una vuelta nueva: el arreglo produjo `P05-semantica-invertida-vs-dod` (`H21`). Vale la pena registrar que las dos formas conviven: un test que no puede fallar y un test que solo puede pasar mintiendo son el mismo error de diseño visto desde los dos lados.
- **Cuarta regresión del proyecto** (`PR47-R01`, `PR47-R02`, `PR48-H06`, `PR57-H21`). Las cuatro tienen la misma forma: el arreglo deja los checks verdes y desplaza el problema. Por eso el bloque para agy pide volver a correr el comando de cada hallazgo y no confiar en `typecheck/lint/test`.
- **El reparto de origen queda en 16 `agente`, 3 `ficha`, 1 `ambos`.** Los tres de ficha son la misma cosa: «Archivos permitidos» no contempla dónde se engancha lo que el DoD pide.

Y sobre el proceso, dos cosas que esta ronda muestra bien:

- **El agy corrió el barrido en vez de tachar los hallazgos de a uno.** La bitácora lo registra y el resultado se verifica: 40 identificadores citados, 4 inexistentes y las cuatro legítimas. Eso es `AG-37` funcionando del lado de quien arregla, que es donde más rinde.
- **No tocó `docs/revision-pr/**`, segunda vez consecutiva.** La regla que entró a `COMO-ENTREGAR.md` después de la #56 se cumple sola. Vale anotarlo, porque es justo el caso de `no-podar-reglas-por-silencio`: que el patrón no aparezca es la señal de que la regla sirve.

---

# Lecciones de la ronda 3

## AG-46 · Antes de afirmar que una ruta no resuelve, ejecutarla desde donde la ejecuta quien la usa
**Origen:** R01 — regresión de la revisión

En la ronda 2 reporté que el hook estaba muerto por dos motivos: el formato del payload y una ruta que no resolvía. **El primero era cierto; el segundo lo inventé yo.** Medí `node scripts/agent-guard.mjs` parado en la raíz del repo, vi `MODULE_NOT_FOUND` y di por sentado que ese era el cwd del hook. `agy` los lanza desde `<repo>/.agents/`, así que la ruta original era correcta y la mía la rompió.

El agy no lo discutió: lo probó. Puso mi versión y el runner devolvió

```
Cannot find module 'c:\…\cadeApp\.agents\.agents\scripts\agent-guard.mjs'
```

y ese `.agents\.agents` duplicado cierra la pregunta sin margen.

Lo más incómodo no es el error, es **cómo pasó mis propios controles**. Escribí una prueba para respaldar el hallazgo, y la prueba afirmaba `existsSync(path.resolve(script))` — o sea, medía desde la raíz, que era exactamente mi supuesto. Un test que codifica la hipótesis equivocada pasa en verde y **hace que el error se vea verificado**. Es `P04-test-tautologico` con otro disfraz: no es que no pueda fallar, es que solo puede confirmar a quien lo escribió.

> **Regla propuesta.** Una afirmación sobre el entorno —una ruta relativa, un cwd, una variable, un orden de carga— se comprueba **ejecutando desde donde lo ejecuta el que la usa**, no desde donde uno está parado. Y cuando la prueba que respalda un hallazgo depende del mismo supuesto que el hallazgo, no es evidencia: es la misma afirmación escrita dos veces. La forma de romper el círculo es la del agy — correrlo en vivo y leer el error, que suele traer la respuesta impresa.
>
> Corolario práctico: cuando un control es *invocado por otro proceso* (un hook, un runner, un cron), el cwd es parte del contrato y hay que verificarlo antes de tocar nada.

## Lo que esta ronda dice del proceso

Tres cosas que conviene dejar escritas, porque son del tipo que después se olvida:

- **El agy encontró un defecto real de la revisión y lo demostró en vivo.** Es la segunda vez en el proyecto —la primera fue `PR56-H10`, el `throws_ok` de tres argumentos— y las dos veces por el mismo mecanismo: **la ejecución le tira por la cara lo que la lectura no ve**. La revisión independiente encuentra lo que el autor no pensó; el autor encuentra lo que el entorno le grita. Las dos hacen falta.
- **Su arreglo quedó mejor que mi propuesta.** El test ahora resuelve y ejecuta con `cwd: path.dirname(HOOKS_PATH)`, o sea contra el cwd real, en vez de contra una constante. Si mañana cambia, el test lo dice.
- **La regresión falló ruidosamente.** Entre `594e04c` y `6a46563` el hook no cargaba, pero tiraba `Cannot find module` en cada llamada en vez de devolver `ask` en silencio. No hubo ventana de falso verde. Vale la pena notarlo, porque es la diferencia entre un control roto que se nota y uno que no — y la versión original del bug, la del payload, era justamente de las que no se notan.

## El dato entre PRs, al cerrar

**112 hallazgos en 7 PRs.** Cuatro regresiones registradas: `PR47-R01`, `PR47-R02`, `PR48-H06` y ahora `PR57-R01`, **la primera de la revisión y no del agy**. El campo `origen` solo sirve si me incluye.

Y el reparto final de la #57: 24 hallazgos, 18 cerrados, 3 aceptados por decisión de Lautaro073 y 3 abiertos que van a otras tareas. Ninguno bloqueante al cierre.
