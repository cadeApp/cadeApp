# Ronda 1 — PR #67 (T-112)

**SHA revisado:** `adf9fd7`
**Fecha:** 2026-09-23
**Revisor:** Lautaro073 (agy)

---

## Checks locales

| Check | Resultado |
|---|---|
| `pnpm typecheck` | ✅ |
| `pnpm lint` | ✅ |
| `pnpm test` | ✅ (25 suites, 227 tests) |
| `pnpm test:db` | n.a. (no toca `supabase/` ni `src/server/supabase/`) |
| Prettier (`src/features/requests/**`) | ✅ |
| Prettier (`docs/tasks/T-112.md`, `docs/tasks/log/T-112.md`) | ❌ (2 archivos con issues) |
| CI | ✅ todos salvo `approval-policy` (esperado) |

## Alcance

Todos los archivos modificados están dentro de los «Archivos permitidos» de T-112:
- `src/features/requests/**` ✅
- `src/app/(merchant)/requests/new/**` ✅
- `docs/tasks/T-112.md` ✅
- `docs/tasks/log/T-112.md` ✅

No se modificaron contratos (`src/domain/**`, `src/types/database.types.ts`, `src/ui/**`). ✅
No se agregaron dependencias nuevas. ✅

## DoD

| Criterio | Cumple |
|---|---|
| Tests del schema y de la action | ✅ 10 tests en `schemas.test.ts`, 6 en `actions.test.ts`, 4 en `queries.test.ts`, 4 en `create-request-form.test.tsx` |
| Contactos y coordenadas opcionales en `delivery_request_contacts` | ✅ |
| Cálculo de distancia server-side (Haversine + fallback centroide) | ✅ |
| Chips de cambio guardan `cash_change_amount` | ✅ |
| Bloqueo sin piloto ni suscripción | ✅ `canMerchantPublishRequest` + test |
| `pnpm typecheck && pnpm lint && pnpm test` | ✅ |
| Sin cambios fuera de «Archivos permitidos» | ✅ |
| Bitácora `docs/tasks/log/T-112.md` al día | ✅ |

## Hallazgos

### BLOQUEANTES (1)

#### H01 · `text-success` no es un token de Tailwind — feedback de GPS invisible
- **Archivo:** `create-request-form.tsx:304,377`
- **Patrón:** P13-accesibilidad-no-considerada
- **Severidad:** alto

Las líneas 304 y 377 usan la clase `text-success` para mostrar "Pin de retiro fijado" y
"Pin de entrega fijado" tras obtener las coordenadas GPS:

```tsx
<span className="text-success ml-3 inline-flex items-center gap-1 text-sm font-medium">
```

`tailwind.config.ts` no define un color `success`. Tailwind silenciosamente ignora clases
que no matchean ninguna utilidad, así que este `<span>` hereda el color del padre (probablemente
`text-foreground`), pero el autor claramente pretendía un color verde de éxito.

**Verificación:**
```bash
grep 'success' tailwind.config.ts
# → 0 resultados
```

**Qué hay que hacer:**
1. Definir un token `success` / `success-foreground` en `tailwind.config.ts`, o
2. Usar un token existente como `text-primary` con un ícono `CheckCircle2` (que ya está).

> **Nota:** `tailwind.config.ts` no está en «Archivos permitidos» de T-112. Esto necesita
> coordinación: o se agrega el token en otra tarea, o se reemplaza por un token existente.

---

### MEJORAS (4)

#### H02 · Formulario con 18 `React.useState` en vez de `react-hook-form`
- **Archivo:** `create-request-form.tsx:48-96`
- **Patrón:** P10-desvio-de-ficha-sin-consultar
- **Severidad:** bajo

`AGENTS.md` §3 establece: "formularios con `react-hook-form` + Zod". El paquete ya está en
`package.json` (línea 39: `"react-hook-form": "7.88.0"`). El formulario maneja 18 estados
individuales con `React.useState` y duplica la validación del schema Zod con guardas manuales
en `handleSubmit`. No es un bloqueante porque `useState` para UI local está permitido (§3),
pero el formulario completo se beneficiaría de `useForm` + `zodResolver` para centralizar
validación, errores por campo y reducir boilerplate.

#### H03 · `as unknown as AppSupabaseClient` — residual AG-59
- **Archivo:** `actions.ts:21`, `queries.ts:32`
- **Patrón:** P12-plantilla-propaga-antipatron
- **Severidad:** bajo

Es el mismo workaround documentado en AG-59 (PR #61): el return type de `createClient()`
de `src/server/supabase/server.ts` no matchea el generic `SupabaseClient<Database>` por el
tipo de `@supabase/ssr`. El cast `as unknown as AppSupabaseClient` es correcto dado el
constraint, pero cada feature lo copia. La raíz se resuelve con un `contract-change` en
`server.ts`.

#### H04 · Prettier formatting en docs
- **Archivo:** `docs/tasks/T-112.md`, `docs/tasks/log/T-112.md`
- **Patrón:** P19-cuerpo-de-pr-fuera-de-template
- **Severidad:** bajo

```bash
npx prettier --check docs/tasks/T-112.md docs/tasks/log/T-112.md
# → Code style issues found in 2 files
```

`pnpm format:check` solo cubre `{src,tools}/**`, no `docs/`. Correr `npx prettier --write`
sobre ambos archivos.

#### H05 · HTML `<select>` nativo en vez de `@radix-ui/react-select`
- **Archivo:** `create-request-form.tsx:255,327`
- **Patrón:** P12-plantilla-propaga-antipatron
- **Severidad:** bajo

Los selectores de barrio usan `<select>` HTML nativo con clases inline en vez del componente
`Select` de `@radix-ui/react-select` que ya está en `package.json` (`2.3.7`). `AGENTS.md` §3
dice "Antes de crear algo, buscá si ya existe en `src/ui`". El `<select>` nativo funciona,
pero pierde la consistencia visual del sistema de diseño y la accesibilidad mejorada de Radix.

---

## Lo que la autorrevisión del PR declaró vs lo que encontró esta revisión

El informe del PR (sección "Informe de revisión de agy") declaró:
- Resultado: SIN BLOQUEANTES
- MEJORAS: ninguno

Esta revisión encontró **1 bloqueante** (H01, `text-success` invisible) y **4 mejoras**.
H01 es un caso clásico de que Tailwind no reporta errores en clases no existentes y los
tests de componente no verifican estilos — coherente con `por_que_paso_los_checks`.

## Cosas bien hechas

1. **Estructura del módulo** — separación limpia entre `schemas.ts`, `actions.ts`, `queries.ts`,
   `copy.ts` y componentes, con barrel exports correctos en `index.ts` y `server.ts`.
2. **`server-only`** en `queries.ts` y `server.ts` — protege las queries de importación client-side. ✅
3. **Validación Zod completa** — coordenadas en bounding box de Aguilares, pares lat/lng
   consistentes, consentimiento obligatorio, cambio condicional con refine+transform.
4. **Haversine con fallback a centroides** — implementación correcta del cálculo de distancia
   con fallback server-side bien testeado.
5. **`canMerchantPublishRequest`** — reutiliza el contrato de dominio sin reimplementar.
6. **Skeleton** — imita la forma final del formulario con secciones correspondientes.
7. **TDD** — la bitácora documenta la fase roja con tests fallando antes de implementar.
8. **Accesibilidad** — labels con `htmlFor`, `min-h-[44px]`/`min-h-[48px]` touch targets,
   `role="alert"` para errores, `required` en campos obligatorios.
9. **Bundle** — `/requests/new` a 142 kB First Load JS, dentro del presupuesto de 180 kB.
10. **Datos del destinatario** — correctamente segregados en `delivery_request_contacts`,
    nunca en logs ni en la tabla principal.
