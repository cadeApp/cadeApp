# Lecciones de la PR #57 para `AGENTS.md` y las reglas

**Fuente:** 16 hallazgos en la ronda 1. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

> Ronda 1 de una PR abierta. Las conclusiones pueden moverse.

## Patrón dominante

**Un documento de arquitectura que nombra el esquema es código, y se revisó como si fuera prosa.**

Los dos ADR argumentan bien y describen mal. La decisión —Supabase sobre Firebase sobre backend propio, Vercel sobre Cloudflare sobre VPS, expiración perezosa sobre cron frecuente— está tomada con los criterios correctos y explicada mejor que en el Master Plan. Pero cuando el texto baja a nombrar tablas, columnas, policies, índices, estados y claves de configuración, nombra **otro esquema**: trece identificadores que no existen, cuatro usos de un valor de enum que no existe, dos rutas de archivo equivocadas, una clave de `platform_settings` con el nombre y el valor cambiados.

Nada de eso es difícil de detectar. Un cruce de veinte líneas de Node entre los backticks de los ADR y `supabase/migrations/**` los encuentra todos de una vez, y está en [`evidencia/comandos.md`](evidencia/comandos.md). Lo que no había era **nadie que lo hiciera**: ni el agy, ni su autorrevisión, ni el test que escribió, ni —hasta la segunda pasada— esta revisión.

Y la consecuencia no es cosmética, porque este documento es la referencia. Dos ejemplos de los quince:

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
> Y el corolario para quien revisa: **en una PR de documentación, el primer comando no es leer el diff, es cruzar los nombres.** Trece de los dieciséis hallazgos de esta ronda salieron de ahí.

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

### AG-42 · Contar etiquetas mide disciplina de formato; no mide nada más
**Origen:** H07, H15, H16

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
