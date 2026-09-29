# Revisión PR #61 — T-111 (`feat/T-111-merchant-onboarding`) · Ronda 1

- **Resultado:** **CON BLOQUEANTES (4)**
- **Rama / SHA revisado:** `feat/T-111-merchant-onboarding` @ `49642ed4e18a23909587545f04642149ad736f57`
- **Alcance verificado contra `docs/tasks/T-111.md`:** 13 archivos, **0 fuera de «Archivos permitidos»** (`src/features/merchants/**`, `src/app/(merchant)/onboarding/**`, `docs/tasks/T-111.md`, `docs/tasks/log/T-111.md`)
- **Checks locales:**
  - `pnpm typecheck`: exit 0
  - `pnpm lint`: `✔ No ESLint warnings or errors` (exit 0)
  - `pnpm test`: 17 passed, 138 passed (1 fallo preexistente en `verify-scaffold.test.ts` por timeout de ESLint, no introducido por este PR)
  - `npx prettier --check`: `docs/tasks/log/T-111.md` fuera de formato
- **CI real:** `typecheck` ✅ · `lint` ✅ · `unit` ✅ · `db-tests` ✅ · `build` ✅ · `bundle-budget` ✅ · `audit` ✅ · `approval-policy` ❌ (esperado: revisión aún no pegada)

---

## BLOQUEANTES

### PR61-H01 · `server.ts` falta `import 'server-only'` (P08)

**Archivo:** [`src/features/merchants/server.ts:1-2`](file:///src/features/merchants/server.ts)
**Severidad:** medio · **Categoría:** correctness · **Patrón:** `P08-control-no-cubre-lo-que-dice`

`server.ts` re-exporta `queries.ts` (que sí tiene `import 'server-only'`) y `actions.ts` (que tiene `'use server'`), pero el propio barrel no empieza con `import 'server-only'`. La regla 20 lo exige para todo `src/features/*/server.ts`; sin la guarda, un import transitivo podría incluir el módulo en un bundle de cliente sin que el build se queje.

**Comando de verificación:** `grep -c "server-only" src/features/merchants/server.ts` → `0`

→ **Agregar `import 'server-only';` como primera línea de `server.ts`.**

---

### PR61-H02 · `actions.ts:19` — doble cast `as unknown as AppSupabaseClient` (P12)

**Archivo:** [`src/features/merchants/actions.ts:19`](file:///src/features/merchants/actions.ts)
**Severidad:** medio · **Categoría:** correctness · **Patrón:** `P12-plantilla-propaga-antipatron`

```ts
const supabase = (await createClient()) as unknown as AppSupabaseClient;
```

El doble cast (`as unknown as`) elude por completo el sistema de tipos, igual que un `@ts-ignore`. El tipo inventado `AppSupabaseClient = SupabaseClient<Database, 'public', 'public', Database['public']>` no corresponde a los genéricos reales de `SupabaseClient` (que acepta 3 genéricos, no 4 en la versión `2.x` actual). Si `createClient()` ya devuelve un tipo compatible con las operaciones usadas (`from`, `auth`, etc.), el cast sobra; si no, la solución correcta es ajustar el tipo devuelto por `createClient` en `src/server/supabase/server.ts` (vía `contract-change` si es necesario), no forzar el tipo en la feature.

→ **Eliminar el doble cast y el tipo `AppSupabaseClient`. Usar el tipo devuelto por `createClient()` directamente. Si hay una incompatibilidad de tipos legítima, escalar con `contract-change`.**

---

### PR61-H03 · El formulario no usa `react-hook-form` + `zodResolver` (P10)

**Archivo:** [`src/features/merchants/components/onboarding-form.tsx:17-26`](file:///src/features/merchants/components/onboarding-form.tsx)
**Severidad:** medio · **Categoría:** conventions · **Patrón:** `P10-desvio-de-ficha-sin-consultar`

La regla 25 establece que los formularios se manejan con `react-hook-form` + `zodResolver` con el esquema de `schemas.ts`. El componente usa 8 llamadas a `useState` con manejo manual de `handleSubmit`, `e.preventDefault()` y `setIsPending` explícito, en vez de:

```ts
const form = useForm<MerchantOnboardingInput>({
  resolver: zodResolver(merchantOnboardingSchema),
});
```

Esto duplica la validación (ya hecha en Zod), omite la validación inline por campo (que la regla 60 pide), y establece un patrón que se va a copiar a las features de courier y admin.

→ **Refactorizar a `react-hook-form` + `zodResolver(merchantOnboardingSchema)`. La validación por campo queda gratis y el estado de `isPending` sale de `formState`.**

---

### PR61-H04 · Fallback silencioso `'1.0'` para `pilot_terms_version` (P06)

**Archivo:** [`src/features/merchants/actions.ts:59-64`](file:///src/features/merchants/actions.ts)
**Severidad:** alto · **Categoría:** correctness · **Patrón:** `P06-enumeracion-incompleta`

```ts
const pilotTermsVersion =
  typeof settingData?.value === 'string'
    ? settingData.value
    : typeof settingData?.value === 'number'
      ? String(settingData.value)
      : '1.0';
```

Si `platform_settings` no tiene la clave `pilot_terms_version`, la consulta devuelve error o `null`, y el código registra silenciosamente el consentimiento con versión `'1.0'`. El consentimiento tiene valor probatorio (`consents` es una tabla que no se debe modificar después); si la versión que se graba no corresponde a la real, el registro pierde validez sin que nadie se entere.

Esto replica el patrón `AG-54` de PR #60: un fallback silencioso que convierte un fallo de lectura en un dato erróneo. La invariante del producto (AGENTS.md §2) establece que la validación crítica ocurre en el servidor: si no se puede obtener la versión configurada, la acción debe fallar con un código de error, no inventar un valor.

→ **Si `settingData` es `null` o la lectura falla, retornar `err('INTERNAL_ERROR')`. Nunca fabricar una versión de consentimiento.**

---

## MEJORAS (no bloqueantes)

### PR61-H05 · Textos hardcodeados fuera de `copy.ts`

**Archivo:** `onboarding-form.tsx:34,57,248,254,305`
**Severidad:** bajo · **Categoría:** conventions

Cinco strings en español directamente en el componente en lugar de `merchantCopy`:

- L34: `'Tu navegador no soporta geolocalización.'`
- L57: `'No pudimos obtener tu ubicación actual. Podés continuar con la dirección escrita.'`
- L248: `'Obteniendo ubicación...'`
- L254: `'Ubicación marcada: (...)'`
- L305: `'Acepto los '`

→ **Moverlos a `merchantCopy.onboarding`.**

---

### PR61-H06 · Checkbox de términos `h-4 w-4` (16×16 px, < 48px target)

**Archivo:** `onboarding-form.tsx:302`
**Severidad:** bajo · **Categoría:** accesibilidad · **Patrón:** `P13-accesibilidad-no-considerada`

El checkbox nativo es `h-4 w-4` (16×16 px CSS). Aunque el label está asociado con `htmlFor`, el target táctil del checkbox por sí solo no alcanza los 48px mínimos del WCAG 2.2 AA. La label no siempre amplía el target en todos los navegadores móviles para checkboxes nativos.

→ **Envolver en un contenedor con `min-h-12 min-w-12` (48px) o aumentar el tamaño del checkbox.**

---

### PR61-H07 · Valor arbitrario `min-h-[80px]` en textarea

**Archivo:** `onboarding-form.tsx:280`
**Severidad:** bajo · **Categoría:** conventions

`min-h-[80px]` es un valor arbitrario de Tailwind. La regla 60 prohíbe valores arbitrarios; el equivalente estándar es `min-h-20` (80px = 5rem en base 16).

→ **Reemplazar `min-h-[80px]` por `min-h-20`.**

---

### PR61-H08 · `accepted_at` generado por `new Date()` del servidor

**Archivo:** `actions.ts:71`
**Severidad:** bajo · **Categoría:** correctness

`accepted_at: new Date().toISOString()` usa el reloj del servidor de Next.js en lugar del `DEFAULT now()` de la columna en la base de datos. Para un registro con valor probatorio (`consents`), es preferible que la hora la ponga la base de datos para evitar desfases.

→ **Omitir `accepted_at` del payload y dejar que la columna use su `DEFAULT`.**

---

### PR61-H09 · `docs/tasks/log/T-111.md` fuera de formato Prettier

**Archivo:** `docs/tasks/log/T-111.md`
**Severidad:** bajo · **Categoría:** conventions

→ **Correr `npx prettier --write docs/tasks/log/T-111.md`.**

---

## Contraste con la autorrevisión del agy

El informe del agy en el cuerpo del PR declaró:

> `Resultado: SIN BLOQUEANTES · MEJORAS: ninguno`

La revisión independiente encontró **4 bloqueantes** (1 alto y 3 medios) y **5 mejoras**. Los bloqueantes no detectados:

- `H02` (doble cast `as unknown as`): el agy lo menciona en la bitácora como una _decisión_ ("se resolvió la discrepancia definiendo `AppSupabaseClient`"), no como un defecto. Esto es un punto ciego conocido: quien escribe la solución no la evalúa como riesgo.
- `H03` (no usar `react-hook-form`): el agy no mencionó la regla 25 sobre formularios en su informe ni en la bitácora. La implementación manual funciona, así que los checks pasan.
- `H04` (fallback `'1.0'`): réplica exacta del patrón `AG-54` que ya se bloqueó en PR #60, en un contexto distinto. El agy no lo cruzó.

Patrón consistente con `COMO-ENTREGAR.md`: la autorrevisión no encuentra lo que no se pensó al escribirlo.
