# PR #59 · T-008 — Ronda 1

- **PR:** [#59](https://github.com/cadeApp/cadeApp/pull/59) · `feat/T-008-ui-tokens-d16` → `develop`
- **Tarea:** `T-008` — Base de UI y tokens de Stitch (D16) · Issue #9
- **SHA revisado:** `e3c1a4d` (implementación `40ab440`, Fase Roja `3b6ad9f`)
- **Fecha:** 2026-09-23
- **Revisión:** independiente (no es el agy que implementó)
- **Resultado: CON BLOQUEANTES (9)** · 10 mejoras · 4 decisiones resueltas por Lautaro073 antes de escribir este informe

---

## 0. Lo que está bien, con precisión

No es cortesía: son cosas que verifiqué y que me ahorraron hallazgos.

- **Cero dependencias nuevas, de verdad.** Crucé todos los `import` externos de `src/ui/**` y `src/lib/format/**`
  contra `package.json`: solo aparecen paquetes ya declarados. Con la ficha diciendo «Dependencias nuevas
  permitidas: ninguna», eso es obediencia real y no declarada. Es también la causa raíz de `D01`, pero la
  disciplina fue del agy y la contradicción es de la ficha.
- **Cero construcciones prohibidas.** Barrido sobre los 28 archivos del diff: sin `any`, sin `@ts-ignore`, sin
  `!` non-null, sin `.only`, sin `.skip`. En una PR de 2.200 líneas nuevas eso no se da solo.
- **`verifyTokenContrastMatrix` calcula de verdad.** Esperaba una tautología —un objeto con `allPass: true`
  escrito a mano— y no lo es: implementa la luminancia relativa de WCAG 2.2 correctamente, y lo comprobé
  reproduciendo los seis ratios con una implementación propia. Además el control está **vivo**: bajé
  `mutedForeground` a `#9AA3B2` y la suite se puso roja. De los ocho controles que muté, este es el único que
  saltó. El hallazgo `H13` es sobre qué pares mira, no sobre si mira.
- **La cláusula Anti-12px se cumple.** Busqué `text-xs`, `0.75rem` y tamaños de 10 a 13 px en todo `src/ui` y
  `src/lib/format`: cero. El piso se respeta. El hallazgo `H04` es sobre el control, no sobre la propiedad.
- **El manejo de `hour === '24'` en `formatDate`** (`src/lib/format/index.ts:57`) es una defensa real contra la
  diferencia de ICU entre `h23` y `h24` con `hour12: false`. Nadie la pidió y evita un `24:30` en producción.
- **`.badge-*` y `.safe-area-bottom` como clases semánticas en `tokens.css`** en vez de valores arbitrarios es
  mejor solución que la que yo hubiera propuesto: `env(safe-area-inset-bottom)` en Tailwind sale casi siempre
  como `pb-[env(...)]`, y así el barrido de arbitrarios queda honesto en vez de con una excepción.

---

## 1. Alcance

`gh pr diff 59 --name-only` → 28 archivos. Contra «Archivos permitidos» de `docs/tasks/T-008.md` leída desde
`origin/develop`:

| Patrón permitido | Archivos del PR |
|---|---|
| `src/ui/**` | 22 |
| `src/lib/format/**` | 2 |
| `src/app/providers.tsx` (visto bueno P1) | 1 |
| `docs/tasks/T-008.md` | 1 |
| `docs/tasks/log/T-008.md` | 1 |
| `docs/revision-pr/**` | 0 (entra con esta revisión) |

**0 archivos fuera de alcance.** No hay `A01`.

Vale registrar lo contrario, que es lo que produjo tres de las cuatro decisiones: hay cuatro rutas que la ficha
**exige tocar en su objetivo** y **no incluye** en Archivos permitidos — `public/**`, `src/app/**` (más allá de
`providers.tsx`), `package.json` y `vitest.config.ts`. No es desvío del agy; es la ficha.

---

## 2. Las cuatro decisiones (resueltas antes de escribir esto)

Se las pregunté a Lautaro073 antes de armar el informe, no después. Quedan cerradas:

| id | Qué | Decisión |
|---|---|---|
| `D01` | La regla 25 §1 aprueba shadcn/Radix, `motion`, `react-hook-form` + `@hookform/resolvers`. La ficha dice «ninguna». El agy escribió reemplazos a mano con los nombres de las APIs reales. | **Ampliar la ficha e instalar.** Sumar `package.json` a Archivos permitidos y rehacer Dialog, Sheet, Select, Form y Motion sobre las librerías reales. |
| `D02` | El objetivo pide WebP en `public/brand/`, PNGs para el manifest PWA y una «página de muestra S00». `public/` está vacío y no hay ruta. | **Ampliar la ficha** con `public/**` y la ruta del showcase, y generar los assets. |
| `D03` | El DoD pide «axe sin violaciones». La regla 25 aprueba `@axe-core/playwright`, o sea E2E. | **Mover el chequeo a E2E.** En T-008 queda la auditoría propia, renombrada para que no se presente como equivalente a axe. |
| `D04` | `vitest.config.ts` solo pone umbral a `src/domain/**`. `src/ui` entra con 64,15 % de ramas. | **Sumar `vitest.config.ts` a Archivos permitidos** y poner umbral a `src/ui/**` en esta PR. |

`D01` es la causa raíz de buena parte del resto: `LazyMotion` es literalmente `<>{children}</>`
(`src/ui/motion/index.tsx:58-60`), `useZodForm` no es `react-hook-form`, y Dialog/Sheet/Select son primitivas
propias. La regla 60 línea 33 pide «`LazyMotion` con el conjunto de features reducido»; hoy existe un componente
con ese nombre que no carga ningún conjunto de features.

---

## 3. El dato central: 8 de 9 controles del DoD son ciegos

No lo deduje leyendo. Rompí a propósito, una por una, las propiedades que el DoD dice verificar, y corrí
`src/ui/ui-system.test.tsx` + `src/lib/format/format.test.ts` sobre cada mutación. Script y salidas completas en
[`evidencia/comandos.md`](../evidencia/comandos.md).

| # | Rompí | Ítem del DoD que debería atajarlo | Suite |
|---|---|---|---|
| M1 | `tailwind.config.ts`: la escala `xs` vuelve a `0.75rem` (12 px) | «piso tipográfico 14px sin excepciones móviles» | 🟢 **verde** |
| M2 | `dialog.tsx`: saco el foco automático al abrir | «Tests del Dialog (foco atrapado, Esc)» | 🟢 **verde** |
| M3 | `card.tsx`: meto `shadow-[0_0_0_9999px_red] ring-[3px] size-[13px]` | «ningún valor de estilo arbitrario» | 🟢 **verde** |
| M4 | `dialog.tsx`: desconecto el botón Confirmar de `ConfirmDialog` | «Dialog de confirmación» | 🟢 **verde** |
| M5 | `motion/index.tsx`: `MotionConfig` deja de leer la preferencia del sistema | «con `prefers-reduced-motion` los presets no desplazan» | 🟢 **verde** |
| M6 | `tokens.ts`: `mutedForeground` a `#9AA3B2` (2,42:1) | «contraste WCAG AA/AAA» | 🔴 **roja** |
| M6b | `tokens.css`: `--accent` a verde oscuro → `.badge-success` a 1,06:1 | «contraste WCAG AA/AAA» | 🟢 **verde** |
| M7 | `brand-logo.tsx`: cambio el color de marca del SVG renderizado | «`<BrandLogo />` < 5 KB» | 🟢 **verde** |
| M8 | `notify.ts`: el id nunca se libera al cerrar el toast | «`notify` no duplica toasts por id» | 🟢 **verde** |

Una sola mutación puso la suite en rojo. Es exactamente `AG-43` de la PR #57: **un control nace muerto hasta que
algo lo ejecuta y falla a propósito.** Acá los 13 tests y los 116 casos pasan, `pnpm test:coverage` sale 0, y CI
pone siete jobs en verde — y aun así se puede devolver la tipografía a 12 px, desconectar el diálogo de
confirmación de acciones irreversibles y apagar la detección de movimiento reducido sin que nada proteste.

---

## 4. Bloqueantes

### `H01` · El cuerpo del PR no sigue la plantilla y `approval-policy` está en rojo: CI es 7 de 8

`gh pr checks 59`: `approval-policy fail`. Los otros siete pasan. El log dice:

```
Falta el informe completo de revisar-pr sin bloqueantes.
```

El cuerpo del PR completo son tres líneas: `Closes #9` más una frase sobre la Fase Roja. La plantilla
`.github/pull_request_template.md` pide siete secciones y **no hay ninguna**: ni «Qué cambia», ni el DoD copiado,
ni «Evidencia de checks», ni «Informe de revisión de agy», ni «Dependencias nuevas», ni el checklist de seguridad
—obligatorio porque el PR toca `package.json`… bueno, no lo toca, pero sí `src/app/`—, ni «Rollback».

Lo que lo vuelve bloqueante y no cosmético es la segunda mitad: **el informe de revisión del agy, publicado como
comentario, declara todo verde y no menciona el check que está fallando.** Dice «`typecheck` exit 0, `lint`
exit 0, `test` exit 0, `build` exit 0» —los cuatro ciertos, los verifiqué— pero el lector se lleva «está todo
bien» cuando CI está en 7 de 8. La bitácora tampoco lo menciona: «**Bloqueos:** ninguno».

La skill `revisar-pr` paso 3 lo pone así de literal: «**Evidencia:** checks sin salida pegada o bitácora sin la
sesión final → BLOQUEANTE».

- **Qué hacer:** rellenar el cuerpo con la plantilla, y que la evidencia incluya el estado de CI job por job, no
  solo los cuatro comandos locales. El informe de la sección «Informe de revisión de agy» lo pega Lautaro073 con
  el que produzca esta revisión cuando la ronda dé sin bloqueantes, como dice el comentario de la plantilla.
- `P19-cuerpo-de-pr-fuera-de-template`

---

### `H02` · Las dos animaciones que sí llegan al usuario ignoran el movimiento reducido; las que lo respetan no animan nada

Este es el más importante del informe.

El sistema de presets existe, respeta `prefers-reduced-motion` y funciona —lo comprobé, ver `H08`—. El problema
es que **nada lo usa**. Busqué consumidores de `MOTION_PRESETS`, `getMotionPreset`, `AnimatedBox`,
`data-motion-preset` y `data-reduced-motion` en todo `src/`: los únicos que aparecen son el propio
`motion/index.tsx` y la suite de pruebas. Ni un componente de `src/ui`, ni `providers.tsx`.

Y las animaciones que sí se renderizan en cada pantalla no pasan por ahí:

| Dónde | Qué | ¿Respeta movimiento reducido? |
|---|---|---|
| `src/ui/skeleton.tsx:15` | `animate-pulse` en **todo** Skeleton | ❌ no |
| `src/ui/button.tsx:68` | `animate-spin` en el `Loader2` de cada botón pendiente | ❌ no |
| `src/ui/motion/index.tsx:182` | `transition-opacity duration-200` fija en `AnimatedBox` | ❌ no (la clase se aplica igual) |

No hay ninguna `@media (prefers-reduced-motion: reduce)` en `tokens.css`, en `globals.css` ni en ningún lado:
`grep -rn "prefers-reduced-motion" src/ --include=*.css` no devuelve nada. Tailwind no agrega la guarda sola.

O sea: una persona que pidió menos movimiento en su sistema ve girar el spinner y pulsar todos los skeletons —que
son la pantalla entera mientras carga—, y a cambio obtiene que cuatro presets que nadie renderiza le devuelvan
`x: 0`.

Hay un tercer detalle en la misma línea: **`AnimatedBox` tampoco aplica su preset.** Calcula `activePreset`
(`motion/index.tsx:176`) y lo único que hace con él es escribirlo en `data-motion-preset`. `durationMs`, `easing`,
`initial`, `animate` y `exit` no llegan a ningún estilo. El preset es dato sin consumidor.

La regla 60 lo lista como bloqueante explícito: «animación fuera de los presets o que ignora el movimiento
reducido → BLOQUEANTE».

- **Qué hacer:** con `D01` resuelto, esto se resuelve solo en gran medida: `motion` de verdad, con
  `MotionConfig reducedMotion="user"`, apaga las animaciones de sus componentes. Para `animate-pulse` y
  `animate-spin`, que son CSS de Tailwind y no de Motion, hace falta la guarda explícita en `tokens.css`:
  `@media (prefers-reduced-motion: reduce) { .animate-pulse, .animate-spin { animation: none } }` o el equivalente
  con `motion-safe:` en las clases.
- **Cómo demostrarlo en rojo primero:** una prueba que renderice `<Skeleton />` y `<Button isPending />` con
  `matchMedia` devolviendo `matches: true` y exija que ninguno tenga clase de animación activa.
- `P08-control-no-cubre-lo-que-dice`

---

### `H03` · `ConfirmDialog` tiene 0 % de cobertura y la prueba que dice ejercitarlo afirma sobre un `vi.fn()` que nunca se conecta

`src/ui/ui-system.test.tsx:264` se llama *«ejercita ConfirmDialog, Sheet (cierre con Escape), AnimatedBox y
notify.info / notify.promise»*. Adentro:

- **`ConfirmDialog` no se importa.** La lista de imports (líneas 7-57) no lo incluye. El test renderiza `Dialog`.
- La línea 266 crea `const onConfirm = vi.fn()` y la 293 afirma `expect(onConfirm).not.toHaveBeenCalled()`. Ese
  `vi.fn()` **no se pasa a ningún componente**. La aserción no puede fallar: es la definición de `P04`.

El reporte de cobertura lo confirma sin ambigüedad: `dialog.tsx` líneas **229-262 sin cubrir**, que son
exactamente el cuerpo entero de `ConfirmDialog`. Y la mutación M4 —desconectar el botón Confirmar— dejó la suite
en verde.

Qué queda sin verificar, concretamente: que confirmar llame a `onConfirm`; que `preventCloseOnEscape={isPending}`
impida cerrar con `Esc` mientras la acción está en curso; que el botón Volver cierre. Es el componente que la
propia documentación del archivo (`dialog.tsx:225-226`) reserva para **«acciones irreversibles (aceptar oferta,
cancelar solicitud, suspender repartidor)»**.

- **Qué hacer:** importar `ConfirmDialog`, renderizarlo, y cubrir los tres casos. Borrar la aserción sobre
  `onConfirm` desconectado o conectarla.
- `P04-test-tautologico`

---

### `H04` · La cláusula Anti-12px se verifica leyendo un archivo que no tiene tipografía

`src/ui/ui-system.test.tsx:92-98`:

```ts
const tokensCss = fs.readFileSync(path.resolve('src/ui/tokens.css'), 'utf-8');
expect(tokensCss).toContain('--radius: 0.625rem');
expect(tokensCss).not.toMatch(/font-size:\s*(10|11|12|13)px/i);
expect(tokensCss).not.toMatch(/0\.75rem/i);
```

`tokens.css` son 60 líneas de variables de color, tres clases `.badge-*` y `.safe-area-bottom`. **No contiene la
cadena `font-size` ni una sola vez.** Las dos aserciones negativas son vacías: no pueden fallar sobre este archivo
porque el archivo no habla de tipografía.

El piso real lo impone `tailwind.config.ts`, que remapea `xs` y `sm` a `0.875rem` —y que, dicho sea, es una
solución elegante: hace que `text-xs` rinda 14 px en vez de prohibirlo—. Pero ese archivo no está en Archivos
permitidos, la prueba nunca lo lee, y la mutación M1 lo demuestra: devolví `xs` a `0.75rem` y los 116 casos
siguieron pasando.

Tampoco cubre la otra vía de romper el piso: un `style={{ fontSize: '12px' }}` en línea. El barrido de
arbitrarios sí atrapa `text-[12px]` (`text` está en su lista), pero no el `style` inline.

- **Qué hacer:** que la prueba lea `tailwind.config.ts` y afirme que ninguna parada de `fontSize` está por debajo
  de `0.875rem`, más un barrido de `fontSize:` en línea sobre `src/ui/**`. Requiere que `tailwind.config.ts` pase
  a ser legible por la prueba (leerlo no necesita permiso de escritura; modificarlo sí).
- `P04-test-tautologico` · `P08-control-no-cubre-lo-que-dice`

---

### `H05` · S00 tiene una violación de accesibilidad real y `auditElementAccessibility` reporta 0

Con el `Select` cerrado —que es su estado inicial en el showcase—, `SelectContent` renderiza
`<div className="hidden">{children}</div>` (`select.tsx:117`). Los `SelectItem` siguen montados, así que el DOM
queda con **dos `<button role="option">` sin ningún ancestro `role="listbox"`**.

Eso es `aria-required-parent`, una de las reglas nucleares de axe. Lo verifiqué con un probe:

```
✗ ninguna opción debería quedar huérfana
  → expected [ 'Centro', 'Barrio Norte' ] to deeply equal []
✓ auditElementAccessibility(container).violations → []
```

Las dos aserciones en la misma prueba: la auditoría del PR dice que no hay violaciones sobre el mismo DOM en el
que las hay.

La causa es estructural y vale entenderla, porque `D03` no la resuelve sola. `auditElementAccessibility` tiene
cinco reglas y **está escrita para HTML nativo**:

| Regla | Qué mira | Problema en este sistema de diseño |
|---|---|---|
| 1 | `verifyTokenContrastMatrix()` | **No mira el DOM.** Ignora el argumento `root`: da lo mismo con cualquier elemento |
| 2 | `button, a[href]` tienen nombre | ok |
| 3 | `input, textarea, select` tienen label | **El sistema reemplazó los nativos**: el Select es un `<button>`, así que esta regla no lo alcanza nunca |
| 4 | `img, [role="img"]` tienen alt | ok |
| 5 | `[role="dialog"]` tiene `aria-modal` | ok |

No hay ninguna regla de estructura ARIA (`aria-required-parent`, `aria-required-children`), ni de orden de
encabezados, ni de `id` duplicados, ni de foco visible.

- **Qué hacer:** que `SelectContent` no renderice los ítems cuando está cerrado, o que el contenedor cerrado
  conserve el `role="listbox"`. Y, con `D03` resuelto, renombrar la función para que no se presente como
  «equivalente a las reglas nucleares de axe» (`design-system-showcase.tsx:23`), porque no lo es.
- `P08-control-no-cubre-lo-que-dice` · `P13-accesibilidad-no-considerada`

---

### `H06` · `FormMessage` no queda enlazado al control: el mensaje no tiene `id` y el input no tiene `aria-describedby`

`form.tsx:188-203` renderiza `<p role="alert">` con el error, **sin `id`**. `FormControl` (`form.tsx:177-179`) es
un `<div className="w-full">` que no cablea nada. `FormItem` no genera identificadores. Resultado: quien usa el
formulario tiene que poner a mano `id`, `htmlFor` y `aria-invalid` —como hace la propia prueba en las líneas
239-246— y **no hay forma de poner `aria-describedby`**, porque el mensaje no tiene a qué apuntar.

Probe:

```
✗ el input inválido debería apuntar al mensaje de error
  → expected null not to be null   (msg.getAttribute('id') === null)
```

En shadcn/ui esa es precisamente la pieza que `FormControl` resuelve: genera `formMessageId`, lo cuelga del
control con `aria-describedby` y marca `aria-invalid`. Acá el componente existe con el mismo nombre y no hace
nada.

Por qué lo pongo como bloqueante y no como mejora: **es plantilla**. Es el formulario que van a componer todas
las tareas T-1xx. `P12-plantilla-propaga-antipatron` describe justo esto: un error en andamiaje que se va a
copiar. Y `auditElementAccessibility` no lo va a ver nunca, porque su regla 3 mira etiquetas, no descripciones.

- **Qué hacer:** con `D01` resuelto, `react-hook-form` + el `FormControl` real de shadcn lo traen resuelto. Si por
  algo se mantiene la versión propia, `FormItem` tiene que generar `useId()` y `FormControl` cablear
  `aria-describedby` y `aria-invalid`.
- `P12-plantilla-propaga-antipatron` · `P13-accesibilidad-no-considerada`

---

### `H07` · El barrido de valores arbitrarios usa una lista fija de prefijos

`ui-system.test.tsx:343-344` define el regex con 33 prefijos enumerados a mano. Los que no están en la lista pasan
sin ser vistos. Probe con ocho clases arbitrarias reales:

```
shadow-[0_0_0_9999px_red]   ring-[3px]        size-[13px]       inset-[7px]
translate-y-[11px]          grid-cols-[1fr_auto]  duration-[3000ms]  opacity-[0.03]
```

**Las ocho escapan.** Y la mutación M3 lo confirma de punta a punta: metí tres de ellas en `card.tsx` y la suite
quedó en verde.

Dos de esas importan de verdad en este proyecto: `size-[13px]` rompe la cláusula Anti-12px por una vía que
`text-` no cubre, y `duration-[3000ms]` rompe el techo de 300 ms que el propio archivo de presets se impone.

- **Qué hacer:** invertir la lógica. En vez de enumerar prefijos prohibidos, buscar el patrón de valor arbitrario
  `-\[...\]` y permitir explícitamente las variantes ARIA y de estado (`aria-[...]`, `data-[...]`,
  `supports-[...]`), que son las legítimas y hoy son las dos únicas del repositorio
  (`input.tsx:17`, `textarea.tsx:16`).
- `P06-enumeracion-incompleta` · `P07-coincidencia-demasiado-amplia`

---

### `H08` · Nada ejercita la detección real de `prefers-reduced-motion`

La prueba 5 (`ui-system.test.tsx:191-210`) llama `getMotionPreset(name, true)` pasando el booleano a mano. Verifica
la función pura, que está bien. Lo que no verifica es **de dónde sale ese booleano**.

La cobertura lo dice: `motion/index.tsx` líneas **30-41 sin cubrir**, que son el `useEffect` completo —el
`window.matchMedia('(prefers-reduced-motion: reduce)')`, el `setSystemReduced` inicial y el listener de cambios—.
La mutación M5 lo confirma: reemplacé `setSystemReduced(mediaQuery.matches)` por `setSystemReduced(false)`, que es
apagar la detección entera, y la suite quedó verde.

**Una aclaración importante, porque estuve a punto de reportar esto mal:** escribí un probe con `matchMedia`
devolviendo `matches: true` esperando que fallara, y **pasó**. La implementación es correcta. El defecto es
únicamente que ninguna prueba del repositorio la ejercita, así que puede desaparecer sin que nada avise. Si me
hubiera quedado con la lectura del código habría reportado un defecto inexistente.

- **Qué hacer:** llevar ese probe a la suite: sustituir `window.matchMedia`, renderizar `MotionConfig` y afirmar
  que `AnimatedBox` marca `data-reduced-motion="true"`, y que al emitir el evento `change` la marca cambia.
- `P04-test-tautologico` · `P08-control-no-cubre-lo-que-dice`

---

### `H09` · El foco automático al abrir el Dialog no lo verifica nada

`ui-system.test.tsx:145-147`:

```ts
// Al abrir, el primer elemento enfocable recibe foco
cancelBtn.focus();
expect(document.activeElement).toBe(cancelBtn);
```

El comentario afirma un comportamiento del componente; las dos líneas siguientes **enfocan el elemento y después
afirman que está enfocado**. La aserción es cierta con el `useEffect` de `dialog.tsx:101-111` y sin él.

Mutación M2: saqué el foco automático al abrir y la suite quedó verde.

La trampa de foco en sí (Tab y Shift+Tab ciclando) sí está bien probada, y el ciclado está bien implementado:
solo intercepta en el primero y el último, dejando que el navegador maneje el medio. Eso es correcto y no lo
toqué. El problema es solo la primera aserción.

- **Qué hacer:** renderizar el Dialog abierto y afirmar `document.activeElement` **sin llamar a `.focus()` antes**.
- `P03-comentario-contradice-codigo` · `P04-test-tautologico`

---

## 5. Mejoras

### `H10` · `notify` no reemplaza: suprime — y el id puede quedar tomado para siempre

El comentario de `notify.ts:81` dice «**Reemplaza**/deduplica toasts por `id`». No reemplaza:
`emitDeduplicated` (`notify.ts:58-60`) hace `return resolvedId` si el id ya está en el `Set`, así que la segunda
llamada **nunca llega a Sonner**. Sonner, con el mismo `id`, actualizaría el toast y reiniciaría el temporizador.

Dos consecuencias:

1. **Un aviso de otra acción se pierde.** El id por defecto de `notify.success` es `toast:success:${message}`
   (`notify.ts:85`), o sea el texto. Dos ofertas a dos solicitudes distintas dan «Oferta enviada» las dos veces, y
   la segunda no se ve. Probe: `expected "spy" to be called 2 times, but got 1 times`.
2. **El id se libera solo por `onDismiss`/`onAutoClose`** (`notify.ts:67-72`), y el reporte de cobertura marca
   esas cuatro líneas **sin cubrir**. Si el `<Toaster />` se desmonta sin disparar el callback, ese mensaje queda
   suprimido por el resto de la sesión. Mutación M8: dejé `onDismiss` vacío —que es el peor caso— y la suite quedó
   verde.

Que exista `_resetActiveToastsForTests()` es la señal: el `Set` a nivel de módulo ya se filtraba entre pruebas y
se resolvió limpiándolo, en vez de mirar si se filtra también en la aplicación.

Lo que baja la severidad: la regla 60 y `AGENTS.md` §2 dicen que el aviso nunca es la única señal de un cambio
importante, así que perder un toast no pierde información.

- **Qué hacer:** dejar que Sonner haga su trabajo —llamar siempre a `toast.*` con el `id`, que reemplaza— y
  reservar el `Set` para lo que de verdad haga falta. Y cubrir el camino de liberación.
- `P03-comentario-contradice-codigo`

### `H11` · `sanitizeToastMessage` no reconoce el formato que produce `formatPhone` en este mismo PR

`notify.ts:46-49` dice «Regla 60: Nada de datos personales (ej. teléfonos) en un toast» y filtra con
`/\+?54\s*9?\s*\d{6,12}/g`: exige el prefijo `54`. `formatPhone('3865123456')` devuelve `3865 12-3456`
(`format/index.ts:111`), sin prefijo. Probe:

```
✗ expected 'Coordiná el retiro al 3865 12-3456' not to contain '3865 12-3456'
```

Las dos funciones son de este PR. La que protege no reconoce lo que produce la que formatea. Además ninguna
prueba cubre `sanitizeToastMessage`, aunque el informe del agy lo lista como entregado.

No es bloqueante hoy porque ninguna feature existe todavía para pasarle un teléfono. Sí conviene cerrarlo antes de
T-1xx, que es cuando `delivery_request_contacts` empieza a moverse.

- **Qué hacer:** filtrar por la forma nacional además de la internacional, y cubrirlo con una prueba que use la
  salida de `formatPhone` en vez de una cadena inventada.
- `P08-control-no-cubre-lo-que-dice`

### `H12` · El Select muestra el value crudo en el primer pintado

`SelectItem` registra su etiqueta en un `useEffect` (`select.tsx:141-143`) sobre un `Map` guardado en `useState`.
Mutar el `Map` no dispara re-render, así que en el primer pintado `SelectValue` ya se resolvió con el `Map` vacío
y cae en `items.get(value) ?? value`. Probe sobre el showcase:

```
✗ expected 'centro' to be 'Centro'
```

S00 muestra `centro` en minúscula donde la opción dice «Centro». Con `D01` resuelto desaparece al pasar a Radix.

- `P01-contrato-de-framework-no-verificado`

### `H13` · La matriz de contraste no incluye los pares que usan `.badge-success` ni `bg-muted`

`verifyTokenContrastMatrix` cubre seis pares. Reproduje los ratios de **todos** los pares de color que los
componentes usan de verdad:

| Par | Dónde | Ratio | AA | ¿En la matriz? |
|---|---|---|---|---|
| `#177A4B` sobre `#F0FDF4` | `.badge-success` (delivered, verified) | 5,12 | ✅ | ❌ |
| `#5B6475` sobre `#F3F4F6` | `bg-muted text-muted-foreground` (expired) | 5,41 | ✅ | ❌ |
| `#0B7A7D` sobre `bg-primary/15` | `EmptyState`, `SelectItem` seleccionado | **4,48** | ⚠️ | ❌ |
| `#FFFFFF` sobre `#12182C` | `bg-secondary` (matched) | 17,61 | ✅ | ❌ |

**Ninguno falla hoy.** El tercero está 0,02 por debajo del umbral de texto, pero envuelve un ícono
`aria-hidden` —gráfico no textual, umbral 3:1—, así que tampoco es violación. El hallazgo es que el control no los
mira: mutación M6b, puse `--accent` en verde oscuro dejando `.badge-success` en **1,06:1** y la suite quedó verde.

La razón estructural es que `DESIGN_TOKENS.colors` (`tokens.ts:2-14`) **no tiene `accent`**: el color solo existe
en `tokens.css`. La matriz no puede mirar lo que su fuente de datos no conoce.

- **Qué hacer:** que los pares salgan de una lista declarada junto a las clases que los usan, y agregar `accent` y
  `muted` a `DESIGN_TOKENS`.
- `P06-enumeracion-incompleta`

### `H14` · `BRAND_ASSET_PATHS` exporta cuatro rutas de `public/` que hoy son 404

`brand-logo.tsx:4-9` exporta `/brand/logo.svg`, `/brand/logo.webp`, `/icon-192x192.png` y `/icon-512x512.png`.
`public/` está vacío: probe, las cuatro faltan. Está en el barrel de `src/ui`, así que cualquier tarea T-1xx puede
consumirlo y publicar una imagen rota. Se cierra con `D02`.

- `P15-entregable-declarado-pero-no-ejecutable`

### `H15` · El ratio AAA del botón primario es 7,35:1, no 6,93:1 — y el umbral de la prueba no es el de WCAG AAA

`#12182C` sobre `#09BABD` da **7,35:1**. Lo calculé dos veces: con `getContrastRatio` del propio PR y con una
implementación independiente. El número `6,93:1` aparece en tres lugares —`tokens.css:12`, el cuerpo del informe
del agy y la bitácora— y también en la ficha `T-008.md`, o sea que viene del plan (T-001), no del agy.

Aparte, `verifyTokenContrastMatrix` usa **6.9** como umbral AAA del botón (`tokens.ts:118`) mientras usa **7.0**
para la tinta sobre fondo (`tokens.ts:119`). El umbral AAA de WCAG 2.2 es 7,0. Con 6,9, un cambio de token que
deje el ratio en 6,95 «pasa AAA» sin pasarlo.

- **Qué hacer:** corregir el número en `tokens.css` y en `docs/tasks/T-008.md`, y subir el umbral a 7.0.
- `P03-comentario-contradice-codigo`

### `H16` · `BRAND_LOGO_SVG_MARKUP` duplica el SVG que `<BrandLogo />` renderiza

El mismo SVG está dos veces en `brand-logo.tsx`: como cadena en la línea 12 y como JSX en las líneas 45-68. La
prueba mide la cadena; el usuario ve el JSX. Mutación M7: cambié el color de marca del JSX a magenta y la suite
quedó verde. El control de tamaño sí protege, porque también mide el archivo completo.

- `P03-comentario-contradice-codigo`

### `H17` · El Select no tiene teclado ni forma de cerrarse

No hay flechas, ni `Home`/`End`, ni `Escape`, ni clic afuera, ni `aria-controls` que una el disparador con el
listbox, ni `aria-activedescendant`. Una vez abierto solo se cierra eligiendo una opción. La cobertura muestra las
líneas 43-48 y 119-131 sin cubrir: **el Select nunca se abre ni selecciona en ninguna prueba**. Se cierra con
`D01` al pasar a Radix, que trae todo eso.

- `P13-accesibilidad-no-considerada`

### `H18` · El Dialog no devuelve el foco al disparador al cerrarse

`DialogContent` mueve el foco al abrir (`dialog.tsx:101-111`) y no lo restaura al cerrar. WCAG 2.4.3 espera que
vuelva al elemento que abrió el diálogo; si no, el foco cae al `<body>` y quien navega con teclado vuelve a
empezar desde arriba. Tampoco hay bloqueo de scroll del fondo ni cierre al clicar el overlay. Se cierra con `D01`.

- `P13-accesibilidad-no-considerada`

### `H19` · El `<Toaster />` real nunca se renderiza

`toaster.tsx` queda en 12,5 % de cobertura porque la única suite que lo toca hace `vi.mock('sonner')`
(`ui-system.test.tsx:61-69`) y lo sustituye por un `<div>`. La configuración centralizada —`position`, `duration`,
los `classNames`— no la verifica nada. Es lo que la regla 60 pide que esté definido «una sola vez», así que vale
una prueba que renderice el componente real.

- `P08-control-no-cubre-lo-que-dice`

---

## 6. Checks

Todo en un worktree detached (`git worktree add --detach ../cadeApp-rev59 e3c1a4d`) con
`pnpm install --frozen-lockfile`. **El árbol compartido con el agy no se tocó y nunca se cambió de rama.**

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ exit 0 · `✔ No ESLint warnings or errors` |
| `pnpm test` | ✅ **13 archivos · 116 casos** + 19 workflows + 6 ADR |
| `pnpm test:coverage` | ✅ exit 0 — pero el umbral solo alcanza `src/domain/**`; `src/ui` queda en **64,15 % de ramas** (ver `D04`) |
| `pnpm test:db` | n.a. — este entorno no tiene Docker. En CI `db-tests` pasa |
| CI en `e3c1a4d` | ⚠️ **7 de 8**: `approval-policy` en rojo (ver `H01`) |
| Alcance | ✅ 28 archivos, **0 fuera** de la ficha |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |

Los cuatro comandos que el informe del agy declara verdes lo están. El que falta declarar es `approval-policy`.

## 7. Veredicto

**CON BLOQUEANTES (9).** No apruebo ni mergeo.

El trabajo tiene volumen y disciplina reales: cero dependencias no autorizadas, cero construcciones prohibidas,
tokens correctos, piso tipográfico respetado, y una matriz de contraste que calcula de verdad. Lo que falla no es
el código, es **lo que lo verifica**: ocho de los nueve controles del DoD que muté dejaron la suite en verde.
Eso, más las dos animaciones que ignoran el movimiento reducido y el formulario que no enlaza sus errores, es lo
que hay que cerrar antes del merge.

Las cuatro decisiones ya están tomadas, así que la ronda 2 entra con la ficha ampliada y no hay nada esperando.
