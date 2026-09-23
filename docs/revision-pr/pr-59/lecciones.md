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
