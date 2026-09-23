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
