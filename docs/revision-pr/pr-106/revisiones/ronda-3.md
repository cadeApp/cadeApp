# PR #106 · T-122 — Ronda 3

- **SHA funcional revisado:** `f3144add41b4c493897c4a78323445cf4545637b`
- **Base:** `develop@bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Resultado:** **CON BLOQUEANTES (6)**
- **Cerrados en R3:** H03, H10
- **H07:** parcial (Zod resuelto; cursor pendiente)
- **H11:** aceptado por decisión D04-B y diferido a T-300
- **Nuevos:** H12–H16

## Decisiones de Lautaro073

- **D03-A:** autorizado `src/app/(admin)/admin-nav.test.tsx`; se incorpora formalmente a la ficha.
- **D04-B:** H11 deja de bloquear T-122 y pasa a seguimiento obligatorio en T-300/staging. No se declara verificado.

## Verificación independiente de correcciones R2

La revisión relanzó el job unit del SHA funcional, en vez de aceptar solo la bitácora del autor.

Job reviewer-triggered: `108447348012`

```text
src/features/admin/actions.test.ts             14/14 PASS
src/features/admin/schemas.test.ts              8/8 PASS
src/features/admin/components/mfa-form.test.tsx 1/1 PASS
src/app/(admin)/admin-nav.test.tsx              1/1 PASS
Test Files 61 passed
Tests      647 passed
```

Por inspección, los controles sí ejercen las propiedades de H03 y H10. H07 valida correctamente `tab/page`, pero la implementación sigue usando paginación por offset.

## BLOQUEANTES

### PR106-H07 — paginación por cursor todavía pendiente

La corrección de R2 resolvió el parseo de `tab` y `page`, pero `getApplicantsQueue` sigue usando:

```ts
const from = (page - 1) * pageSize;
const to = from + pageSize - 1;
...
.range(from, to)
```

Regla 25 exige lista paginada con cursor por `created_at/id`. `couriers` no tiene `created_at`, pero `profile_id` es su PK UUID y sirve como cursor estable por id.

Debe migrarse la lectura a cursor por `profile_id` y mantener un máximo de 50.

### PR106-H12 — lecturas con service role

`src/features/admin/queries.ts` importa `createAdminClient` y lo usa tanto en cola como detalle.

Esto contradice Regla 20 (`queries.ts` lee con cliente server respetando RLS) y evita que las policies `couriers_select_admin` / `courier_documents_select_admin` sean la frontera efectiva. Supabase documenta que service/secret keys pueden bypass RLS.

Debe usarse `await createClient()` de `@/server/supabase/server` para estas lecturas. El service role queda reservado al caso explícito de signed URL/audit de la Server Action después de `requireAdminAal2()`.

### PR106-H13 — fronteras y formularios sin Zod/RHF

Las cinco Server Actions de admin reciben estructuras tipadas/manuales y no ejecutan `safeParse`. La ruta `[id]` tampoco valida UUID antes de consultar. Además `MfaForm` y el formulario de motivo A02 no usan `react-hook-form` + `zodResolver`.

Debe existir una única fuente de verdad en `src/features/admin/schemas.ts` y reutilizarse en cliente/servidor.

### PR106-H14 — A02 incompleto frente al contrato visual

Tres problemas de una misma pantalla:

1. la selección documental usa botones manuales, no `@/ui/tabs`;
2. la decisión de aprobar/rechazar/suspender usa overlay `<div>` manual, no `@/ui/dialog`;
3. rechazar documento manda el motivo fijo `"Rechazado en revisión visual administrativa"`, mientras el export oficial abre un diálogo de “Rechazar comprobante” con textarea de motivo.

Esto impide considerar A02 implementado conforme al diseño y deja foco/Escape/focus-trap fuera del componente base probado.

### PR106-H15 — A00 sin contador TOTP

README A00 manda mantener un conteo regresivo. El export muestra `Expira en ...`; el componente actual no lo renderiza.

La documentación vigente de Supabase confirma que el intervalo TOTP es de 30 segundos. Implementar un contador derivado del reloj, no un timeout de negocio persistido.

### PR106-H16 — convenciones compartidas UI/feature

Clase enumerada completa:

- `AdminLayout` monta un segundo `<Toaster />`, aunque `src/app/providers.tsx` ya monta el único permitido.
- `admin-nav.tsx` usa `border-[#E4E7EC]` en vez de `border-border`.
- A02 tiene `min-h-[420px]`, `max-h-[500px]`, `max-h-[420px]` y `style={{ transform... }}`.
- Los `loading.tsx` construyen skeletons allí mismo en vez de delegar a `src/features/admin/components/*-skeleton.tsx`.
- La feature vuelve a implementar fechas con `toLocaleDateString/toLocaleString` en vez de `formatDate`.
- No existe `src/features/admin/copy.ts`; los textos UI están distribuidos en componentes.

`max-w-[1280px]` **no** entra en este hallazgo porque el README A00 lo prescribe explícitamente.

## CI

Run funcional `36254939942` sobre `f3144add41b4c493897c4a78323445cf4545637b`:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- db-tests ✅
- bundle-budget ✅ con warnings

El reviewer relanzó unit y volvió a obtener 61/61 archivos y 647/647 tests.

El check `approval-policy` está rojo porque todavía no existe un informe final `SIN BLOQUEANTES`; es consistente con esta Ronda 3.

## MEJORA no bloqueante

Los enlaces de navegación a Comercios/Incidentes/Parámetros/Auditoría todavía apuntan a rutas que implementarán T-123/T-124. No se trata como defecto de T-122 porque esas tareas dependen explícitamente de este shell y son las dueñas de dichas rutas.

## Resultado

**CON BLOQUEANTES (6).**

No mergear todavía.
