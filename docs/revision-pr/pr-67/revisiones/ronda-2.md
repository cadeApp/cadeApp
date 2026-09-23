# Ronda 2 — PR #67 (T-112)

**SHA revisado:** `69d3769`
**Fecha:** 2026-09-23
**Revisor:** P2 (agy)

---

## Checks locales

| Check                                                       | Resultado                                            |
| ----------------------------------------------------------- | ---------------------------------------------------- |
| `pnpm typecheck`                                            | ✅ (0 errores)                                       |
| `pnpm lint`                                                 | ✅ (0 warnings/errores)                              |
| `pnpm test`                                                 | ✅ (25 suites, 228 tests)                            |
| `pnpm build`                                                | ✅ (`/requests/new` 156 kB First Load JS < 180 kB)   |
| `pnpm test:db`                                              | n.a. (no toca `supabase/` ni `src/server/supabase/`) |
| Prettier (`src/features/requests/**`)                       | ✅                                                   |
| Prettier (`docs/tasks/T-112.md`, `docs/tasks/log/T-112.md`) | ✅                                                   |

## Alcance

Todos los archivos modificados están dentro de los «Archivos permitidos» de T-112:

- `src/features/requests/**` ✅
- `src/app/(merchant)/requests/new/**` ✅
- `docs/tasks/T-112.md` ✅
- `docs/tasks/log/T-112.md` ✅
- `docs/revision-pr/**` ✅

No se modificaron contratos (`src/domain/**`, `src/types/database.types.ts`, `src/ui/**`). ✅
No se agregaron dependencias nuevas. ✅

## Estado de hallazgos Ronda 1

### PR67-H01 (BLOQUEANTE) · `text-success` en feedback de GPS

- **Estado:** ✅ Resuelto y verificado.
- **Acción realizada:** Se reemplazó el token inexistente `text-success` en `src/features/requests/components/create-request-form.tsx:304,377` por `text-primary`.
- **Prueba en rojo demostrada:** `AssertionError: expected 'text-success flex items-center gap-1.5 text-xs font-semibold' to contain 'text-primary'`.
- **Prueba en verde demostrada:** Pasó prueba unitaria de regresión en `src/features/requests/components/create-request-form.test.tsx`.
- **Verificación específica:** `git grep text-success src/features/requests/components/create-request-form.tsx` → 0 resultados.

### PR67-H02 (MEJORA) · Migración a `react-hook-form` + `zodResolver`

- **Estado:** ✅ Resuelto y verificado.
- **Acción realizada:** Se migró el componente `create-request-form.tsx` de 18 `React.useState` a `useForm<CreateDeliveryRequestInput, unknown, CreateDeliveryRequestOutput>` con `zodResolver(createDeliveryRequestSchema)` de `@hookform/resolvers/zod`. Se utilizan `register`, `handleSubmit`, `setValue` para campos controlados, y mensajes de error por campo accesibles con `role="alert"`.

### PR67-H03 (MEJORA) · `as unknown as AppSupabaseClient` — residual AG-59

- **Estado:** ✅ Resuelto y verificado.
- **Acción realizada:** Se eliminó el cast `as unknown as AppSupabaseClient` y el alias de tipo en `actions.ts` y `queries.ts`. Se consume `createClient()` de forma directa con tipos genéricos explícitos (`select<string, ZoneCentroidRow>`) e inserciones tipadas con `as never` idénticas a `merchants/actions.ts`.
- **Verificación específica:** `git grep "as unknown as AppSupabaseClient" src/features/requests/` → 0 resultados.

### PR67-H04 (MEJORA) · Prettier en `docs/tasks/`

- **Estado:** ✅ Resuelto y verificado.
- **Acción realizada:** Se ejecutó `pnpm prettier --write docs/tasks/T-112.md docs/tasks/log/T-112.md`.
- **Verificación específica:** `pnpm prettier --check docs/tasks/T-112.md docs/tasks/log/T-112.md` → All matched files use Prettier code style!

### PR67-H05 (MEJORA) · `<select>` nativo vs `src/ui/select.tsx`

- **Estado:** ✅ Resuelto (Justificación técnica por El Consejo).
- **Acción realizada:** Evaluación por El Consejo. Se determinó conservar el `<select>` nativo estilizado registrado con RHF por tres razones técnicas:
  1. `src/ui/select.tsx:90` tiene una consulta global de singleton `document.querySelector('[data-cade-select-root="true"]')` que produce comportamiento errático cuando existen múltiples instancias en el DOM (en este caso retiro y entrega).
  2. `src/ui/select.tsx:237` utiliza internamente el token inválido `text-success`.
  3. Modificar `src/ui/select.tsx` violaría los «Archivos permitidos» de T-112 y requeriría un contract-change.
  4. En entorno PWA móvil en Aguilares, el elemento `<select>` nativo dispara los selectores nativos del sistema operativo (ruedas/sheets), ofreciendo mejor usabilidad y accesibilidad para dispositivos móviles de gama baja y media.

---

## Conclusión

**Resultado:** SIN BLOQUEANTES (0)
El PR cumple plenamente con todas las reglas de AGENTS.md, DoD de T-112 y presupuesto de bundle de Next.js.
