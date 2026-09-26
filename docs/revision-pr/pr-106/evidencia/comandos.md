# Evidencia — PR #106 / T-122 · Ronda 1

## Identidad

```text
PR:   #106
Tarea: T-122
Head: 085d2c3d85c49c17d950c217353b91d4a6ffbdd6
Base: 366a2b859be586278bff9245b3f1ce1d1b6533ec
Merge ref GitHub: 72a1e0944ba37177f058e03f974b35dd9ba0a8b8
Mergeable: true
Changed files: 20
```

Todos los archivos cambiados están dentro del alcance original de la ficha.

## RED inicial real

Commit `8cdd5396fc23931e69fadaef458c6551a23b0c83`  
Workflow `36220145463`  
Job unit `108343734457`

```text
src/features/admin/admin.test.ts (13 tests | 7 failed)

expected 'INTERNAL_ERROR' to be 'AAL2_REQUIRED'
expected 'INTERNAL_ERROR' to be 'REASON_REQUIRED'
expected false to be true
expected 0 to be greater than 0
expected null not to be null

Test Files  1 failed | 55 passed (56)
Tests       7 failed | 607 passed (614)
```

El job alcanzó la salida roja; el workflow fue cancelado después por pushes posteriores.

## H01 · rutas publicadas por Next

Build del SHA revisado, job `108347874868`:

```text
Route (app)
ƒ /applicants
ƒ /applicants/[id]
○ /couriers
ƒ /login/mfa
```

No existe `/admin/applicants` en la tabla de build.

### Mutación/control requerido

Agregar a route-integrity un control específico del shell admin:

```text
/admin/applicants              -> page real
/admin/applicants/<uuid>       -> [id]/page real
/admin/couriers                -> alias real
```

Sobre el SHA actual, debe quedar rojo.

## H02 · doble salto MFA

Código actual:

```text
/admin/applicants + admin aal1
  -> /login?mfaRequired=1&redirectTo=...

/login + la misma sesión admin
  -> /
```

Control requerido: seguir ambos saltos y exigir destino MFA.

## H03 · redirectTo

Fuente:

```text
page.tsx: <MfaForm redirectTo={resolvedParams.redirectTo} />
mfa-form.tsx: router.push(redirectTo)
```

Caso reviewer-owned:

```text
redirectTo = javascript:alert(1)
```

Debe ser rechazado antes de llegar a `router.push`. La documentación vigente de Next App Router advierte que enviar URLs no confiables a `router.push`/`router.replace` puede ejecutar URLs `javascript:`.

## H04 · identidad de RPC

Actions:

```text
decideCourierAction  -> createAdminClient() -> adminDecideCourierRpc
suspendCourierAction -> createAdminClient() -> adminSuspendCourierRpc
verifyCourierDocumentAction -> createAdminClient() -> adminVerifyDocumentRpc
```

Contrato DB de T-105:

```sql
perform app_private.assert_admin_aal2();

auth.uid() is not null
profiles.id = auth.uid() and role = 'admin'
auth.jwt()->>'aal' = 'aal2'
```

La documentación vigente de Supabase distingue el JWT service_role del JWT autenticado de usuario; service_role no representa el sub/aal de la sesión admin.

Mutación/control requerido: sustituir `expect.anything()` por el cliente de sesión exacto.

## H05 · input real de admin_verify_document

```text
Contrato: documentId + decision + reason
Action:   documentId + verified + rejectionReason
```

Control requerido: expectativa canónica antes de tocar implementación; rojo sobre el SHA actual.

## H06 · shadcn

`components.json`:

```json
{
  "aliases": {
    "ui": "@/ui"
  }
}
```

`src/ui/` ya contiene Button, Card, Dialog, Sheet, Select, Textarea, etc. No contiene Table/Tabs/InputOTP.

Decisión Lautaro073: **2-A** → CC separado con primitivas oficiales. No adulterar T-122 para “hacer verde” evitando el contrato.

## H07 · paginación

`getApplicantsQueue`:

```text
.from('couriers')
.select(...)
.eq('status', tab)
.order('profile_id', { ascending: false })
```

No `.range()`, `.limit()` ni cursor.

## H08 · error/loading

```text
if (error || !couriers) return [];
if (courierResult.error || !courierResult.data) return null;
```

Árbol admin actual:
- no `applicants/loading.tsx`
- no `applicants/error.tsx`
- no `applicants/[id]/loading.tsx`
- no `applicants/[id]/error.tsx`

## H09 · barrido text-xs

```text
admin-nav.tsx: 1
applicants-queue.tsx: 5
applicant-detail-view.tsx: 6
mfa-form.tsx: 1
TOTAL: 13
```

## H10 · logout

```tsx
<form action="/login">
  <Button>Salir</Button>
</form>
```

No se invoca `logoutAction`.

## H11 · evidencia visual

PR comments: 0.  
Changed files: 20, sin capturas.  
Body: checkbox de verificación visual marcado `[x]`.

La evidencia debe repetirse después del arreglo de rutas.

## CI final del autor

Run `36221635164`:

```text
typecheck      PASS
lint           PASS
unit           PASS — 58 files / 621 tests
build          PASS
audit          PASS
bundle-budget  PASS
db-tests       PASS — Files=12, Tests=1529, Result: PASS
```

## Preflight local no fabricado

Se intentó:

```bash
git clone --filter=blob:none --no-checkout https://github.com/cadeApp/cadeApp.git /tmp/cadeApp-review
```

Resultado real:

```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
Could not resolve host: github.com
```

Por eso no se declara un `git merge-tree` local ni una ejecución local del verificador. La mergeability y el merge ref se obtuvieron de GitHub.

## Batería reviewer-owned para Ronda 2

No aceptar como verificación una batería escrita solo por el autor. La R2 debe comprobar como mínimo:

1. quitar el segmento filesystem `admin` → route-integrity rojo;
2. volver el guard MFA a `/login` → test de flujo rojo;
3. dejar pasar `javascript:` → test de sanitización rojo;
4. cambiar el cliente RPC a service_role → test rojo;
5. volver a `verified/rejectionReason` → test de contrato rojo;
6. reemplazar shadcn por tags paralelos → control de primitivas rojo;
7. quitar paginación → query test rojo;
8. convertir error DB a `[]`/`null` → error-state test rojo;
9. insertar un `text-xs` → control tipográfico rojo;
10. quitar signOut → logout test rojo.


---

# Ronda 2 — SHA 0c2da538cedca58d1a583d7b8c8c685e3baba7ed

## Preflight

```text
PR: #106
Base: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
Head funcional: 0c2da538cedca58d1a583d7b8c8c685e3baba7ed
Merge ref: 56eccaaef7976f253ed68ea029347bfc3898d1a0
Mergeable: true
Comentarios antes de R2: 1 (solo informe R1)
```

El merge de develop incorporó CC-010 y su documentación; no se trata como desvío de alcance del autor de T-122.

## CI

Run `36228469893`:

```text
typecheck: PASS
lint: PASS
unit: PASS — 58 / 58 files, 636 / 636 tests
build: PASS
audit: PASS
bundle-budget: success con warnings
db-tests: PASS — Files=12, Tests=1529, Result: PASS
```

Rutas del build:

```text
/admin/applicants       189 kB
/admin/applicants/[id]  189 kB
/admin/couriers         103 kB
/login/mfa              189 kB
```

Bundle checker:

```text
/admin/applicants       189 kB | Supera el límite
/admin/applicants/[id]  189 kB | Supera el límite
/login/mfa              189 kB | Supera el límite
/design-system          185 kB | Supera el límite
warning: Alguna ruta supera el presupuesto de First Load JS.
```

La regla 25 explicita el presupuesto de 180 kB para comercio/repartidor; se deja como observación no bloqueante para admin.

## Verificaciones cerradas

- H01: build + route-integrity 51/51.
- H02: guards.test 20/20.
- H04/H05: actions.test 13/13 con cliente exacto y payload canónico.
- H06: primitivas CC-010 consumidas desde src/ui.
- H08: queries.test 6/6 + loading/error presentes.
- H09: admin.test 10/10 y barrido de 0 text-xs.

## Residuos

### H03
`sanitizeAdminRedirect` está probado como helper, pero no hay test exitoso de `verifyAdminMfaAction` con redirect hostil ni test de MfaForm/router. El wiring sigue sin control independiente.

### H07
Código actual de la page:

```ts
const tab = (resolvedParams.tab as AdminApplicantTab) || 'pending';
const page = Math.max(1, Number(resolvedParams.page) || 1);
```

`page=Infinity` no cae al fallback. `tab=ghost` atraviesa el cast. No cumple parseo Zod de searchParams.

### H10
El test actual exige solo que el archivo contenga el texto `logoutAction`. No demuestra click → signOut.

### H11
No hay comentarios/capturas nuevas en PR #106. El body mantiene correctamente el checkbox visual sin marcar.

## Limitación de mutaciones

No se ejecutó una batería local porque el entorno de revisión no dispone de checkout reproducible. No se fabrican resultados. Las mutaciones que deben ejecutarse en la siguiente corrección quedan especificadas en `revisiones/ronda-2.md`.


---

# Ronda 3 — SHA f3144add41b4c493897c4a78323445cf4545637b

## Preflight

```text
PR #106
Head funcional: f3144add41b4c493897c4a78323445cf4545637b
Base: bdafee8ff04d6b620eb46dd885b62fe0d675ca49
Mergeable: true
Changed files: 38
CI run funcional: 36254939942
```

## Decisiones

- D03-A: Lautaro073 autoriza `src/app/(admin)/admin-nav.test.tsx`; se agrega a la ficha.
- D04-B: H11 se difiere a T-300/staging y deja de bloquear T-122. No se convierte en verificado.

## Rerun independiente

La revisión solicitó reejecutar el job unit ya verde del SHA funcional.

```text
Reviewer-triggered job: 108447348012
src/features/admin/actions.test.ts             14 PASS
src/features/admin/schemas.test.ts              8 PASS
src/features/admin/components/mfa-form.test.tsx 1 PASS
src/app/(admin)/admin-nav.test.tsx              1 PASS
Test Files 61 passed
Tests      647 passed
```

Esto cierra H03 y H10. En H07 demuestra que la validación de searchParams quedó protegida, pero no cambia el hecho de que la lectura sigue siendo offset-based.

## H07 residual

```text
getApplicantsQueue:
  from=(page-1)*pageSize
  to=from+pageSize-1
  .range(from,to)
```

Regla 25 exige cursor por created_at/id.

## H12 · RLS

```text
queries.ts:3   import createAdminClient
queries.ts:79  const supabase = createAdminClient()
queries.ts:166 const supabase = createAdminClient()
```

La migración RLS ya contiene:
- couriers_select_admin
- courier_documents_select_admin
- profiles_select_admin

La documentación actual de Supabase señala que service/secret keys bypass RLS. Regla 20 del repo exige lecturas de `queries.ts` con cliente server/RLS.

## H13 · fronteras

`actions.ts` no contiene `safeParse`/Zod en las acciones de T-122. La validación parcial del wrapper RPC llega demasiado tarde y no cubre `viewCourierDocumentAction`.

También `params.id` de la ruta detalle entra directo a la query.

## H14 · A02

README vinculante:
- Tabs documentales.
- primitivas shadcn/ui.
- decisiones con motivo.

Export A02:
- tabs para DNI frente/dorso/selfie/licencia/seguro;
- “Rechazar comprobante” abre textarea de motivo.

Implementación:
- botones manuales para documentos;
- overlay manual para decisión;
- motivo de rechazo documental hardcodeado.

## H15 · A00

README: “Conteo regresivo y botón primario Verificar”.  
Implementación: sin contador.

Supabase Auth TOTP documenta intervalo de 30 s.

## H16 · barrido de convenciones

Detectados:
- segundo Toaster en `src/app/(admin)/layout.tsx`;
- color arbitrario en `admin-nav.tsx`;
- heights arbitrarios + style inline en A02;
- skeletons definidos directamente en route boundaries;
- fechas con `toLocale*`;
- sin `copy.ts`.

Se excluye `max-w-[1280px]` del barrido porque A00 lo exige literalmente.

## Limitación

No se ejecutaron mutaciones reviewer-owned de H12–H16 porque requieren modificar el checkout y este entorno de revisión opera por GitHub sin checkout privado materializable. No se inventa RED. El prompt de corrección exige mutaciones reales al agente y la siguiente ronda las contrastará.


---

# Ronda 4 — SHA e4d0ddffdbfdac9e224c7d93539c01e5eef577fa

## CI

Run `36261220403`:

```text
unit: 66 / 66 files · 732 / 732 tests PASS
typecheck: PASS
lint: PASS
build: PASS
audit: PASS
db-tests: Files=12 · Tests=1529 · PASS
bundle-budget: success con warnings
approval-policy: FAIL esperado por informe CON BLOQUEANTES
```

El body del autor registró 2 fallos locales intermitentes, pero el CI del mismo SHA ejecutó la suite completa sin reproducirlos.

## Cierres R4

- H07: keyset real por `profile_id`, sin range/offset.
- H12: queries con cliente de sesión/RLS.
- H13: Zod en fronteras + RHF/zodResolver + UUID route param.
- H15: countdown TOTP con fake timers.

## H14 residual

- Tabs verticales sin `orientation="vertical"`.
- applicant-detail-view.test.tsx no contiene prueba de Escape ni focus return.
- `ROTATION_CLASSES[270] = 'rotate-270'`.
- Tailwind del repo: 3.4.19; `tailwind.config.ts` no extiende `rotate`.

## H16 residual

Regla 60 y 25:
- UI en es-AR desde copy.ts.
- mensajes de Action por DomainErrorCode.
- animaciones solo Motion/presets.

Código actual:
- ApplicantsQueue importa ADMIN_COPY pero no lo usa.
- AdminNav/MfaForm no importan ADMIN_COPY.
- A02 muestra estados/vehicle type mediante `.toUpperCase()`.
- A02 mantiene múltiples notify literals.
- transition-colors en nav/queue.
- transition-transform + duration-200 en visor.

## Rerun independiente

Rerun independiente del job unit sobre este mismo SHA: job `108458559773` → PASS, 66/66 archivos y 732/732 tests.
