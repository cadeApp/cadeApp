# Evidencia reproducible — PR #59 · T-008 · ronda 1

SHA revisado: **`e3c1a4d`**. Base: `origin/develop` = `92c8386`. Fecha: 2026-09-23.

Todo se corrió en un **worktree detached**, nunca en el árbol compartido con el agy y nunca cambiando de rama.

```bash
git fetch origin
git worktree add --detach ../cadeApp-rev59 e3c1a4d
cd ../cadeApp-rev59
pnpm install --frozen-lockfile     # exit 0
```

Al cerrar la ronda: `git worktree remove --force ../cadeApp-rev59 && git worktree prune`. El probe y todas las
mutaciones se retiraron; ningún archivo del repositorio quedó modificado por la revisión.

---

## 1. Alcance

```bash
gh pr diff 59 --name-only        # 28 archivos
```

Contra «Archivos permitidos» de `docs/tasks/T-008.md` leída desde `origin/develop`: 22 en `src/ui/**`, 2 en
`src/lib/format/**`, `src/app/providers.tsx`, `docs/tasks/T-008.md` y `docs/tasks/log/T-008.md`.
**0 fuera de alcance.**

## 2. Checks

```bash
pnpm typecheck        # exit 0
pnpm lint             # exit 0 · ✔ No ESLint warnings or errors
pnpm test             # 13 archivos · 116 casos + 19 workflows + 6 ADR
pnpm test:coverage    # exit 0
```

`test:coverage`, recorte de `src/ui` (el umbral solo alcanza `src/domain/**`, ver `D04`):

```
 ui                 |   88.75 |    64.15 |   78.46 |   88.75 |
  dialog.tsx        |   73.68 |    53.84 |      80 |   73.68 | ...134-136,229-262
  select.tsx        |   82.56 |     62.5 |   71.42 |   82.56 | ...,43-48,119-131
  notify.ts         |   94.89 |    65.21 |   77.77 |   94.89 | 68-69,71-72,109
  toaster.tsx       |    12.5 |      100 |       0 |    12.5 | 10-24
  form.tsx          |   83.57 |    72.22 |      75 |   83.57 | ...42-143,182-186
 ui/motion          |   91.15 |    78.57 |   85.71 |   91.15 |
  index.tsx         |   91.15 |    78.57 |   85.71 |   91.15 | 30-41
```

Los tramos sin cubrir no son decorativos: `dialog.tsx 229-262` es `ConfirmDialog` entero (`H03`),
`select.tsx 43-48/119-131` significa que el Select nunca se abre ni selecciona (`H17`),
`motion/index.tsx 30-41` es la detección de `prefers-reduced-motion` (`H08`),
`notify.ts 68-72` es la liberación del id (`H10`) y `toaster.tsx 10-24` es el `<Toaster />` real (`H19`).

`pnpm test:db`: **no se corrió** — este entorno no tiene Docker. En CI el job `db-tests` pasa.

## 3. CI

```bash
gh pr checks 59
```

```
approval-policy   fail   8s     ← 
audit             pass   29s
build             pass   1m1s
bundle-budget     pass   9s
db-tests          pass   3m51s
lint              pass   32s
typecheck         pass   36s
unit              pass   51s
```

```bash
gh run view 35812589269 --log-failed
# → Falta el informe completo de revisar-pr sin bloqueantes.
```

**7 de 8.** Ver `H01`.

## 4. Construcciones prohibidas

```bash
for f in $(gh pr diff 59 --name-only | grep -E '\.tsx?$'); do
  grep -nE ':\s*any\b|as any|@ts-ignore|@ts-expect-error|\.only\(|\.skip\(|[a-zA-Z0-9_)\]]!\.' "$f"
done
# (sin coincidencias)
```

0 `any` · 0 `@ts-ignore` · 0 `!` non-null · 0 `.only` · 0 `.skip`, en 28 archivos y ~2.200 líneas nuevas.

## 5. Dependencias

```bash
grep -rhoE "from '[^.@/][^']*'|from '@[a-z@/-]+'" src/ui/ src/lib/format/ | sort | uniq -c | sort -rn
```

```
     17 from 'react'          3 from 'sonner'        2 from 'zod'
      3 from 'vitest'         3 from 'lucide-react'  2 from 'class-variance-authority'
      1 from 'tailwind-merge' 1 from 'clsx'          1 from '@testing-library/react'
```

Todos ya declarados en `package.json`. **Cero dependencias nuevas.** Ausentes, y aprobadas por la regla 25 §1:
`motion`, `react-hook-form`, `@hookform/resolvers`, `@radix-ui/*`. Ver `D01`.

## 6. Piso tipográfico y valores arbitrarios

```bash
grep -rn "text-xs\|0\.75rem\|12px" src/ui/ src/lib/format/     # solo comentarios
grep -rnoE '\b[a-z-]+-\[[^]]+\]' src/ui/                       # aria-[invalid=true] ×2
```

El piso **se cumple**. Quien lo impone es `tailwind.config.ts`, que remapea `xs` y `sm` a `0.875rem` — y que no
está en Archivos permitidos ni lo lee ninguna prueba. Ver `H04`.

## 7. Contraste: todos los pares que los componentes usan de verdad

Reimplementé la luminancia relativa de WCAG 2.2 aparte, para no medir con la misma regla que reviso.

| par | uso | ratio | AA | ¿en la matriz? |
|---|---|---|---|---|
| `#12182C` / `#09BABD` | botón primario | **7,35** | ✅ AAA | sí |
| `#12182C` / `#FDFCFB` | tinta sobre fondo | 17,18 | ✅ | sí |
| `#0B7A7D` / `#FFFFFF` | `text-primary-dark` | 5,13 | ✅ | sí |
| `#5B6475` / `#FFFFFF` | texto secundario | 5,96 | ✅ | sí |
| `#B45309` / `#FFF4E0` | `.badge-warning` | 4,61 | ✅ | sí |
| `#FFFFFF` / `#C62828` | `.badge-danger` | 5,62 | ✅ | sí |
| `#177A4B` / `#F0FDF4` | `.badge-success` | 5,12 | ✅ | **no** |
| `#5B6475` / `#F3F4F6` | `bg-muted` (expired) | 5,41 | ✅ | **no** |
| `#0B7A7D` / `bg-primary/15` | `EmptyState` | **4,48** | ⚠️ | **no** |
| `#FFFFFF` / `#12182C` | `bg-secondary` | 17,61 | ✅ | **no** |

**Ninguno falla hoy.** El de 4,48 envuelve un ícono `aria-hidden`, o sea gráfico no textual: aplica 3:1 y no es
violación. El hallazgo `H13` es que el control no mira los cuatro últimos, no que haya un color mal.

Y el primero es el dato de `H15`: **7,35:1**, no el 6,93:1 que repiten `tokens.css:12`, la bitácora, el informe
del agy y la propia ficha.

## 8. Probe de la revisión — 10 de 11 en rojo

`src/ui/review-pr59-r1-probe.test.tsx` en el worktree, retirado al cerrar. **Tipado antes de creerle**
(`npx tsc --noEmit` → exit 0), que es `AG-47` de la PR #58.

```
✗ H01 Select: expected 'centro' to be 'Centro'
✗ H02 opciones huérfanas: expected [ 'Centro', 'Barrio Norte' ] to deeply equal []
     …y en la misma prueba auditElementAccessibility(container).violations === []
✗ H03 FormMessage: expected null not to be null  (el <p role="alert"> no tiene id)
✓ H04 prefers-reduced-motion: PASA — la implementación es correcta, el defecto es que nada la ejercita
✗ H05 notify: expected "spy" to be called 2 times, but got 1 times
✗ H06 sanitizar: expected 'Coordiná el retiro al 3865 12-3456' not to contain '3865 12-3456'
✗ H07 matriz: expected [ 'allPass', …(12) ] to include 'successOnAccentAA'
✗ H07 ratio: tokens.css dice 'WCAG AAA 6.93:1' y getContrastRatio da 7.35
✗ H08 Anti-12px: tokens.css no contiene 'font-size' ni una vez
✗ H09 arbitrarios: las 8 clases (shadow-[…], ring-[…], size-[…], inset-[…],
     translate-y-[…], grid-cols-[…], duration-[…], opacity-[…]) escapan al regex
✗ H10 BRAND_ASSET_PATHS: las 4 rutas de public/ no existen
```

El caso que **pasó** importa tanto como los diez que fallaron: escribí `H04` esperando un defecto y la
implementación resultó correcta. Si me hubiera quedado en la lectura del código habría reportado un defecto
inexistente.

## 9. Batería de mutaciones — 8 de 9 controles ciegos

El método: romper a propósito cada propiedad que el DoD dice verificar y correr
`src/ui/ui-system.test.tsx` + `src/lib/format/format.test.ts`. Si la suite queda verde, el control no cubre lo
que dice. Cada mutación se revierte antes de la siguiente; el árbol queda limpio (`git status --short` vacío).

| # | archivo | mutación | DoD | suite |
|---|---|---|---|---|
| M1 | `tailwind.config.ts` | `xs: '0.875rem'` → `'0.75rem'` (12 px) | piso tipográfico 14 px | 🟢 verde |
| M2 | `dialog.tsx` | quito el `useEffect` que enfoca al abrir | foco atrapado del Dialog | 🟢 verde |
| M3 | `card.tsx` | agrego `shadow-[0_0_0_9999px_red] ring-[3px] size-[13px]` | ningún valor arbitrario | 🟢 verde |
| M4 | `dialog.tsx` | `onClick={onConfirm}` → `onClick={() => undefined}` | Dialog de confirmación | 🟢 verde |
| M5 | `motion/index.tsx` | `setSystemReduced(mediaQuery.matches)` → `(false)` | `prefers-reduced-motion` | 🟢 verde |
| M6 | `tokens.ts` | `mutedForeground: '#5B6475'` → `'#9AA3B2'` (2,42:1) | contraste AA/AAA | 🔴 **roja** |
| M6b | `tokens.css` | `--accent` a verde oscuro → `.badge-success` a 1,06:1 | contraste AA/AAA | 🟢 verde |
| M7 | `brand-logo.tsx` | `fill="#09BABD"` → `"#FF00FF"` en el JSX renderizado | `<BrandLogo />` < 5 KB | 🟢 verde |
| M8 | `notify.ts` | `onDismiss` nunca libera el id | `notify` no duplica por id | 🟢 verde |

**Una sola puso la suite en rojo.** M6 y M6b son el par que vale mirar junto: el control de contraste está vivo
para los seis pares que enumera y ciego para los cuatro que no.

## 10. Lo que no se pudo verificar

- **`pnpm test:db`**: sin Docker local. En CI pasa, pero esta PR no toca `supabase/` ni `src/server/`, así que no
  aplica al DoD de T-008.
- **Contraste renderizado y foco visible**: jsdom no carga CSS, así que ninguna herramienta —ni la auditoría
  propia ni axe— puede medirlos en la suite unitaria. Es parte del argumento de `D03`.
- **La página de muestra S00 en un navegador**: no existe ninguna ruta que la renderice (ver `D02`), así que no
  se pudo abrir.

---

# Ronda 2 · 2026-09-23 · árbol de trabajo SIN COMMITEAR

**No hay SHA.** El head del PR sigue en `2491a4c` y los 29 archivos de la ronda 2 viven solo en el árbol
compartido. El snapshot se tomó a las 02:50.

```bash
# El árbol compartido NO se toca: se copia a un worktree detached
git worktree add --detach ../cadeApp-rev59b 2491a4c
cd ../cadeApp-rev59b
for f in $(cd ../cadeApp && git status --short | awk '{print $2}'); do cp "../cadeApp/$f" "$f"; done
mkdir -p public/brand src/app/design-system
cp ../cadeApp/public/brand/*  public/brand/
cp ../cadeApp/public/*.png    public/
cp ../cadeApp/src/app/design-system/page.tsx src/app/design-system/
pnpm install --frozen-lockfile        # exit 0 en 52,1 s
```

Fidelidad del snapshot comprobada archivo por archivo con `md5sum` tras normalizar CRLF (ver `AG-53`).

## Checks

```
pnpm typecheck     exit 0
pnpm lint          exit 0 · ✔ No ESLint warnings or errors
pnpm test          13 archivos · 126 casos (eran 116) + 19 workflows + 6 ADR
pnpm test:coverage exit 0
pnpm build         exit 0
```

`build`:

```
Route (app)                     Size  First Load JS
┌ ○ /                          123 B         103 kB
├ ○ /_not-found                987 B         104 kB
└ ○ /design-system             161 B         168 kB      ← presupuesto 180 kB
```

`coverage`, recorte de `src/ui` (umbral nuevo: 80/80/80/80 con `perFile`):

```
 ui                 |   98.09 |    89.39 |     100 |   98.09 |     (era 88.75 / 64.15)
  dialog.tsx        |   95.78 |    81.13 |     100 |   95.78 |     (era 73.68 / 53.84)
  select.tsx        |   98.95 |    94.23 |     100 |   98.95 |     (era 82.56 / 62.50)
  form.tsx          |   97.97 |     90.9 |     100 |   97.97 |     (era 83.57 / 72.22)
  notify.ts         |   96.22 |    93.75 |     100 |   96.22 |     (era 94.89 / 65.21)
  sheet.tsx         |   93.82 |    80.48 |     100 |   93.82 |     (era 83.96 / 57.14)  ← el más justo
  toaster.tsx       |     100 |      100 |     100 |     100 |     (era 12.5)
 ui/motion          |   97.11 |    85.71 |     100 |   97.11 |     (era 91.15 / 78.57)
```

## Alcance

```bash
cd ../cadeApp && git status --short
```

29 modificados + `public/` y `src/app/design-system/` sin trackear = **33 archivos**.
Contra la lista ampliada de `docs/tasks/T-008.md`: **8 fuera** — `assets/1.svg` … `assets/8.svg`.

## `H20` · Los ocho `assets/` sobrescritos

```bash
for n in 1 2 3 4 5 6 7 8; do
  echo "$n: $(git cat-file -p HEAD:assets/$n.svg | wc -c) -> $(wc -c < assets/$n.svg)"
done
```

```
1: 1187143 -> 2258151   (+90%)     5:  261631 -> 1712594  (+555%)
2:  891716 -> 1314059   (+47%)     6: 1009031 ->  465150   (-54%)
3:  226793 -> 1151253  (+408%)     7:  753411 -> 2117089  (+181%)
4:  626966 -> 2596324  (+314%)     8: 1298709 -> 2271459   (+75%)
                                total: 6,45 MB -> 13,9 MB
```

## `H21` · El logo publicado es el export crudo

```bash
md5sum public/brand/logo.svg assets/2.svg
# 377c2c2392f187c08f3a1ffb41024e8b  public/brand/logo.svg
# 377c2c2392f187c08f3a1ffb41024e8b  assets/2.svg        ← el mismo archivo

head -c 220 public/brand/logo.svg
# <svg ... xmlns:c2pa="http://c2pa.org/manifest"><metadata><c2pa:manifest>AABCIWp1bWIA…
```

| archivo | bytes | presupuesto |
|---|---|---|
| `public/brand/logo.svg` | 1.314.059 | < 5 KB → **256×** |
| `public/brand/logo.webp` | 798.777 | — |
| `public/icon-192x192.png` | 15.893 | ok |
| `public/icon-512x512.png` | 82.281 | ok |

## `R01` · Lo que se perdió al reescribir `notify.ts`

```bash
grep -rn "DOMAIN_ERROR_MESSAGES" src/    # sin resultados en todo el repositorio
grep -rn "notify.promise\|promise(" src/ui/ --include=*.ts --include=*.tsx | grep -v test   # sin resultados
```

En la ronda 1 eran 27 mensajes en es-AR con una prueba que recorría `ALL_DOMAIN_ERROR_CODES`. Hoy no existen, y
la prueba se fue con ellos.

## `H01` · Por qué `approval-policy` sigue rojo

```bash
gh pr checks 59
# approval-policy  fail  5s  .../runs/35819462013
```

`hasCompleteReport()` exige seis cadenas literales y el cuerpo no tiene ninguna:

| espera | el cuerpo dice |
|---|---|
| `Informe revisar-pr — T-008` | `### Informe de revisión de agy` |
| `Resultado: SIN BLOQUEANTES` | `**Bloqueantes: 0**` |
| `Checks locales:` | — |
| `BLOQUEANTES:` | `**Bloqueantes: 0**` (minúscula) |
| `MEJORAS:` | — |
| `No revisado / dudas para Lautaro073:` | — |

## Batería de mutaciones · ronda 2

Script en el scratchpad; cada mutación se revierte **desde memoria** antes de la siguiente (ver `AG-53`).

```
M1   roja (vivo)     tailwind.config.ts: xs a 0.75rem                    (R1: ciego)
M2   VERDE (ciego)   dialog.tsx: saco el foco automático al abrir        (R1: ciego) → H09
M3   roja (vivo)     card.tsx: shadow-[…] ring-[3px] size-[13px]         (R1: ciego)
M4   roja (vivo)     dialog.tsx: desconecto onConfirm                    (R1: ciego)
M5   roja (vivo)     motion: setPrefersReduced(false)                    (R1: ciego)
M6   roja (vivo)     tokens.ts: mutedForeground a 2,42:1                 (R1: vivo)
M6b  VERDE (ciego)   tokens.css: --accent deja badge-success en 1,06:1   (R1: ciego) → H22
M8   roja (vivo)     notify.ts: sin id en el payload de Sonner           (R1: ciego)
M9   roja (vivo)     tokens.css: saco la guarda de movimiento reducido   (nueva)
M11  roja (vivo)     form.tsx: FormControl sin aria-describedby          (nueva)
M12  roja (vivo)     borro public/icon-192x192.png                       (nueva)
M13  roja (vivo)     notify.ts: sin sanitizeToastMessage                 (nueva)

Vivos: 10 · ciegos: 2
```

Contraprueba de `M6b`, para separar «la matriz no mira» de «la matriz mira la copia equivocada`:

```bash
sed -i "s/accent: '#F0FDF4'/accent: '#1A6B45'/" src/ui/tokens.ts && npx vitest run src/ui/ui-system.test.tsx
# Tests  2 failed | 19 passed (21)   ← la matriz SÍ está viva contra tokens.ts
```

O sea: viva contra `tokens.ts`, ciega contra `tokens.css`, que es lo que el navegador pinta.

## Probe de la ronda 2 — 6 de 6 en rojo

`src/ui/review-pr59-r2-probe.test.tsx`, tipado antes de correrlo (`tsc --noEmit` exit 0), retirado al cerrar.

```
✗ R2-01 Escape → onClose: expected "spy" to be called 1 times, but got 2 times
✗ R2-02 tokens.ts vs tokens.css: ningún test del repositorio compara los dos archivos
✗ R2-03 DOMAIN_ERROR_MESSAGES no está en notify.ts (ni en ningún lado)
✗ R2-04 logo.svg = 1283 KB contra 5 KB de presupuesto
✗ R2-04 el SVG publicado contiene c2pa:manifest
✗ R2-05 backdrop-blur-xs en dialog.tsx y sheet.tsx
```

## Tailwind: `backdrop-blur-xs` no existe en 3.4

```bash
node -e "console.log(Object.keys(require('tailwindcss/defaultTheme').blur).join(', '))"
# 0, none, sm, DEFAULT, md, lg, xl, 2xl, 3xl
node -e "console.log(require('tailwindcss/package.json').version)"   # 3.4.19
```

## Lo que no se pudo verificar

- **Nada contra un SHA**: el trabajo está sin commitear. Todo lo cerrado en esta ronda hay que revalidarlo.
- **CI sobre el trabajo de la ronda 2**: no corrió, porque no hay push.
- **`pnpm test:db`**: sin Docker local; el PR no toca `supabase/` ni `src/server/`.

---

# Ronda 3 · 2026-09-23 · SHA `c4797ce`

Arreglos en `30653c2` (ronda 1) y `cdbd9a9` (ronda 2); bitácora en `c4797ce`.

```bash
git fetch origin
git worktree add --detach ../cadeApp-rev59c c4797ce
cd ../cadeApp-rev59c && pnpm install --frozen-lockfile     # exit 0
```

## Checks

```
pnpm typecheck     exit 0
pnpm lint          exit 0 · ✔ No ESLint warnings or errors
pnpm test          13 archivos · 129 casos + 19 workflows + 6 ADR
pnpm test:coverage exit 0
pnpm build         exit 0 · / 103 kB · /design-system 168 kB (presupuesto 180)
```

```
 ui                 |   98.85 |     91.9 |     100 |   98.85 |
  dialog.tsx        |   97.87 |     87.5 |     100 |   97.87 | 20-21,65-66
  select.tsx        |   98.95 |    94.23 |     100 |   98.95 | 22-23
  notify.ts         |   96.61 |    95.23 |     100 |   96.61 | 36-37
  sheet.tsx         |   97.03 |    84.37 |     100 |   97.03 | 19-20,64-65   ← el más justo
  toaster.tsx       |     100 |      100 |     100 |     100 |
 ui/motion          |   97.11 |    85.71 |     100 |   97.11 |
```

Ningún archivo de `src/ui` por debajo del umbral de 80 de ramas.

## CI — 8 de 8

```bash
gh pr checks 59
# approval-policy pass · audit pass · build pass · bundle-budget pass
# db-tests pass · lint pass · typecheck pass · unit pass
```

`db-tests` leído del log y no del color:

```bash
gh run view 35829564958 --log | grep -iE "Tests=|Result:"
# Files=3, Tests=98,  1 wallclock secs
# Result: PASS
```

## Alcance

```bash
gh pr diff 59 --name-only | wc -l                      # 45
git diff --stat origin/develop...c4797ce -- assets/    # (vacío)
```

45 archivos, todos dentro de la lista ampliada de `docs/tasks/T-008.md`. **`assets/` intacto**: los ocho
originales están idénticos a `develop` y no forman parte del PR.

```bash
for f in $(gh pr diff 59 --name-only | grep -E '\.tsx?$'); do
  grep -nE ':\s*any\b|as any|@ts-ignore|@ts-expect-error|\.only\(|\.skip\(|[a-zA-Z0-9_)\]]!\.' "$f"
done
# (sin coincidencias)
```

## Batería de mutaciones · 16 vivas, 0 ciegas

```
M1   roja  R1:ciego R2:vivo   tailwind.config.ts: xs a 0.75rem
M2   SIN OBJETIVO             dialog.tsx: el focusables[0]?.focus() ya no existe → clase cerrada
M3   roja  R1:ciego R2:vivo   card.tsx: shadow-[…] ring-[3px] size-[13px]
M4   roja  R1:ciego R2:vivo   dialog.tsx: desconecto onConfirm
M5   roja  R1:ciego R2:vivo   motion: setPrefersReduced(false)
M6   roja  R1:vivo  R2:vivo   tokens.ts: mutedForeground a 2,42:1
M6b  roja  R1:ciego R2:ciego  tokens.css: --accent a 152 60% 26% → badge-success 1,06:1
M8   roja  R1:ciego R2:vivo   notify.ts: sin id en el payload de Sonner
M9   roja           R2:vivo   tokens.css: saco la guarda de movimiento reducido
M11  roja           R2:vivo   form.tsx: FormControl sin aria-describedby
M12  roja           R2:vivo   borro public/icon-192x192.png
M13  roja           R2:vivo   notify.ts: sin sanitizeToastMessage
M14  roja  (nueva)            error-messages.ts: borro un código del diccionario
M15  roja  (nueva)            notify.ts: rompo notify.promise
M16  roja  (nueva)            page.tsx: saco el noindex de /design-system
M17  roja  (nueva)            tokens.css: desincronizo --primary del hex
M18  roja  (nueva)            logo.svg: lo engordo a 6 KB y le devuelvo el namespace c2pa

vivos: 16 · ciegos: 0
```

**`M6b` y `M17` dieron «sin objetivo» en la primera corrida** porque `tokens.css` se había reescrito con
precisión decimal (`--primary: 181 90.91% 38.82%` donde antes decía `181 90% 39%`). Se reapuntaron a los valores
nuevos y se volvieron a correr: **las dos en rojo**. Ver `AG-55`.

```bash
# contraprueba reapuntada
sed -i 's/--accent: 138.46 76.47% 96.67%;/--accent: 152 60% 26%;/' src/ui/tokens.css
npx vitest run src/ui/ui-system.test.tsx     # roja
sed -i 's/--primary: 181 90.91% 38.82%;/--primary: 181 90% 30%;/' src/ui/tokens.css
npx vitest run src/ui/ui-system.test.tsx     # roja
```

## El probe de la ronda 2, corrido sin tocarlo — 6 de 6 en verde

Los seis casos se escribieron en la ronda 2 para fallar. Ahora pasan:

```
✓ R2-01  Escape invoca onClose exactamente 1 vez (era 2)
✓ R2-02  existe la prueba que compara tokens.css con DESIGN_TOKENS (hslToHex)
✓ R2-03  DOMAIN_ERROR_MESSAGES en src/lib/error-messages.ts; notify.promise volvió;
         activeToastIds y resetActiveToasts eliminados
✓ R2-04  logo.svg < 5 KB, sin c2pa, con el wordmark cadeApp
✓ R2-04  assets/ intacto
✓ R2-05  0 usos de backdrop-blur-xs
```

## `H30` · El WebP del logo

```bash
node -e "
const b=require('fs').readFileSync('public/brand/logo.webp');
console.log('bytes:', b.length, '|', b.toString('ascii',0,4), b.toString('ascii',8,12), JSON.stringify(b.toString('ascii',12,16)));
console.log('sync:', b.slice(23,26).toString('hex'));
console.log('dimensiones:', (b.readUInt16LE(26)&0x3fff)+'x'+(b.readUInt16LE(28)&0x3fff));
"
# bytes: 45 | RIFF WEBP "VP8 "
# sync: 9d012a
# dimensiones: 272x0
```

Contenedor válido, imagen vacía. Lo que lo deja pasar:

```ts
const webpStat = fs.statSync(webpPath);
expect(webpStat.size).toBeGreaterThan(20);        // 45 > 20 ✓
expect(webpStat.size).toBeLessThan(50 * 1024);    // 45 < 51200 ✓
```

Los otros tres sí son reales:

```bash
head -c 8 public/icon-192x192.png | od -An -tx1   # 89504e470d0a1a0a  (PNG, 15.893 B)
head -c 8 public/icon-512x512.png | od -An -tx1   # 89504e470d0a1a0a  (PNG, 82.281 B)
wc -c public/brand/logo.svg                        # 1106
```

## `D06` verificado

```bash
grep -n "EXCEPCIONES = new Set" tools/verify-fichas.test.ts
# 120:  const EXCEPCIONES = new Set(['T-000', 'T-001', 'T-002']);

git diff origin/develop...c4797ce -- docs/implementation-plan.md
# la fila de T-008 pasa a 7.35:1, suma la ruta S00, las primitivas Radix reales
# y el DoD nuevo con el umbral de cobertura
```

## Lo que no se pudo verificar

- **`pnpm test:db` local**: sin Docker. En CI pasa y se leyó el log.
- **El render real en navegador**: jsdom no carga CSS. El contraste se verifica con la matriz de tokens, que
  ahora sí está sincronizada con lo que se pinta (`H22`), y el chequeo con `@axe-core/playwright` quedó para E2E
  por `D03`.
