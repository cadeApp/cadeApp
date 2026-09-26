# Comandos reproducibles — PR #98

## Ronda 5 — SHA f8f11c3

### H13 · source productivo

Merchant y courier usan:

```ts
.upsert(payload, {
  onConflict: 'profile_id,document,version',
  ignoreDuplicates: true,
})
```

La implementación es compatible con idempotencia de misma versión sin reescribir la fila histórica.

### H14 · mutation proof inválida

Los tests actuales no editan `actions.ts`.

En lugar de eso crean un segundo mock que devuelve manualmente:

```text
code: 23505
duplicate key value violates unique constraint consents_pkey
```

y luego verifican `INTERNAL_ERROR`.

Criterio de R6:
- mismo test/fake;
- source correcto => verde;
- mutar realmente `upsert` a `insert` => rojo;
- restauración source en finally si se usa harness.

### H08 · axe real

`src/features/legal/evidence/T-311/axe-summary.md`:

```text
/onboarding/vehicle
Violaciones WCAG AA: 1
SERIOUS color-contrast
ratio 2.39:1
expected 4.5:1
```

`axe-report.json`:
```text
courier_onboarding.violationsCount = 1
```

Source causal:
```tsx
src/features/courier-onboarding/components/step-indicator.tsx
isDone ? 'text-primary' : ...
```

D06=A autoriza ese archivo.

### Artefactos

Existen 18 PNG no vacíos para 390x844 y 360x800 más los dos reportes axe.

### CI

No se inspecciona CI final mientras H08/H14 estén abiertos.
