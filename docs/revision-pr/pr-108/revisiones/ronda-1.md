# PR #108 · CC-010 — Ronda 1

- **SHA revisado:** `e16864d6f3e56a49929e603e4afe5f2e5387c9a3`
- **Resultado:** **CON BLOQUEANTES (2 bloqueantes, 1 mejora)**
- **Checks locales exact-head:** typecheck ✅ · lint ✅ · unit ✅ (33/33 tests en alcance tocado) · test:db n.a.
- **CI exact-head (`36223276953`):** unit ✅ (55 archivos / 605 tests), typecheck ✅, lint ✅, build ✅, audit ✅, bundle-budget ✅, db-tests ✅ (12 archivos / 1529 tests), approval-policy ⏳ (rojo esperado a la espera de este informe).

---

## Lo correcto

1. **Arquitectura y alcance disciplinado:** el contract-change resuelve limpiamente la separación solicitada en la revisión de PR #106 (decisión 2-A de Lautaro073), aislando la incorporación de las primitivas compartidas (`Table`, `Tabs`, `InputOTP`) en `src/ui` sin contaminar la feature de admin T-122.
2. **Cumplimiento del Design System y tokens:** las tres primitivas usan tokens semánticos aprobados (`bg-muted`, `text-muted-foreground`, `ring-offset-background`, `border-input`, `animate-pulse`, `text-sm`), sin introducir estilos hex arbitrarios (`#...`) ni alterar la escala tipográfica (piso >= 14px respetado).
3. **Control de dependencias:** `@radix-ui/react-tabs@1.1.21` e `input-otp@1.5.0` quedaron fijadas con versión exacta en `package.json`, lockfile sincronizado y agregadas en la lista blanca de `.agents/rules/25-stack-y-patrones.md` y `tools/verify-approved-packages.test.ts`.
4. **Semántica nativa y accesibilidad:**
   - `Table` conserva elementos nativos (`table`, `thead`, `tbody`, `tfoot`, `tr`, `th`, `td`, `caption`).
   - `Tabs` delega en las primitivas accesibles de Radix UI con gestión adecuada de foco y roles `tab`/`tablist`/`tabpanel`.
   - `InputOTP` preserva un único input accesible con `autocomplete="one-time-code"` y soporte para pegado de 6 dígitos.

---

## PR108-H01 · Uso de non-null assertion `!` en InputOTPSlot viola AGENTS.md §4 · BLOQUEANTE

- **Archivo:** `src/ui/input-otp.tsx:40`
- **Severidad:** `alto` (bloqueante)
- **Categoría:** `conventions` / `correctness`
- **Patrón:** `P01-contrato-de-framework-no-verificado` / `AGENTS.md §4`

### Defecto
En la línea 40 de `src/ui/input-otp.tsx`:

```tsx
const { char, hasFakeCaret, isActive } = inputOTPContext.slots[index]!;
```

Se incluyó el operador `!` para sortear la verificación de TypeScript bajo `noUncheckedIndexedAccess`. Sin embargo, `AGENTS.md §4` prohíbe de forma taxativa y sin excepciones:

> *«Prohibido: any, @ts-ignore, ! non-null, .only, .skip sin issue, desactivar reglas de lint o checks.»*

Además de violar la norma raíz del proyecto, en runtime si por error de maquetación se pasa un índice fuera de rango, `slots[index]!` lanza `TypeError: Cannot destructure property ... as it is undefined`.

### Decisión de Lautaro073 (D01)
Lautaro073 confirmó la opción recomendada: **reemplazar por acceso seguro con fallback sin operador `!`**.

### Corrección requerida
Desestructurar con fallback seguro:

```tsx
const slot = inputOTPContext.slots[index];
const char = slot?.char;
const hasFakeCaret = slot?.hasFakeCaret;
const isActive = slot?.isActive;
```

---

## PR108-H02 · TableFooter y TableCaption declarados en CC-010 no son importados ni probados en ui-system.test.tsx · BLOQUEANTE

- **Archivo:** `src/ui/ui-system.test.tsx:328`
- **Severidad:** `medio` (bloqueante)
- **Categoría:** `test-coverage`
- **Patrón:** `P08-control-no-cubre-lo-que-dice` / `P06-enumeracion-incompleta`

### Defecto
`docs/contracts/CC-010.md` y `src/ui/table.tsx` exportan explícitamente:

> `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption`.

Sin embargo, `src/ui/ui-system.test.tsx` solo importa y ejercita `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead` y `TableCell`. Deja fuera `TableFooter` y `TableCaption`:
1. El informe de cobertura muestra que las líneas 34-39 y 87 de `src/ui/table.tsx` quedan descubiertas (89.39% de líneas).
2. Las mutaciones independientes **M01**, **M08** y **M09** (eliminar `TableFooter` y `TableCaption` de los exports o vaciar sus implementaciones) pasan en **VERDE** (ciegas).

### Decisión de Lautaro073 (D02)
Lautaro073 confirmó la opción recomendada: **importar y renderizar `TableFooter` y `TableCaption` en `src/ui/ui-system.test.tsx`** para cerrar la cobertura de la clase completa del contrato al 100% y matar las mutaciones M01, M08 y M09.

### Corrección requerida
En `src/ui/ui-system.test.tsx`:
1. Importar `TableFooter` y `TableCaption` desde `@/ui`.
2. Agregar en el test de Table un `<TableCaption>Postulantes recientes</TableCaption>` y `<TableFooter><TableRow><TableCell>Total: 1</TableCell></TableRow></TableFooter>`.
3. Afirmar sus roles/elementos semánticos (`caption`, `rowgroup` o texto).

---

## PR108-H03 · La prueba de TabsTrigger no afirma las clases visuales de activación data-[state=active] · MEJORA

- **Archivo:** `src/ui/ui-system.test.tsx:350`
- **Severidad:** `medio`
- **Categoría:** `test-coverage`
- **Patrón:** `P08-control-no-cubre-lo-que-dice`

### Defecto
El test de Tabs verifica la transición del atributo `data-state` (`active`/`inactive`), pero no valida que el trigger mantenga las clases visuales de activación provistas por shadcn (`data-[state=active]:bg-background` y `data-[state=active]:text-foreground`).
Como consecuencia, la mutación independiente **M07** (quitar `data-[state=active]:bg-background`) permanece **CIEGA (VERDE)**.

### Decisión de Lautaro073 (D03)
Lautaro073 confirmó la opción recomendada: **afirmar la clase de activación visual en `TabsTrigger`**.

### Corrección requerida
En `src/ui/ui-system.test.tsx`:
Agregar una aserción que verifique que el tab activo contenga la clase `data-[state=active]:bg-background`.

---

## Resultado de la batería de mutaciones (9 mutaciones)

| Mutación | Objetivo | Resultado |
|---|---|---|
| M01 | `table.tsx` omite TableFooter y TableCaption en exports | CIEGA (VERDE ❌) → resuelta con H02 |
| M02 | `table.tsx` cambia text-sm por text-base en className | DETECTADA (ROJO ✅) |
| M03 | `input-otp.tsx` corrompe {char} en InputOTPSlot | DETECTADA (ROJO ✅) |
| M04 | `input-otp.tsx` quita role="separator" de InputOTPSeparator | DETECTADA (ROJO ✅) |
| M05 | `input-otp.tsx` quita animate-pulse del caret | DETECTADA (ROJO ✅) |
| M06 | `verify-approved-packages.test.ts` quita input-otp de whitelist | DETECTADA (ROJO ✅) |
| M07 | `tabs.tsx` quita data-[state=active]:bg-background en TabsTrigger | CIEGA (VERDE ❌) → resuelta con H03 |
| M08 | `table.tsx` vacía TableFooter (renderiza null) | CIEGA (VERDE ❌) → resuelta con H02 |
| M09 | `table.tsx` vacía TableCaption (renderiza null) | CIEGA (VERDE ❌) → resuelta con H02 |

---

## Lecciones para el proyecto

- `AG-108`: Adaptar código de registry (shadcn/ui) exige auditar operadores non-null (`!`) frente a `noUncheckedIndexedAccess`.
