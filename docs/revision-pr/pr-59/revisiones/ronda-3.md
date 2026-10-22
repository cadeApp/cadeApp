# PR #59 · T-008 — Ronda 3

- **PR:** [#59](https://github.com/cadeApp/cadeApp/pull/59) · `feat/T-008-ui-tokens-d16` → `develop`
- **Tarea:** `T-008` · Issue #9
- **SHA revisado:** **`c4797ce`** (arreglos en `30653c2` y `cdbd9a9`, bitácora en `c4797ce`)
- **Fecha:** 2026-09-23
- **Resultado: SIN BLOQUEANTES.** Un hallazgo medio abierto, no bloqueante.

---

## 0. Ahora sí hay SHA

La ronda 2 se revisó sobre un árbol de trabajo sin commitear y por eso **ningún hallazgo llevaba
`verificado_en_sha`**. Eso se resolvió: los arreglos están en dos commits, la bitácora tiene su entrada del
04:00, y todo lo que sigue está verificado contra `c4797ce`. Los 24 hallazgos que quedaron en «corregido sin
verificar» se revalidaron uno por uno en esta ronda y recién ahora llevan SHA.

---

## 1. La batería completa: 16 mutaciones, 16 vivas, 0 ciegas

Este es el dato de la PR. Tres rondas de la misma medición:

| | Ronda 1 | Ronda 2 | Ronda 3 |
|---|---|---|---|
| **Controles vivos** | **1 de 9** | **10 de 12** | **16 de 16** |

Todas las mutaciones, y en qué ronda cada control empezó a morder:

| # | Rompí | R1 | R2 | R3 |
|---|---|---|---|---|
| M1 | la escala `xs` vuelve a 12 px | 🟢 | 🔴 | 🔴 |
| M2 | saco el foco automático propio del Dialog | 🟢 | 🟢 | **sin objetivo** |
| M3 | `shadow-[…] ring-[3px] size-[13px]` en `src/ui` | 🟢 | 🔴 | 🔴 |
| M4 | desconecto Confirmar de `ConfirmDialog` | 🟢 | 🔴 | 🔴 |
| M5 | `MotionConfig` deja de leer la preferencia | 🟢 | 🔴 | 🔴 |
| M6 | `mutedForeground` a 2,42:1 | 🔴 | 🔴 | 🔴 |
| M6b | `--accent` de `tokens.css` deja `.badge-success` en 1,06:1 | 🟢 | 🟢 | 🔴 |
| M8 | `notify` sin `id` para Sonner | 🟢 | 🔴 | 🔴 |
| M9 | saco la guarda CSS de movimiento reducido | — | 🔴 | 🔴 |
| M11 | `FormControl` no apunta al mensaje de error | — | 🔴 | 🔴 |
| M12 | borro un asset de `public/` | — | 🔴 | 🔴 |
| M13 | `notify` no sanitiza el mensaje | — | 🔴 | 🔴 |
| M14 | borro un código de `DOMAIN_ERROR_MESSAGES` | — | — | 🔴 |
| M15 | rompo `notify.promise` | — | — | 🔴 |
| M16 | saco el `noindex` de `/design-system` | — | — | 🔴 |
| M17 | desincronizo `--primary` del hex de `DESIGN_TOKENS` | — | — | 🔴 |
| M18 | engordo `logo.svg` a 6 KB y le devuelvo el namespace `c2pa` | — | — | 🔴 |

**`M2` es el caso más interesante y no es un control ciego: es una clase cerrada.** El regex no encontró nada
que romper porque el `focusables[0]?.focus()` de `DialogContent` ya no existe — se eliminó el manejo de foco
propio y quedó solo el de `DialogPrimitive.Content`. No hay dos implementaciones que confundir, así que no hay
mutación que hacer. Es el mismo movimiento que `BrandLogo` en la ronda 2 y que `AG-48` de la #58: la forma más
fuerte de cerrar un hallazgo es que el defecto deje de ser expresable.

**`M6b` y `M17` merecen una nota de método.** Los dos dieron «sin objetivo» en la primera corrida y **no lo di
por bueno**: fui a `tokens.css`, vi que las variables se habían reescrito con precisión decimal
(`--primary: 181 90.91% 38.82%` donde antes decía `181 90% 39%`, justamente para que el HSL vuelva al hex
exacto), reapunté las dos mutaciones a los valores nuevos y las volví a correr. **Las dos en rojo.** Si me
quedaba en «sin objetivo» habría reportado como cerrado algo sin comprobarlo.

---

## 2. Los cuatro bloqueantes de la ronda 2, cerrados

### `H20` · `assets/` restaurado

```
git diff --stat origin/develop...c4797ce -- assets/   →   (vacío)
```

Los ocho archivos están idénticos a `develop`. Los 7,5 MB que se habían sumado desaparecieron y **`assets/` no
forma parte del PR**. El alcance quedó en 45 archivos, todos dentro de «Archivos permitidos».

### `H21` · El logo publicado pasó de 1,25 MB a 1.106 bytes

`public/brand/logo.svg` es ahora un SVG escrito a mano: las mismas figuras que dibuja `<BrandLogo />`, con los
colores literales de `DESIGN_TOKENS` y el wordmark en `cadeApp`. Sin `c2pa:manifest`, sin metadatos del
exportador.

Y el control se amplió bien: ya no es solo `existsSync`, ahora mide bytes **y** contenido
(`ui-system.test.tsx:528-536`). La mutación M18 —engordar el SVG a 6 KB y devolverle el namespace `c2pa`— lo
pone en rojo.

### `R01` · El diccionario y `notify.promise` volvieron, y a su lugar definitivo

`src/lib/error-messages.ts` con los 27 mensajes bajo `satisfies Record<DomainErrorCode, string>`, que es lo que
pide la regla 60. `notify.error(codeOrMessage: DomainErrorCode | string)` traduce el código;
`notify.promise` está de vuelta con `loading`/`success`/`error`, y `error` acepta también un `DomainErrorCode`.

Dos controles nuevos y los dos vivos: M14 (borro un código del diccionario) y M15 (rompo `notify.promise`)
ponen la suite en rojo. Y de paso desapareció el `Set` muerto `activeToastIds` con su `resetActiveToasts()`
(`H26`).

### `H01` · CI **8 de 8**

`approval-policy` pasa. El cuerpo del PR sigue la plantilla completa —«Qué cambia», DoD copiado, «Evidencia de
checks» con salida pegada, «Dependencias nuevas» con los siete paquetes, checklist de seguridad, «Rollback»— y
el informe lleva el formato literal que `hasCompleteReport()` busca. Los números del cuerpo ya son los de este
SHA: 7,35:1, 129 casos, alcance real.

---

## 3. Las mejoras de la ronda 2, cerradas

Volví a correr **sin tocarlo** el probe de la ronda 2, que entonces daba 6 de 6 en rojo. Ahora los seis pasan:

```
✓ R2-01  Escape invoca onClose exactamente 1 vez (era 2)
✓ R2-02  existe la prueba que compara tokens.css con DESIGN_TOKENS
✓ R2-03  DOMAIN_ERROR_MESSAGES vive en src/lib/error-messages.ts; notify.promise volvió;
         activeToastIds y resetActiveToasts ya no están
✓ R2-04  logo.svg < 5 KB, sin c2pa, con el wordmark cadeApp
✓ R2-04  assets/ intacto
✓ R2-05  backdrop-blur-xs no se usa en ningún lado
```

| id | qué se hizo |
|---|---|
| `R02` · `H28` | Se eliminaron el `useEffect` de foco inicial y el `handleKeyDown` de `Escape`/`Tab` en `DialogContent` y `SheetContent`. Queda solo Radix. Lo único propio que sobrevive es la captura del disparador para restaurarle el foco (`dialog.tsx:43-68`), que es complemento y no duplicado |
| `H22` | Las variables `:root` se recalcularon con precisión decimal para que el HSL vuelva exactamente al hex de `DESIGN_TOKENS`, y hay una prueba `hslToHex` que lo compara variable por variable (`ui-system.test.tsx:784`). M6b y M17 lo confirman en rojo |
| `H23` · `D06` | `EXCEPCIONES` volvió a `['T-000', 'T-001', 'T-002']` **y** la fila de T-008 en `docs/implementation-plan.md` §8 se actualizó. Se arregló el dato, no el control |
| `H24` | `backdrop-blur-sm` en los dos overlays |
| `H25` · `D07` | `cadeApp` en el componente, en el SVG publicado y en el título de la ruta; `robots: { index: false, follow: false }` en el `metadata`. M16 lo confirma |
| `H26` | `activeToastIds` y `resetActiveToasts()` eliminados |
| `H27` | El caso dice `America/Argentina/Buenos_Aires (UTC-3)` |
| `H29` | Ver `D07` |

---

## 4. Lo que queda: un hallazgo, medio, no bloqueante

### `H30` · `public/brand/logo.webp` es un WebP de 272 × 0 px

Es el único asset que no quedó real. El archivo pesa 45 bytes y es un contenedor RIFF/WebP **estructuralmente
válido** —firma `RIFF`, formato `WEBP`, chunk `VP8 `, código de sincronía `9d012a` correcto— pero sus
dimensiones son **272 × 0**. Un navegador no dibuja nada.

```
bytes: 45 · RIFF ✓ · WEBP ✓ · VP8  ✓ · sync 9d012a ✓ · dimensiones: 272x0 px
```

Por qué pasó el control: la prueba mide bytes y nada más.

```ts
const webpStat = fs.statSync(webpPath);
expect(webpStat.size).toBeGreaterThan(20);        // 45 > 20 ✓
expect(webpStat.size).toBeLessThan(50 * 1024);    // 45 < 51200 ✓
```

El contraste con el SVG, cinco líneas más arriba en el mismo `it`, es el dato: al SVG se le comprueban el peso
**y** el contenido (`toContain('cadeApp')`, `not.toContain('CadeApp')`, `not.toContain('c2pa:manifest')`). Al
WebP solo el peso, y un límite inferior de 20 bytes no distingue una imagen de un encabezado.

**Por qué no lo pongo como bloqueante, con los datos:**

- **Nadie lo consume.** `<BrandLogo />` dibuja SVG inline; `BRAND_ASSET_PATHS.logoWebp` está exportado pero
  ningún componente ni ninguna ruta lo referencia. Hoy no se rompe nada.
- Los otros tres assets **sí** son reales: el SVG tiene sus figuras y su wordmark, y los PNG son PNG de verdad
  (firma `89504e470d0a1a0a`, 15,9 KB y 82,3 KB), o sea que la parte del manifiesto PWA está cumplida.

**Por qué igual hay que cerrarlo, y por qué la decisión de si frena el merge es tuya:** el ítem del DoD dice
literalmente *«bundle size de `<BrandLogo />` < 5 KB **y assets reales en `public/`**»* —la frase «assets
reales» la agregó este mismo PR en la ronda 2— y ese casillero está tildado. Uno de los cuatro no es real. Es
la misma forma de `H14` de la ronda 1: una ruta exportada desde `src/ui` que no entrega lo que promete, y que
la va a consumir alguna T-1xx.

- **Qué hacer:** generar el WebP a partir del SVG (un comando) y sumar a la prueba una aserción de dimensiones,
  no solo de bytes: leer el encabezado VP8 y exigir ancho y alto mayores que cero. Con eso el control pasa a
  distinguir una imagen de un encabezado.
- `P08-control-no-cubre-lo-que-dice` · `P15-entregable-declarado-pero-no-ejecutable`

### `H31` · La columna de archivos permitidos del plan §8 no lista los tres `tools/` ni el propio plan

Menor y de higiene. La fila de T-008 en `docs/implementation-plan.md` §8 quedó con
`src/ui/**`, `src/lib/format/**`, `src/lib/error-messages.ts`, `src/app/providers.tsx`,
`src/app/design-system/**`, `public/**`, `package.json`, `pnpm-lock.yaml` y `vitest.config.ts`, pero la ficha
incluye además `tools/verify-approved-packages.test.ts`, `tools/verify-fichas.test.ts` y
`docs/implementation-plan.md`. `verify-fichas` compara el **primer ítem del DoD**, no esa columna, así que el
control pasa y la divergencia no la ve nadie.

---

## 5. Checks en `c4797ce`

Worktree detached (`../cadeApp-rev59c`) con `pnpm install --frozen-lockfile`. El árbol compartido no se tocó y
nunca se cambió de rama.

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ exit 0 · `✔ No ESLint warnings or errors` |
| `pnpm test` | ✅ **13 archivos · 129 casos** + 19 workflows + 6 ADR |
| `pnpm test:coverage` | ✅ `src/ui` **98,85 % / 91,90 % de ramas**; ningún archivo por debajo de 80 (el más justo, `sheet.tsx` con 84,37) |
| `pnpm build` | ✅ `/` 103 kB · `/design-system` 168 kB · presupuesto 180 kB |
| `pnpm test:db` | n.a. local (sin Docker). En CI, leído del log y no del color: `Files=3, Tests=98, Result: PASS` |
| **CI** | ✅ **8 de 8** |
| Alcance | ✅ 45 archivos, **0 fuera** de la ficha · `assets/` intacto |
| Construcciones prohibidas | ✅ 0 `any` · 0 `@ts-ignore` · 0 `!` · 0 `.only` · 0 `.skip` |

Cobertura por archivo de `src/ui`, para dejar el dato de las tres rondas:

| | Ronda 1 | Ronda 3 |
|---|---|---|
| `src/ui` (ramas) | 64,15 % | **91,90 %** |
| `dialog.tsx` | 53,84 % | 87,50 % |
| `select.tsx` | 62,50 % | 94,23 % |
| `notify.ts` | 65,21 % | 95,23 % |
| `sheet.tsx` | 57,14 % | 84,37 % |
| `toaster.tsx` | 12,50 % (líneas) | 100 % |

---

## 6. Veredicto

**SIN BLOQUEANTES. Lista para aceptar**, con `H30` anotado como abierto.

Los nueve bloqueantes de la ronda 1 y los cuatro de la ronda 2 están cerrados y verificados contra `c4797ce`.
Los controles del DoD pasaron de **1 vivo sobre 9** a **16 sobre 16**, que es el cambio real de esta PR: en la
ronda 1 se podía devolver la tipografía a 12 px, desconectar el diálogo de acciones irreversibles y apagar la
detección de movimiento reducido con los 116 tests en verde; hoy cada una de esas cosas pone la suite en rojo.

Dos arreglos se hicieron mejor que lo que yo había pedido, y vale que quede escrito: `BrandLogo` derivando la
cadena y el JSX de una sola geometría, y el manejo de foco del Dialog **eliminado** en vez de corregido. Los
dos cierran la clase entera en lugar del caso puntual.

Queda `H30`: un WebP de 272 × 0 px que nadie consume todavía, con un control que mide bytes y no dimensiones.
Es un comando de arreglo. Si querés que el casillero «assets reales en `public/`» sea literalmente cierto antes
de mergear, es eso; si preferís mergear y cerrarlo en T-1xx cuando alguien lo consuma, también es defendible.
**La decisión es tuya: no apruebo ni mergeo.**
