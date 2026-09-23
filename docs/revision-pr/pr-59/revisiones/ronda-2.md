# PR #59 · T-008 — Ronda 2

- **PR:** [#59](https://github.com/cadeApp/cadeApp/pull/59) · `feat/T-008-ui-tokens-d16` → `develop`
- **Tarea:** `T-008` · Issue #9
- **Estado revisado:** ⚠️ **árbol de trabajo sin commitear**, capturado a las 02:50 del 2026-09-23.
  El head del PR sigue siendo `2491a4c`, que es el commit de la ronda 1.
- **Fecha:** 2026-09-23
- **Resultado: CON BLOQUEANTES (4)** · 2 regresiones · 8 mejoras · 3 decisiones resueltas antes de escribir

---

## 0. Lo primero: esto no está commiteado

Al abrir la ronda encontré 29 archivos modificados y dos carpetas sin trackear en el árbol compartido, y **nada
de eso está en ningún commit**. `origin/feat/T-008-ui-tokens-d16` sigue en `2491a4c`. La bitácora
`docs/tasks/log/T-008.md` no tiene entrada nueva: la última sigue siendo la del 2026-09-22 23:41, que describe
la ronda 1.

`AGENTS.md` §5: *«Al terminar CADA sesión: skill `cerrar-sesion` (bitácora, commit, push). **Nunca dejes trabajo
solo en tu máquina**: otra persona puede necesitar retomarlo.»* Y `COMO-ENTREGAR.md` registra que en la #49 un
revert se llevó puesto trabajo sin commitear y hubo que reconstruirlo.

**Consecuencia directa sobre este informe:** ningún hallazgo puede llevar `verificado_en_sha`, porque no hay SHA.
Todo lo que verifiqué acá lo verifiqué de verdad —ejecutando, con mutaciones y con un probe— pero sobre un
snapshot que puede no coincidir con lo que finalmente se commitee. **La ronda 3 tiene que revalidar todo contra
el commit**, y eso es una ronda entera que se paga por no haber cerrado la sesión.

Para no tocar el árbol compartido copié los 29 archivos a un worktree detached (`../cadeApp-rev59b`) desde
`2491a4c` y corrí todo ahí.

---

## 1. Lo que se arregló, y cómo lo comprobé

La ronda 1 dejó un dato: **8 de 9 controles del DoD eran ciegos**. Volví a correr la misma batería de mutaciones
sobre el código nuevo, más cuatro mutaciones nuevas para lo que se agregó.

| # | Rompí | Ronda 1 | Ronda 2 |
|---|---|---|---|
| M1 | la escala `xs` vuelve a 12 px | 🟢 ciego | 🔴 **vivo** |
| M2 | saco el foco automático al abrir el Dialog | 🟢 ciego | 🟢 **sigue verde** (ver `H09`) |
| M3 | meto `shadow-[…] ring-[3px] size-[13px]` en `src/ui` | 🟢 ciego | 🔴 **vivo** |
| M4 | desconecto el botón Confirmar de `ConfirmDialog` | 🟢 ciego | 🔴 **vivo** |
| M5 | `MotionConfig` deja de leer la preferencia del sistema | 🟢 ciego | 🔴 **vivo** |
| M6 | `mutedForeground` a 2,42:1 | 🔴 vivo | 🔴 **vivo** |
| M6b | `--accent` de `tokens.css` deja `.badge-success` en 1,06:1 | 🟢 ciego | 🟢 **sigue verde** (ver `H22`) |
| M8 | `notify` deja de pasarle el `id` a Sonner | 🟢 ciego | 🔴 **vivo** |
| M9 | saco la guarda CSS de movimiento reducido | — | 🔴 **vivo** |
| M11 | `FormControl` deja de apuntar al mensaje de error | — | 🔴 **vivo** |
| M12 | borro uno de los cuatro assets de `public/` | — | 🔴 **vivo** |
| M13 | `notify` deja de sanitizar el mensaje | — | 🔴 **vivo** |

**De 1 control vivo sobre 9, a 10 sobre 12.** Es el cambio más importante de la ronda y no es cosmético: cada
rojo de esa columna es una propiedad del DoD que ahora no se puede romper en silencio.

### Tres arreglos que vale nombrar por separado

**`BrandLogo` se arregló mejor de lo que yo pedí.** Yo había sugerido comparar la cadena
`BRAND_LOGO_SVG_MARKUP` con lo renderizado. Lo que se hizo es más fuerte: las dos formas ahora se **derivan de
un único `BRAND_LOGO_GEOMETRY`** (`brand-logo.tsx:12-39`). No hay que comparar nada porque ya no pueden
divergir. Por eso la mutación M7 de la ronda 1 ya no tiene dónde aplicarse: la clase se cerró de raíz, no caso
por caso. Es el mismo patrón que `AG-48` de la #58.

**Las cuatro decisiones se aplicaron enteras y trazadas.** Cada línea nueva de «Archivos permitidos» cita la
decisión que la autoriza (`(D01 Lautaro073)`, `(D02 Lautaro073)`…). Los siete paquetes nuevos están en la tabla
de la regla 25 §1 y se sumaron a `tools/verify-approved-packages.test.ts`. `pnpm install --frozen-lockfile`
resuelve en 52 s, o sea que `package.json` y el lockfile coinciden.

**La cobertura de `src/ui` pasó de 88,75 % / 64,15 % de ramas a 98,09 % / 89,39 %**, con umbral real de 80 por
archivo (`perFile: true`). `toaster.tsx` fue de 12,5 % a 100 %. El archivo más justo es `sheet.tsx` con 80,48 %
de ramas: pasa por medio punto.

---

## 2. Bloqueantes

### `H20` · Los ocho archivos de `assets/` fueron sobrescritos, siete quedaron más pesados, y `assets/**` no está en «Archivos permitidos»

Esto es lo más serio de la ronda y no lo vi hasta comparar byte a byte.

| archivo | antes | ahora | |
|---|---|---|---|
| `assets/1.svg` | 1.187.143 | 2.258.151 | +90 % |
| `assets/2.svg` | 891.716 | 1.314.059 | +47 % |
| `assets/3.svg` | 226.793 | 1.151.253 | **+408 %** |
| `assets/4.svg` | 626.966 | 2.596.324 | **+314 %** |
| `assets/5.svg` | 261.631 | 1.712.594 | **+555 %** |
| `assets/6.svg` | 1.009.031 | 465.150 | −54 % |
| `assets/7.svg` | 753.411 | 2.117.089 | **+181 %** |
| `assets/8.svg` | 1.298.709 | 2.271.459 | +75 % |
| **total** | **6,45 MB** | **13,9 MB** | **+115 %** |

`assets/**` no figuraba en «Archivos permitidos» antes de las decisiones y **tampoco después**: la lista quedó
con `public/**`, `src/app/design-system/**`, `package.json`, `pnpm-lock.yaml`, `vitest.config.ts` y los dos
`tools/`, ninguno de ellos `assets/`. `AGENTS.md` §1.3: *«Tocá SOLO los archivos de "Archivos permitidos". Si
necesitás otro, detenete y explicá por qué.»* No hay explicación en la bitácora, porque no hay entrada nueva.

Y el efecto va en la dirección contraria a la que la tarea pide: la ficha habla de «SVGs **optimizados**», y
siete de ocho fuentes de marca quedaron entre 1,5× y 6,5× más pesadas. Se duplicó el peso del repositorio en
archivos que nadie pidió tocar y que son el original del que sale todo lo demás.

- **Qué hacer:** `git checkout -- assets/` y dejarlos como estaban. Si hace falta reoptimizarlos, es su propia
  tarea con su ficha.
- `P10-desvio-de-ficha-sin-consultar`

---

### `H21` · `public/brand/logo.svg` pesa 1,28 MB contra un presupuesto de 5 KB, y es una copia byte a byte de `assets/2.svg`

`md5sum` da el mismo hash para `assets/2.svg` y `public/brand/logo.svg`: `377c2c23…`. No es una versión
optimizada del logo; es el export crudo, copiado.

| archivo | peso | presupuesto |
|---|---|---|
| `public/brand/logo.svg` | **1.314.059 B (1,25 MB)** | < 5 KB → **256×** |
| `public/brand/logo.webp` | **798.777 B (780 KB)** | — |
| `public/icon-192x192.png` | 15.893 B | ok |
| `public/icon-512x512.png` | 82.281 B | ok |

El objetivo de la ficha, literal: *«componente `<BrandLogo />` con SVGs **optimizados (< 5 KB)** y WebP en
`public/brand/` (**sin importar los archivos fuente de `assets/`** directo al bundle)»*. Formalmente no se
importan al bundle, pero se publican tal cual, que es el mismo problema con otro transporte.

Además el SVG arrastra el manifiesto del exportador:

```
<svg ... xmlns:c2pa="http://c2pa.org/manifest"><metadata><c2pa:manifest>AABCIWp1bWIA…
```

Son cientos de KB de metadatos base64 de Canva, incluida la marca de que el original se generó con IA. Eso se
sirve a cada persona que abra la app.

Contexto de por qué importa acá y no en cualquier proyecto: cadeApp es una PWA para Aguilares, en celular. Dos
megas de logo es más que todo el JavaScript de la aplicación, que el presupuesto acota a 180 kB.

Y el control nuevo no lo ve: la prueba `H14 y D02` (`ui-system.test.tsx:514`) comprueba que los cuatro archivos
**existen**, no cuánto pesan. La mutación M12 —borrar uno— sí pone la suite en rojo, así que el control está
vivo para lo que mide; lo que le falta es medir el peso.

- **Qué hacer:** generar un SVG real de menos de 5 KB (el `BRAND_LOGO_SVG_MARKUP` que ya existe pesa ~1,5 KB y
  sirve), un WebP razonable para el logo, y sumar a la prueba una aserción de tamaño por archivo. Con eso M12
  pasa a cubrir existencia **y** presupuesto.
- `P15-entregable-declarado-pero-no-ejecutable` · `P08-control-no-cubre-lo-que-dice`

---

### `R01` · Regresión: al arreglar `H10` desaparecieron `DOMAIN_ERROR_MESSAGES` y `notify.promise`

`notify.ts` se reescribió entero —correctamente, en lo que yo había pedido— y en el camino se fueron dos cosas
que no eran parte del hallazgo.

`grep -rn "DOMAIN_ERROR_MESSAGES" src/` no devuelve **nada** en todo el repositorio. En la ronda 1 eran 27
mensajes en es-AR, uno por cada `DomainErrorCode`, con una prueba que recorría `ALL_DOMAIN_ERROR_CODES` y exigía
que ninguno faltara. Hoy `notify.error(message: string)` recibe una cadena suelta y no hay ningún lugar que
traduzca un código a texto.

`notify.promise` tampoco existe. La regla 60 línea 23 nombra las cuatro: *«usan `notify.success`, `notify.error`,
`notify.info` y `notify.promise` de `src/ui/notify.ts`»*. Y la línea 26: *«Errores de acciones: `notify.error`
con el mensaje del `DomainErrorCode`»*.

Nada se rompe al compilar, porque todavía no hay features que las usen. Lo que se perdió es capacidad, en
silencio, junto con la prueba que la cubría — y el ítem del DoD *«Tests del `notify` (usa los mensajes…)»* queda
sin nada que lo sostenga.

Es la cuarta regresión del proyecto y la segunda que sale de un arreglo pedido por esta revisión. `PR47-R01` y
`PR48-H06` son la misma forma: *arreglar introduce regresiones*, que es literalmente lo que advierte
`COMO-ENTREGAR.md`. Que yo haya pedido «dejá que Sonner haga su trabajo» no incluía «sacá el diccionario»;
igual, el pedido fue mío y el archivo se reescribió entero por él.

- **Decidido por Lautaro073 (`D05`):** crear `src/lib/error-messages.ts`, que es donde la regla 60 dice que
  viven, sumarlo a «Archivos permitidos», que `notify.error` vuelva a aceptar `DomainErrorCode | string`, y
  restaurar `notify.promise`. Con la prueba que recorre `ALL_DOMAIN_ERROR_CODES`.
- `P11-api-publica-inconsistente`

---

### `H01` · Sigue abierto: `approval-policy` continúa en rojo y el informe del cuerpo quedó desactualizado

El cuerpo del PR ahora **sí** tiene el encabezado `### Informe de revisión de agy`, que en la ronda 1 no estaba.
Pero `approval-policy` sigue fallando (run `35819462013`, sobre `2491a4c`), y la razón es la que el comentario de
la plantilla anticipa: *«approval-policy busca esas líneas y un resumen en prosa lo hace fallar»*.

`hasCompleteReport()` exige seis cadenas literales. El cuerpo no tiene ninguna:

| Espera | El cuerpo dice |
|---|---|
| `Informe revisar-pr — T-008` | `### Informe de revisión de agy` |
| `Resultado: SIN BLOQUEANTES` | `**Bloqueantes: 0**` |
| `Checks locales:` | — |
| `BLOQUEANTES:` | `**Bloqueantes: 0**` (minúscula: no matchea) |
| `MEJORAS:` | — |
| `No revisado / dudas para Lautaro073:` | — |

Y el contenido quedó viejo respecto del trabajo: dice `6.93:1` (son 7,35), afirma que existe el diccionario
`DOMAIN_ERROR_MESSAGES` (ya no), dice `116 passed` (son 126), dice «SHA revisado `e3c1a4d`» y sobre todo dice
**«Archivos fuera de alcance: 0 (todos dentro de `src/ui/**`, `src/lib/format/**`, `src/app/providers.tsx`…)»**,
que hoy es falso: el PR va a traer `public/`, `src/app/design-system/`, `package.json`, `pnpm-lock.yaml`,
`vitest.config.ts`, dos `tools/` y los ocho `assets/`.

Faltan además las secciones «Qué cambia», «DoD», «Evidencia de checks», «Dependencias nuevas» —que ahora tiene
siete— , «Checklist de seguridad» —obligatorio porque el PR toca `package.json`— y «Rollback».

- **Qué hacer:** completar la plantilla y pegar el informe con el formato literal de la skill. La sección del
  informe la llena Lautaro073 con lo que produzca esta revisión cuando la ronda dé sin bloqueantes.
- `P19-cuerpo-de-pr-fuera-de-template`

---

## 3. Mejoras

### `R02` · Regresión: una sola pulsación de `Escape` invoca `onClose` dos veces

`DialogContent` ahora usa `DialogPrimitive.Content` de Radix **y además** conserva el `handleKeyDown` propio.
Los dos manejan Escape: el propio en `dialog.tsx:144-148` y el de Radix en `onEscapeKeyDown`. Los dos llaman
`onClose?.()`.

```
✗ una sola pulsación de Escape debería llamar onClose una vez
  → expected "spy" to be called 1 times, but got 2 times
```

El `event.stopPropagation()` de la línea 145 no lo evita: detiene la propagación del evento sintético de React,
no el listener nativo que Radix monta en el documento.

Hoy `onClose` no lo usa nadie, así que no rompe nada en producción. En T-1xx, donde va a disparar un
`revalidatePath` o un reset de formulario, sí.

- **Qué hacer:** dejar un solo camino. Como Radix ya trae cierre con Escape, trampa de foco y restauración del
  foco, lo natural es quitar el `handleKeyDown` propio y quedarse con `onEscapeKeyDown` (ver `H28`).

### `H22` · La matriz de contraste ya cubre los pares, pero contra una copia: `tokens.ts` y `tokens.css` no se comparan

El arreglo fue el correcto: `DESIGN_TOKENS.colors` ahora tiene `accent` y `muted`, y la matriz suma
`badgeSuccessAA` y `mutedBadgeAA` (`tokens.ts:89-91`). Y está vivo: cambié `accent` en `tokens.ts` y dos pruebas
se pusieron en rojo.

Lo que queda es el eslabón de atrás. **Lo que se pinta sale de `tokens.css`; lo que se verifica sale de
`tokens.ts`.** Son dos copias independientes de cada color y ningún control las compara. Mutación M6b: cambié
`--accent` en `tokens.css` a verde oscuro, dejando `.badge-success` en **1,06:1**, y la suite quedó verde.

Probe: los hex de `tokens.ts` sí aparecen como comentario al lado de cada variable de `tokens.css`, así que hoy
coinciden. Lo que no existe es la prueba que lo exija — el comentario es prosa.

- **Qué hacer:** una prueba que parsee los HSL de `tokens.css`, los convierta a hex y los compare con
  `DESIGN_TOKENS.colors`. Cubre los veintitantos colores de una, no solo `accent`.
- `P08-control-no-cubre-lo-que-dice`

### `H09` · El foco automático del Dialog ahora lo garantiza Radix, pero el control sigue sin distinguirlo

El test se arregló bien: ya no llama `.focus()` antes de afirmar (`ui-system.test.tsx:209-210`), que era el
defecto exacto de la ronda 1. Pero la mutación M2 —sacar el `focusables[0]?.focus()` de `dialog.tsx:136`— **sigue
dejando la suite en verde**, y la razón no es que el control esté ciego: es que `DialogPrimitive.Content` ya mueve
el foco solo. La propiedad se cumple; el código propio que la duplicaba es redundante.

Lo anoto porque cambia el diagnóstico de la ronda 1: ahí M2 verde significaba «nadie verifica el foco»; acá
significa «hay dos implementaciones y el test no puede decir cuál actúa». Se cierra junto con `H28`.

### `H23` · `T-008` entró a la lista de excepciones de `verify-fichas`, que es para tareas ya mergeadas

`tools/verify-fichas.test.ts:118` suma `'T-008'` a `EXCEPCIONES`, cuyo comentario dice *«todas de tareas **ya
mergeadas**, que se dejan como están para no reescribir el registro de un trabajo cerrado»*. T-008 no está
mergeada: es el PR bajo revisión. El efecto es que su DoD deja de compararse con `docs/implementation-plan.md`
§8, que sigue describiendo el DoD viejo.

- **Decidido por Lautaro073 (`D06`):** sumar `docs/implementation-plan.md` a «Archivos permitidos», actualizar
  ahí el DoD y devolver `EXCEPCIONES` a `T-000, T-001, T-002`.

### `H24` · `backdrop-blur-xs` no existe en Tailwind 3.4: las dos capas de overlay usan una clase que no genera CSS

`dialog.tsx:180` y `sheet.tsx:154`. La escala de `backdropBlur` en tailwindcss 3.4.19 es
`0, none, sm, DEFAULT, md, lg, xl, 2xl, 3xl` — lo comprobé leyendo `tailwindcss/defaultTheme`. `xs` se agregó en
Tailwind 4. La clase no produce nada y el desenfoque simplemente no ocurre.

- **Qué hacer:** `backdrop-blur-sm`.
- `P01-contrato-de-framework-no-verificado`

### `H25` · El nombre de la marca quedó escrito de tres formas y dos son nuevas

`AGENTS.md` y todo el repositorio dicen **`cadeApp`**. El logo nuevo dice `CadeApp` en el `<text>` del SVG y en
su `aria-label` por defecto (`brand-logo.tsx:38` y `:50`), y la ruta de muestra titula
`'Sistema de Diseño (S00) | Cade'` (`src/app/design-system/page.tsx:5`). En la ronda 1 el componente decía
`cadeApp`, así que es un cambio, no algo que venía de antes.

Es el logo y el título de una página: conviene que digan el nombre del producto.

### `H26` · `activeToastIds` quedó como estado muerto y `resetActiveToasts()` es API pública sin efecto observable

`notify.ts:43-47` agrega el id al `Set` y define un `cleanup` que lo borra, pero **nadie lee el `Set`**: la
supresión desapareció (que era el arreglo) y no quedó ninguna lectura en su lugar. `resetActiveToasts()` sigue
exportado desde el barril de `src/ui` y no cambia ningún comportamiento.

- **Qué hacer:** borrar el `Set`, el `cleanup` y `resetActiveToasts()`, o darles un uso. Hoy son tres piezas que
  parecen hacer algo.

### `H27` · El nombre de la prueba de `formatDate` dice «Tucumán» y el código dice «Buenos_Aires»

`ui-system.test.tsx:93` se titula *«formatDate formatea en huso horario `America/Argentina/Tucuman` (UTC-3)»*.
`src/lib/format/index.ts:1` usa `America/Argentina/Buenos_Aires`, que es lo que pide la regla 25 §1. Los dos son
UTC-3 y no hay diferencia de comportamiento, pero el nombre de la prueba afirma una zona que el código no usa.

- `P03-comentario-contradice-codigo`

### `H28` · `dialog.tsx` y `sheet.tsx` duplican a mano la gestión de foco que Radix ya hace

Los dos envuelven `DialogPrimitive.Content` y aun así conservan el `useEffect` de foco inicial y el
`handleKeyDown` con la trampa de Tab (`dialog.tsx:123-170`). Radix `Content` ya implementa foco inicial, trampa,
restauración al cerrar, cierre con Escape y bloqueo de scroll. Es de dónde sale `R02` y es por lo que M2 queda
verde.

Son ~45 líneas por archivo que hay que mantener, y que pueden divergir de Radix en cada actualización.

- **Qué hacer:** quedarse con Radix y borrar la implementación propia. Las pruebas de foco que ya existen
  siguen sirviendo tal cual: pasan a verificar a Radix, que es lo que corresponde.

### `H29` · La ruta de muestra es pública e indexable

`/design-system` no tiene `noindex` ni gate, y el build la deja en **168 kB de First Load JS** contra un
presupuesto de 180 (la home está en 103).

- **Decidido por Lautaro073 (`D07`):** dejarla accesible y agregarle
  `robots: { index: false, follow: false }` al `metadata` de la página.

---

## 4. Checks

Sobre el snapshot del árbol de trabajo (`../cadeApp-rev59b`), con `pnpm install --frozen-lockfile` en 52 s.

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ exit 0 · `✔ No ESLint warnings or errors` |
| `pnpm test` | ✅ **13 archivos · 126 casos** (eran 116) + 19 workflows + 6 ADR |
| `pnpm test:coverage` | ✅ exit 0 · `src/ui` **98,09 % / 89,39 % de ramas** con umbral real de 80 por archivo |
| `pnpm build` | ✅ exit 0 · `/` 103 kB · `/design-system` 168 kB · presupuesto 180 kB |
| `pnpm test:db` | n.a. — sin Docker local; el PR no toca `supabase/` ni `src/server/` |
| CI | ⚠️ **7 de 8** en `2491a4c`: `approval-policy` en rojo. **El trabajo de esta ronda no pasó por CI todavía** |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |
| Alcance | ❌ **8 archivos fuera**: `assets/1.svg` … `assets/8.svg` (ver `H20`) |

### Una corrección mía

A mitad de la ronda reporté para mí mismo que `pnpm build` fallaba con veinte errores de tipo en
`brand-logo.tsx`. Era mío: había hecho `git checkout -- src/ui/tokens.ts` para revertir una mutación, y eso lo
devolvió al contenido de `2491a4c` en vez de al del agy, dejando un `brand-logo.tsx` nuevo contra un `tokens.ts`
viejo. Rehíce el snapshot copiando los archivos directamente y el build pasa en 0. Queda como `AG-53`.

## 5. Veredicto

**CON BLOQUEANTES (4):** `H20` (los ocho `assets/` fuera de alcance y más pesados), `H21` (1,25 MB de logo
contra un presupuesto de 5 KB), `R01` (el diccionario de mensajes y `notify.promise` desaparecidos) y `H01` (el
cuerpo del PR y `approval-policy`).

Dicho eso, el trabajo de esta ronda es bueno y conviene que quede escrito: **los nueve bloqueantes de la ronda 1
están resueltos**, los controles ciegos pasaron de 8 sobre 9 a 2 sobre 12 —y los dos que quedan tienen
explicación, no son omisiones—, la cobertura de `src/ui` subió 25 puntos de ramas, y las cuatro decisiones se
aplicaron completas y citadas una por una en la ficha.

Los cuatro bloqueantes que quedan son de otra naturaleza: tres son de **empaquetado y entrega** (archivos fuera
de alcance, peso de assets, cuerpo del PR) y uno es una **regresión de un arreglo**. Ninguno pide rehacer diseño.

Y antes que nada: **commitear**. Sin commit no hay SHA, sin SHA no hay `verificado_en_sha`, y todo lo que
verifiqué acá hay que volver a verificarlo en la ronda 3.
