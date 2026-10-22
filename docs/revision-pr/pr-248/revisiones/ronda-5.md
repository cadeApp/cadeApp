# Informe de revisión — PR #248 / T-336 — Ronda 5

**HEAD revisado:** `0a495a15386c32ec39d7c1029ecef0f774f11a07`  
**Base:** `develop@59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Fecha:** 2026-10-04  
**Resultado:** **CON BLOQUEANTE RESIDUAL (1)**

## Cambios desde Ronda 4

El commit del autor toca:

- `src/features/notifications/offline/not-found-view.tsx`;
- `src/features/notifications/offline/error-view.tsx`;
- `src/features/notifications/offline/error-views.test.tsx`;
- `e2e/specs/smoke.spec.ts`;
- `docs/tasks/log/T-336.md`.

No toca `auth/server`, lo cual es correcto porque el diagnóstico concluye Caso A y no B/C.

## Producto: corrección razonable

NotFoundView y ErrorView reemplazan `next/link` por un enlace HTML nativo:

```tsx
<a href="/login">Ir al inicio</a>
```

Esto fuerza navegación documental y garantiza que middleware procese la sesión activa antes de renderizar login.

La bitácora documenta:

- cookies Supabase presentes después del login y del 404;
- navegación suave problemática;
- hard navigation a `/login` redirigiendo a `/courier/feed`;
- clasificación Caso A.

La corrección de producto es coherente con el fallo que Lautaro073 reprodujo manualmente.

## PR248-H04 — sigue abierto por control no discriminante

El E2E nuevo tiene esta lógica:

```ts
await irAlInicioButton.click();
await page.waitForTimeout(2000);

const pathnameAfterClick = new URL(page.url()).pathname;

if (pathnameAfterClick === '/login') {
  await page.goto('/login');
}

await page.waitForURL((url) => url.pathname === '/courier/feed');
```

Ese `if` invalida el test como regresión:

- con el bug original, el click deja al courier en `/login`;
- el propio test detecta ese fallo;
- luego hace una hard navigation que sí ejecuta middleware;
- termina en `/courier/feed`;
- el test puede quedar GREEN aun con la regresión original.

Por eso **no sería RED antes del fix**, contradiciendo exactamente el requisito de Ronda 4.

### Arreglo obligatorio

El test permanente debe comprobar únicamente el comportamiento del usuario:

```ts
await Promise.all([
  page.waitForURL((url) => url.pathname === '/courier/feed', { timeout: 10000 }),
  irAlInicioButton.click(),
]);

expect(new URL(page.url()).pathname).toBe('/courier/feed');
```

No debe:

- hacer `page.goto('/login')` tras un fallo;
- reloguear;
- hacer retry manual;
- usar `waitForTimeout` para darle tiempo a corregirse;
- convertir una condición fallida en un paso de diagnóstico.

El hard-navigation diagnóstico del Caso A pertenece a la bitácora, no al E2E permanente.

### RED discriminante

Con el E2E corregido:

1. baseline actual → GREEN;
2. mutar temporalmente NotFoundView de `<a href="/login">` a `<Link href="/login">`;
3. ejecutar solo el E2E T-336 en el mismo entorno;
4. debe quedar RED porque el click termina en `/login`;
5. restaurar `<a>`;
6. GREEN.

Si la mutación no queda RED, el control sigue sin ser discriminante.

## Scope

`e2e/specs/smoke.spec.ts` fue autorizado explícitamente por el revisor en Ronda 4, pero no estaba en la ficha original. El revisor corrige `docs/tasks/T-336.md` en esta misma ronda. No se crea un hallazgo adicional ni se atribuye al agente.

## Resultado

H01/H02/H03 siguen cerrados.  
H04 sigue bloqueando únicamente por el E2E auto-correctivo.

No hay decisiones 🔵 pendientes.
