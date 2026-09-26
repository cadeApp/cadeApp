# PR #106 · T-122 — Ronda 4

- **SHA funcional revisado:** `e4d0ddffdbfdac9e224c7d93539c01e5eef577fa`
- **Base:** `develop@bdafee8ff04d6b620eb46dd885b62fe0d675ca49`
- **Resultado:** **CON BLOQUEANTES (2)**
- **Cerrados en R4:** H07, H12, H13, H15
- **Parciales:** H14, H16
- **H11:** aceptado/diferido a T-300 por D04-B
- **Decisiones nuevas:** ninguna

## CI funcional

Run `36261220403` sobre `e4d0ddffdbfdac9e224c7d93539c01e5eef577fa`:

```text
unit           PASS — 66 archivos / 732 tests
typecheck      PASS
lint           PASS
build          PASS
audit          PASS
db-tests       PASS — 12 archivos / 1529 tests
bundle-budget  PASS con warnings
approval-policy FAIL esperado — el body aún dice CON BLOQUEANTES
```

El body mencionaba 2 fallos locales de suite completa, pero no se reproducen en CI: el mismo SHA ejecuta 66/66 archivos y 732/732 tests en verde. No se consideran bloqueante.

La revisión relanzó además el job unit de este SHA para una segunda ejecución independiente; al redactar esta ronda el rerun está en curso.

## Cerrados

### PR106-H07 ✅
`getApplicantsQueue` ya usa keyset por `profile_id`:

```ts
.order('profile_id', { ascending: false })
.lt('profile_id', cursor) // cuando existe
.limit(pageSize + 1)
```

No hay `.range()` ni offset. `queries.test.ts` prueba primera página, cursor, fila extra y nextCursor.

### PR106-H12 ✅
`queries.ts` usa `await createClient()` para cola y detalle. Las lecturas vuelven a pasar por RLS. El service role quedó fuera de `queries.ts`.

### PR106-H13 ✅
Las cinco Server Actions parsean con Zod antes de auth/DB/RPC. La ruta `[id]` valida UUID. MFA y formularios de decisión/rechazo usan RHF + zodResolver.

### PR106-H15 ✅
A00 muestra countdown TOTP derivado del reloj y el test con fake timers prueba actualización y rollover del intervalo de 30 s.

---

## PR106-H14 · PARCIAL · BLOQUEANTE

El núcleo está arreglado: A02 usa Tabs oficiales, Dialog oficial y rechazo documental con motivo real. Quedan tres residuos:

### 1. Tabs laterales sin orientación semántica vertical

Visualmente `TabsList` es columna, pero `<Tabs>` no recibe `orientation="vertical"`. Radix queda semánticamente horizontal y el teclado usa el modelo horizontal.

**Esperado:**

```tsx
<Tabs
  value={selectedDocId}
  onValueChange={setSelectedDocId}
  orientation="vertical"
  className="w-full"
>
```

Test: `tablist` debe exponer `aria-orientation="vertical"`.

### 2. Falta control de Escape + retorno de foco

Los tests solo prueban que existe `role="dialog"`. No demuestran la propiedad de accesibilidad pedida en R3.

Agregar un caso sobre el Dialog de rechazo:
1. enfocar/clickear `Rechazar documento`;
2. comprobar dialog abierto;
3. enviar `Escape`;
4. comprobar que el dialog cerró;
5. comprobar `document.activeElement === rejectButton`.

La misma propiedad base puede estar probada en `src/ui`, pero esta feature abre el Dialog de forma controlada sin `DialogTrigger`; hay que comprobar su wiring concreto.

### 3. Tercer giro roto

`ROTATION_CLASSES` contiene:

```ts
270: 'rotate-270'
```

El repo usa Tailwind `3.4.19`, cuyo theme no extiende `rotate`. La escala oficial v3 tiene `rotate-90` y `rotate-180`, pero no `rotate-270`; para 270° puede usarse `-rotate-90`.

**Esperado:**

```ts
const ROTATION_CLASSES = {
  0: 'rotate-0',
  90: 'rotate-90',
  180: 'rotate-180',
  270: '-rotate-90',
} as const;
```

Agregar test del visor:
- cargar documento;
- click Rotar 3 veces → imagen contiene `-rotate-90`;
- cuarto click → vuelve a `rotate-0`.

No usar `rotate-[270deg]`: Regla 60 prohíbe arbitrarios.

---

## PR106-H16 · PARCIAL · BLOQUEANTE

Se corrigieron Toaster duplicado, tokens principales, skeletons, `formatDate` y estilos inline. Pero la clase de convenciones todavía no está cerrada.

### A. copy.ts todavía no gobierna la UI

`copy.ts` existe, pero:
- `AdminNav` no importa `ADMIN_COPY`;
- `ApplicantsQueue` lo importa pero no lo usa;
- `MfaForm` no lo importa;
- A02 mantiene `DOC_KIND_LABELS`, botones, labels, placeholders y toasts hardcodeados.

Además aparecen valores internos en inglés:
- `applicant.status.toUpperCase()` → PENDING/APPROVED/REJECTED/SUSPENDED;
- `doc.status.toUpperCase()` → SUBMITTED/VERIFIED/REJECTED;
- `vehicleType.toUpperCase()` puede mostrar BIKE/CAR/WALK.

Regla 60 exige UI es-AR desde `copy.ts`.

### B. errores de Actions ignoran DomainErrorCode

A02 hace, por ejemplo:

```ts
if (!res.ok) notify.error('Error al actualizar el estado del documento.');
```

Regla 60 exige usar el mensaje asociado a `DomainErrorCode`.

Usar:

```ts
import { getDomainErrorMessage } from '@/lib/error-messages';

if (!res.ok) {
  notify.error(getDomainErrorMessage(res.code));
  return;
}
```

Aplicar a resultados fallidos de view/verify/decide/suspend. Los fallos excepcionales de conexión pueden usar copy propio.

### C. animaciones locales todavía presentes

Regla 60: animaciones solo con Motion/presets compartidos.

Quedan:
- `transition-colors` en `admin-nav.tsx`;
- `transition-colors` en `applicants-queue.tsx`;
- `transition-transform duration-200` en A02.

No se necesita animación para cerrar T-122: eliminar esas clases. No reemplazar por curvas/duraciones locales nuevas.

### Control anti-regresión esperado

Extender `admin.test.ts`:
- ningún `transition-`, `duration-` o `animate-` en código de feature/app admin;
- AdminNav, ApplicantsQueue y MfaForm importan/usan `ADMIN_COPY`;
- A02 no declara `DOC_KIND_LABELS` local;
- no existe `.status.toUpperCase()` ni `.vehicleType.toUpperCase()` en componentes admin;
- ningún `notify.success('...')` / `notify.error('...')` literal en componentes admin;
- A02 usa `getDomainErrorMessage` para `res.code`.

## Resultado

**CON BLOQUEANTES (2).**

No mergear todavía.
