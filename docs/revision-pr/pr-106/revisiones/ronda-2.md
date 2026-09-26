# PR #106 · T-122 — Ronda 2

- **SHA funcional revisado:** `0c2da538cedca58d1a583d7b8c8c685e3baba7ed`
- **Base actual:** `develop@bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Merge ref GitHub:** `56eccaaef7976f253ed68ea029347bfc3898d1a0`
- **Resultado:** **CON BLOQUEANTES (4)**
- **Cerrados en R2:** H01, H02, H04, H05, H06, H08, H09
- **Parciales:** H03, H07, H10
- **Abierto:** H11
- **Hallazgos nuevos:** ninguno

## Resumen

La corrección resolvió correctamente 7 de los 11 bloqueantes de Ronda 1. El CI funcional está verde y las rutas canónicas existen. Los cuatro residuos no requieren rediseño: son tres controles/fronteras incompletos y la evidencia visual pendiente.

## Cerrados

### PR106-H01 ✅
Next publica realmente:

```text
/admin/applicants
/admin/applicants/[id]
/admin/couriers
/login/mfa
```

El build del run `36228469893` y `route-integrity.test.ts` lo comprueban.

### PR106-H02 ✅
El flujo admin aal1 ya va a `/login/mfa?redirectTo=...`; `/login/mfa` permite aal1 y el mismo destino queda permitido tras aal2.

### PR106-H04 ✅
`decideCourierAction`, `suspendCourierAction` y `verifyCourierDocumentAction` pasan el cliente de sesión autenticada a las RPC. Los tests exigen el cliente exacto y que `createAdminClient()` no sea usado para esas RPC.

### PR106-H05 ✅
`verifyCourierDocumentAction` mapea a:

```ts
{ documentId, decision: 'verified' | 'rejected', reason }
```

Los tests cubren ambos caminos.

### PR106-H06 ✅
CC-010 está mergeado y T-122 consume las primitivas oficiales `InputOTP`, `Table` y `Tabs`.

### PR106-H08 ✅
Errores DB se propagan; ausencia real sigue siendo `null`; cola y detalle tienen `loading.tsx`/ `error.tsx` con Skeleton y retry.

### PR106-H09 ✅
0 usos de `text-xs` en todo el alcance admin y control estático dedicado.

---

## PR106-H03 · PARCIAL · BLOQUEANTE

La implementación actual es correcta:

- `verifyAdminMfaAction` devuelve `sanitizeAdminRedirect(input.redirectTo)`;
- `MfaForm` usa `router.push(res.data.redirectTo)`.

Pero el control no prueba el cableado. `actions.test.ts` solo prueba `sanitizeAdminRedirect` como función pura. Dos mutaciones siguen conceptualmente ciegas:

1. cambiar la action a `redirectTo: input.redirectTo ?? '/admin/applicants'`;
2. cambiar MfaForm a `router.push(redirectTo)`.

Los tests actuales de H03 no ejercen ninguno de esos dos puntos.

### Corrección exacta esperada

1. Agregar un caso exitoso de `verifyAdminMfaAction` con `redirectTo: 'javascript:alert(1)'` y mocks reales de `getUser → profile admin → listFactors → challenge → verify`; exigir `result.data.redirectTo === '/admin/applicants'`.
2. Agregar `src/features/admin/components/mfa-form.test.tsx` con jsdom:
   - prop `redirectTo="javascript:alert(1)"`;
   - mock de `verifyAdminMfaAction` que devuelve `{ ok:true, data:{success:true, redirectTo:'/admin/applicants'} }`;
   - completar 6 dígitos y enviar;
   - exigir `router.push('/admin/applicants')`;
   - exigir que nunca se invoque `router.push('javascript:alert(1)')`.

---

## PR106-H07 · PARCIAL · BLOQUEANTE

La lectura ya está acotada por `.range()` y `pageSize <= 50`, pero la frontera de URL sigue sin validar:

```ts
const tab = (resolvedParams.tab as AdminApplicantTab) || 'pending';
const page = Math.max(1, Number(resolvedParams.page) || 1);
```

Problemas reproducibles por inspección:

- `?page=Infinity` produce `page === Infinity` y llega a `.range(Infinity, Infinity)`;
- `?tab=ghost` atraviesa el cast y llega a `.eq('status', 'ghost')`;
- Regla 25 §4/§5 exige parsear filtros/searchParams con Zod.

### Corrección exacta esperada

Crear `src/features/admin/schemas.ts` con schemas Zod y un parser de `tab`/ `page`. El parser debe devolver:

- tab inválido/ausente → `pending`;
- page inválida, decimal, infinita, NaN o < 1 → `1`;
- page entera >= 1 → ese entero.

`src/app/(admin)/admin/applicants/page.tsx` debe usar solo ese parser; eliminar el cast `as AdminApplicantTab` y el `Number(...)` manual.

Además, `ApplicantsQueue` no debe volver a confiar en `useSearchParams().get('tab') as AdminApplicantTab`; usar `initialTab` como estado canónico renderizado y conservar `useSearchParams` solo para construir la URL.

Agregar tests RED/GREEN para:
`pending`, `approved`, `ghost`, `page=2`, `page=-1`, `page=1.5`, `page=Infinity`, `page=abc`.

---

## PR106-H10 · PARCIAL · BLOQUEANTE

La implementación sí llama `logoutAction()`, pero el control actual es insuficiente:

```ts
expect(content).toMatch(/logoutAction/);
```

Si se elimina `await logoutAction()` y queda el import, el test sigue verde.

### Corrección exacta esperada

Agregar `src/app/(admin)/admin-nav.test.tsx` (ampliación mínima de alcance autorizada por esta revisión para cerrar H10), con jsdom:

- mock de `usePathname`;
- mock de `useRouter` con `push` y `refresh`;
- mock de `logoutAction` resolviendo `ok(null)`;
- render de `<AdminNav />`;
- click real sobre el botón `Salir`;
- `await waitFor(...)`;
- exigir `logoutAction` exactamente 1 vez;
- exigir `router.push('/login')`;
- exigir `router.refresh()`.

Mutación obligatoria: quitar la línea `await logoutAction()` debe poner este test en rojo.

---

## PR106-H11 · ABIERTO · BLOQUEANTE

La PR sigue teniendo un solo comentario (Ronda 1) y no contiene capturas de implementación.

El body ahora deja el checkbox correctamente en `[ ]`, lo cual es mejor que sobredeclarar evidencia, pero el DoD todavía no está cumplido.

### Evidencia requerida

Con una sesión admin real `aal2` en un entorno ejecutable:

- A00 a 1280 px;
- A00 a 1024 px;
- A01 a 1280 px;
- A01 a 1024 px;
- A02 a 1280 px;
- A02 a 1024 px;
- recorrido completo de foco por teclado;
- contraste WCAG 2.2 AA.

No usar screenshots de Stitch como sustituto ni fixtures visuales falsos. Si no hay sesión/entorno ejecutable disponible, mantener el DoD sin marcar y reportarlo explícitamente.

---

## CI revisado

Run `36228469893` sobre `0c2da538cedca58d1a583d7b8c8c685e3baba7ed`:

```text
typecheck      PASS
lint           PASS
unit           PASS — 58 files / 636 tests
build          PASS
audit          PASS
bundle-budget  PASS (warning-only)
db-tests       PASS — 12 files / 1529 tests
```

Build:

```text
/admin/applicants       189 kB
/admin/applicants/[id]  189 kB
/admin/couriers         103 kB
/login/mfa              189 kB
```

El checker marca esas tres rutas en 189 kB como `Supera el límite`, pero la regla 25 fija explícitamente el presupuesto de 180 kB para rutas de comercio/repartidor, no admin. Se registra como observación no bloqueante; no se exige optimización para cerrar T-122.

## Batería reviewer-owned

El entorno de revisión no dispone de checkout local reproducible del repo, por lo que no se declara una mutación ejecutada que no ocurrió. Los residuos H03/H10 se identifican porque los controles actuales no ejercen el punto que dicen proteger; H07 tiene entradas concretas que atraviesan la implementación por lectura directa.

La siguiente ronda debe ejecutar como mínimo:

1. H03: mutar la action para devolver el redirect crudo → test RED.
2. H03: mutar MfaForm a `router.push(redirectTo)` → test RED.
3. H07: reemplazar el parser Zod por el cast/manual Number anterior → tests de Infinity/tab inválido RED.
4. H10: quitar `await logoutAction()` → test UI RED.
5. H11: comprobar que los adjuntos/capturas existen y corresponden a las rutas canónicas.

## Veredicto

**CON BLOQUEANTES (4).**

No aprobar ni mergear todavía.
