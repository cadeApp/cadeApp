# Evidencia RED — T-431 (PR #688)

Cada bloque: mutación aplicada en el árbol de trabajo, comando y extracto de la salida. Después de cada mutación se restauró el archivo (`git diff` vacío).

## R1 — la página del comercio deja de pasar los textos del comercio (H01)

Mutación: `<EmbeddedPushPermissionPrompt copy={PUSH_COPY.merchantPrompt} />` → `<EmbeddedPushPermissionPrompt />`.

```text
$ pnpm vitest run "src/app/(merchant)/merchant/plan/notifications"
     × la del comercio carga el componente con los textos del comercio 1023ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 1 passed (2)
```

## R2 — MerchantNav con la comparación exacta de develop (D01)

Estado previo al arreglo: `active: pathname === '/merchant/plan'`.

```text
$ pnpm vitest run "src/app/(merchant)/merchant-nav.test.tsx"
     × en /merchant/plan/notifications «Cuenta» queda activa 15ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
      Tests  1 failed | 2 passed (3)
```

## R3 — las tres pruebas originales contra la implementación de develop

Mutación: `git show origin/develop:<archivo> > <archivo>` para `push-permission-prompt.tsx`, `push/copy.ts`, `merchants-table.tsx`, `admin/copy.ts` y `merchant/plan/page.tsx`; las pruebas nuevas quedan como en la rama.

```text
$ pnpm vitest run src/features/notifications/push/components src/features/admin/components/merchants-table.test.tsx "src/app/(merchant)/merchant/plan/page.test.tsx"
     × con los textos del comercio los muestra y no queda ninguno del repartidor 12ms
     × T-431: la Cuenta enlaza a la configuración de avisos del comercio 106ms
     × T-431: el teléfono abre WhatsApp en otra pestaña y sin teléfono no hay enlace 83ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
      Tests  3 failed | 28 passed (31)
```

