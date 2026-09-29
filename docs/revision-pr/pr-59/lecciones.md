# Lecciones — PR #59 (T-008)

Numeración continua del proyecto. `AG-01`…`AG-48` están en las carpetas de las PRs anteriores.

---

## `AG-49` · Un sistema de diseño se revisa rompiéndolo, no leyéndolo

En esta PR los 116 casos pasan, la cobertura sale 0 y siete jobs de CI están en verde. Leyendo las pruebas, todas
parecen razonables: hay un caso por cada ítem del DoD, con nombres que citan el DoD.

Rompí a propósito nueve propiedades que el DoD dice verificar y corrí la suite sobre cada mutación. **Ocho de las
nueve dejaron la suite en verde.** Se podía devolver la tipografía a 12 px, desconectar el botón Confirmar del
diálogo de acciones irreversibles, meter tres clases arbitrarias, apagar la detección de movimiento reducido y
cambiar el color de marca — todo sin que nada protestara.

**Por qué pasa acá y no en una PR de dominio:** las pruebas de UI se escriben mirando el DOM que el componente
produce, y el componente lo produce el mismo autor en el mismo rato. Es muy fácil escribir una aserción que
describe lo que se acaba de hacer en vez de la propiedad que hay que sostener. El caso más nítido es el del foco:

```ts
// Al abrir, el primer elemento enfocable recibe foco
cancelBtn.focus();
expect(document.activeElement).toBe(cancelBtn);
```

El comentario dice la propiedad; las dos líneas preparan el estado a mano y después lo comprueban.

**Qué cambiar:** para toda PR de `src/ui`, la batería de mutaciones no es opcional. Una por ítem del DoD, y el
informe dice cuántas pusieron la suite en rojo. Es barata —un script de 60 líneas y seis minutos de corrida— y es
el único dato que distingue «hay una prueba» de «hay un control».

Relacionada con `AG-43` (un control nace muerto hasta que algo lo ejecuta y falla a propósito). `AG-43` decía que
hay que demostrarlo una vez; `AG-49` dice que en UI hay que demostrarlo **por ítem**, porque la tasa de controles
ciegos no fue excepcional, fue del 89 %.

---

## `AG-50` · Cuando la ficha pide una librería que la misma ficha prohíbe, el agy va a escribirla a mano con su nombre

La regla 25 §1 aprueba shadcn/ui con primitivas Radix, `motion`, `react-hook-form` y `@hookform/resolvers`. La
ficha T-008 pide los cuatro en su objetivo y dice «Dependencias nuevas permitidas: **ninguna**». `package.json` no
está en Archivos permitidos. `AGENTS.md` §6 prohíbe agregar dependencias que la ficha no liste.

No hay forma de cumplir la ficha. El agy resolvió la contradicción del modo más razonable disponible: obedeció la
restricción de dependencias —cero paquetes nuevos, lo verifiqué cruzando todos los imports— y escribió ~1.200
líneas de reemplazos **con los nombres de las APIs reales**: `LazyMotion`, `MotionConfig`, `useZodForm`, `Dialog`,
`Sheet`, `Select`, `FormControl`.

El resultado es peor que cualquiera de las dos opciones puras, porque **la firma miente**. `LazyMotion` es
`<>{children}</>`: tiene el nombre de la API que la regla 60 pide «con el conjunto de features reducido» y no
carga ninguno. `FormControl` tiene el nombre de la pieza de shadcn que cablea `aria-describedby` y es un `<div>`.
Quien lea `providers.tsx` en seis meses va a concluir que Motion está montado.

**Qué cambiar:** dos cosas, y la primera es mecánica.

1. **Un control que cruce la línea «Dependencias nuevas permitidas» de cada ficha contra la tabla de la regla 25.**
   Si la ficha dice «ninguna» y su objetivo nombra un paquete de la tabla, la ficha está mal y hay que detectarlo
   antes de que alguien empiece la tarea, no en la revisión. `tools/verify-fichas.test.ts` ya existe y ya lee las
   27 fichas: es el lugar.
2. **Regla de nombres prestados:** si un módulo propio reemplaza a una librería, no puede usar los nombres de
   exportación de esa librería. El costo de renombrar es cero y el beneficio es que el reemplazo se ve.

Es hermana de `AG-41` (si la ficha no deja tocar el archivo que conecta el control, el control no existe): las dos
son contradicciones internas de la ficha que el agy paga en tiempo y la revisión paga en hallazgos.

---

## `AG-51` · Una auditoría de accesibilidad escrita para HTML nativo no ve un sistema de diseño que reemplazó el HTML nativo

`auditElementAccessibility` tiene cinco reglas. La 3 comprueba que todo `input, textarea, select` tenga etiqueta.
Pero este sistema de diseño reemplazó el `<select>` nativo por un `<button aria-haspopup="listbox">`, así que la
regla **no puede alcanzarlo nunca**. La 1 llama a `verifyTokenContrastMatrix()` e ignora el argumento `root`: da
el mismo resultado con cualquier elemento, o con ninguno.

El efecto neto es que la auditoría reporta «0 violaciones» sobre un DOM que tiene una violación nuclear de axe
(`aria-required-parent`: dos `role="option"` sin `role="listbox"`), y que ninguna de sus reglas mira la estructura
ARIA, que es justamente donde se rompe un sistema que reimplementa primitivas.

**La forma general:** cuando un control enumera *selectores* y el código bajo control decide *qué elementos usar*,
el control se desactualiza solo cada vez que el código elige otro elemento. Pasa igual con el barrido de valores
arbitrarios de esta misma PR, que enumera 33 prefijos de Tailwind y deja pasar `shadow-[…]`, `ring-[…]` y
`size-[…]`.

**Qué cambiar:** los controles de este tipo se escriben **por la negativa**. No «estos selectores deben cumplir X»
sino «cualquier cosa que coincida con la forma del problema es una violación, salvo esta lista corta de
excepciones justificadas». En el barrido de arbitrarios eso significa buscar `-\[...\]` y permitir `aria-[...]` y
`data-[...]`, que hoy son las dos únicas legítimas del repositorio.

Y para accesibilidad: no escribir la auditoría. La regla 25 ya aprueba `@axe-core/playwright`, que además corre
con CSS real, donde el contraste y el foco visible sí se pueden medir — cosa que ni axe puede hacer en jsdom.

---

## `AG-52` · El animador que respeta la preferencia no anima nada, y lo que anima no la respeta

El hallazgo `H02` merece quedar por su forma, no por su contenido.

`src/ui/motion/` implementa cuatro presets, detecta `prefers-reduced-motion` correctamente y anula todo
desplazamiento cuando corresponde. Funciona: lo comprobé sustituyendo `matchMedia`. Y **no lo usa nadie**:
`MOTION_PRESETS`, `getMotionPreset` y `AnimatedBox` no aparecen en ningún componente de `src/ui`, solo en su
propio archivo y en la suite.

Mientras tanto, las dos animaciones que sí se renderizan en cada pantalla —`animate-pulse` en todo `Skeleton` y
`animate-spin` en cada botón pendiente— son clases de Tailwind que no pasan por el sistema y no tienen ninguna
guarda `@media (prefers-reduced-motion: reduce)`.

O sea que existe un sistema completo y correcto **al lado** del problema que debía resolver.

**Qué cambiar:** un control de accesibilidad no se verifica sobre la pieza que lo implementa, se verifica sobre la
pantalla. La pregunta correcta no es «¿`getMotionPreset(x, true)` devuelve `y: 0`?» sino «con la preferencia
activa, ¿queda algo animándose en S00?». Para el DoD de movimiento reducido: renderizar la página de muestra con
`matchMedia` en `reduce` y exigir que ningún nodo tenga clase de animación activa. Ese caso habría encontrado el
`animate-pulse` de los skeletons el primer día.

---

## `AG-53` · Un snapshot de un árbol sin commitear no se revierte con `git checkout --`

A mitad de la ronda 2 concluí que `pnpm build` fallaba con veinte errores de tipo en `brand-logo.tsx` y estuve a
un paso de reportarlo como bloqueante. Era mío.

Había copiado el árbol de trabajo sin commitear del agy a un worktree detached desde `2491a4c`. Al terminar una
mutación sobre `src/ui/tokens.ts` la revertí con `git checkout -- src/ui/tokens.ts`, que **no deshace la
mutación: restaura el archivo del commit**. Con eso el snapshot quedó con el `tokens.ts` viejo —sin `ink`, sin
`surface`, sin `accent`— y el `brand-logo.tsx` nuevo que los usa. De ahí los veinte errores.

Lo que lo delató fue comparar el snapshot con el árbol del agy archivo por archivo: `tokens.ts` era el único que
coincidía, que es justo lo que no debía pasar.

**Qué cambiar:** cuando lo revisado no está en un commit, `git` no es la red de seguridad. Dos reglas:

1. Las mutaciones se revierten **desde memoria** (guardar el contenido antes y volver a escribirlo), nunca con
   `git checkout`. El script de mutaciones ya lo hacía; el error fue hacer una mutación suelta a mano.
2. Antes de creerle a un resultado sobre un snapshot, **comparar el snapshot con el original**. Es un `md5sum`
   por archivo y detecta la deriva en un segundo.

Hermana de `AG-47` (el probe de una revisión es código y se tipa antes de creerle): las dos dicen lo mismo, que
el instrumental de la revisión necesita su propia verificación antes de que sus salidas cuenten como evidencia.

---

## `AG-54` · Reescribir un archivo entero para arreglar un hallazgo se lleva puesto lo que el hallazgo no nombraba

`PR59-H10` decía una cosa acotada: `notify` suprimía el segundo aviso en vez de dejar que Sonner reemplazara por
`id`. El arreglo correcto eran tres líneas. Lo que pasó fue que `notify.ts` se reescribió de cero, y en la
versión nueva no están `DOMAIN_ERROR_MESSAGES` —los 27 mensajes en es-AR, uno por `DomainErrorCode`— ni
`notify.promise`. La regla 60 pide los dos.

Nada se rompió al compilar, porque todavía no hay features que los usen. **Y la prueba que los cubría se fue con
ellos**, así que tampoco quedó nada en rojo. Un diccionario de 27 mensajes y una función de la API pública
desaparecieron del repositorio sin que ningún control lo notara.

Es la cuarta regresión del proyecto y la segunda que sale de un arreglo pedido por esta revisión: `PR47-R01`,
`PR47-R02`, `PR48-H06` y ahora `PR59-R01`. `COMO-ENTREGAR.md` ya lo advierte —*«arreglar introduce
regresiones»*— y hasta ahora la respuesta era «volvé a correr el comando de cada hallazgo». Este caso muestra
que no alcanza, porque el comando de `H10` pasa perfecto: lo que se perdió está fuera de su alcance.

**Qué cambiar:** dos cosas concretas.

1. **En el bloque para el agy:** cuando el arreglo implique reescribir un archivo entero en vez de editarlo,
   decirlo y listar qué exportaciones tenía antes y cuáles tiene después. Es un `diff` de la API pública y se
   saca con un `grep` de `export`.
2. **En la revisión:** comparar las exportaciones del barril de `src/ui` y de cada archivo reescrito entre
   rondas. Yo encontré esto por casualidad, buscando dónde había quedado el diccionario. Un barrido de
   exportaciones perdidas entre ronda y ronda lo habría encontrado solo, y es mecánico.

También vale la parte propositiva: lo que **no** se perdió fue por diseño. `BrandLogo` se reescribió igual de
entero y ahí no faltó nada, porque las dos formas del SVG pasaron a derivarse de un único
`BRAND_LOGO_GEOMETRY`. Reescribir no es el problema; reescribir sin inventario de lo que había, sí.

---

## `AG-55` · «Sin objetivo» no es «cerrado»: una mutación que no aplica hay que reapuntarla, no darla por buena

En la ronda 3 corrí la batería de 16 mutaciones y tres dieron **«sin objetivo»**: el patrón que buscaba ya no
estaba en el archivo. La tentación es obvia — el código cambió, el hallazgo está arreglado, listo. Es
exactamente al revés: «sin objetivo» no dice nada sobre si el control funciona, solo que el archivo se reescribió.

Las tres resultaron ser dos cosas distintas y hay que saber cuál es cuál:

- **`M2` era una clase cerrada.** `focusables[0]?.focus()` ya no existe en `DialogContent` porque se eliminó el
  manejo de foco propio y quedó solo el de Radix. No hay mutación posible porque el defecto dejó de ser
  expresable. Eso sí es cerrar.
- **`M6b` y `M17` eran mi regex desactualizado.** `tokens.css` se había reescrito con precisión decimal
  (`--primary: 181 90.91% 38.82%` donde antes decía `181 90% 39%`), así que mi patrón no matcheaba. Reapunté las
  dos a los valores nuevos, las volví a correr y **las dos dieron rojo**. Si las dejaba en «sin objetivo» habría
  reportado `H22` como cerrado sin haberlo comprobado — y `H22` es justamente el hallazgo de que el control
  miraba la copia equivocada.

**Qué cambiar:** el script de mutaciones tiene que tratar «sin objetivo» como **un fallo de la revisión, no un
resultado**. Que imprima el archivo y obligue a decidir a mano entre las dos lecturas: o el constructo
desapareció (y se dice por qué eso cierra la clase), o el patrón quedó viejo (y se reapunta). Nunca se cuenta
como control verificado.

Es la tercera de la misma familia: `AG-46` (antes de decir que una ruta no resuelve, ejecutala desde donde la
ejecuta su usuario), `AG-47` (el probe se tipa antes de creerle) y `AG-53` (el snapshot se compara con el
original). Las cuatro dicen que **el instrumental de la revisión falla en silencio**, y que un resultado vacío
es casi siempre un instrumento roto antes que una propiedad cumplida.

---

## `AG-56` · Un presupuesto en bytes no distingue un archivo de un archivo vacío

`H21` era un logo de 1,25 MB contra un presupuesto de 5 KB. El arreglo fue bueno para el SVG: 1.106 bytes, con
las figuras reales, el wordmark correcto y sin los metadatos del exportador. Y el control se amplió de
`existsSync` a medir bytes **y** contenido.

Para el WebP se amplió solo a bytes:

```ts
expect(webpStat.size).toBeGreaterThan(20);
expect(webpStat.size).toBeLessThan(50 * 1024);
```

Lo que hay en disco es un WebP de **272 × 0 píxeles**: 45 bytes, contenedor RIFF válido, firma `WEBP`, chunk
`VP8 `, código de sincronía correcto — y alto cero. Pasa las dos aserciones y no dibuja nada.

**La forma general:** cuando un hallazgo es «esto pesa demasiado», el arreglo natural es poner un techo, y un
techo se satisface igual de bien con el archivo correcto que con uno degenerado. El piso de 20 bytes intentaba
cubrir eso y no alcanza, porque el encabezado de cualquier formato pesa más que eso.

**Qué cambiar:** para un archivo binario, el control se escribe sobre lo que el formato **significa**, no sobre
lo que ocupa. Un WebP se comprueba leyendo ancho y alto del encabezado VP8; un PNG, por su firma y su `IHDR`. Son
cuatro líneas de `readUInt16LE` y convierten «el archivo existe y no es enorme» en «el archivo es una imagen».

Y hay un indicio que sirve de alarma barata: **si dentro del mismo `it` un archivo se comprueba por contenido y
el de al lado solo por tamaño, la asimetría es el hallazgo.** Acá estaba a cinco líneas de distancia.
