# PR #251 · T-313 — Ronda 7

- **SHA funcional revalidado:** `bce333fede77737a66d3afae8b43a19ce6dc8747`
- **Commit previo de revisión:** `e0ae45c9306813461b86d17381fd10b791b2de23`
- **Fecha:** 2026-10-06
- **Resultado:** CON BLOQUEANTES (2)
- **Hallazgos nuevos:** 1 · H09
- **Decisiones nuevas:** 0

## Resultado después del cambio manual en Supabase Develop

Se desactivó **Confirm Email** en Develop y se relanzó el run `37433304282`.

Attempt 2:

```text
35 passed
1 failed
```

T-313:

- ✅ `DoD: Un courier no entra a (merchant)`
- ✅ `DoD: Sin consentimiento guardado el comercio no llega al panel`
- ❌ alta completa: falla solo en la aserción global de alert

El artifact del fallo muestra:

```text
heading "Revisá tu email"
paragraph de éxito de registro
alert [vacío]
```

El trace identifica ese alert exactamente como:

```html
<NEXT-ROUTE-ANNOUNCER>
  #shadow-root
    <div
      id="__next-route-announcer__"
      aria-live="assertive"
      role="alert"
    />
</NEXT-ROUTE-ANNOUNCER>
```

Ese elemento ya existe antes del submit y sigue presente después del éxito.

## H09 — NUEVO · BLOQUEANTE

En `merchant-registration.spec.ts:184`:

```ts
await expect(page.getByRole('alert')).toHaveCount(0);
```

consulta **todos** los alerts accesibles de la página. Playwright atraviesa el shadow root abierto del route announcer de Next.js, por lo que la aserción nunca puede representar de forma fiable “no hubo error de registro”.

La corrección debe mantener la intención y acotar el selector al formulario de registro, por ejemplo:

```ts
const registrationError = page.locator('form').getByRole('alert');
await expect(registrationError).toHaveCount(0);
await expect(page.getByRole('heading', { name: /revisá tu email/i })).toBeVisible();
```

No eliminar la comprobación de error y no tocar código productivo.

El RED actual ya demuestra el defecto del selector. No crear una prueba falsa ni cambiar expectativas de negocio para “probar” H09.

## H04 — sigue abierto, pero el bloqueo ambiental se resolvió

H04 ya no está frenado por correo/Confirm Email.

Después de:
1. sincronizar con `develop`;
2. corregir H09;
3. obtener T-313 completo GREEN;

recién entonces ejecutar D02-A:

```text
GREEN baseline
→ probe guard merchant
→ RED específico courier
→ git revert
→ GREEN final
```

## Sincronización

La rama está **34 commits detrás** de `develop`.

Debe usarse:

```bash
git fetch origin
git merge origin/develop
```

No rebase.

## P3

Sigue sin existir visto bueno explícito P3 sobre el spec.

## Veredicto

**CON BLOQUEANTES (2): H09 primero; H04 después.**

No apruebo ni mergeo.
