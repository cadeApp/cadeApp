# Informe de revisión — PR #248 / T-336 — Ronda 6

**HEAD revisado:** `cbe3a4ca59c232f06c1c6e2dfb863f94173677ed`  
**Base:** `develop@59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Fecha:** 2026-10-04  
**Resultado:** **CON 1 BLOQUEANTE RAÍZ**

## R5 residual — corregido

El E2E de `e2e/specs/smoke.spec.ts` ya no se autocorrige.

Ahora hace:

```ts
await Promise.all([
  page.waitForURL((url) => url.pathname === '/courier/feed', { timeout: 10000 }),
  irAlInicio.click(),
]);

expect(new URL(page.url()).pathname).toBe('/courier/feed');
```

No hay:
- `waitForTimeout`;
- `if` de rescate;
- `page.goto('/login')`;
- relogin;
- retry manual en el spec.

El control permanente ya es discriminante.

## Pero el producto sigue RED en Preview

El Preview del SHA `968fc862e251fc797700a800703993c86e691899` contiene el fix de producto `<a href="/login">`.

Su E2E trusted gate, run `37190004737`, ejecutó el test T-336 real y falló tres veces.

Logs relevantes:

```text
Cookies after login: sb-...-auth-token presente
Cookies after 404: sb-...-auth-token presente
URL after click: /login
Login request observed: true
Response status: 200
Cookies after click: sb-...-auth-token presente
URL after hard navigation: /login
TimeoutError: page.waitForURL: Timeout 10000ms exceeded
1 failed / 20 passed
```

Eso invalida la conclusión anterior «Caso A confirmado». La hard navigation **no** arregla el flujo en Preview.

## CC-007 descartado como causa

El fixture real de E2E crea el courier con:

```ts
consent_status: 'active'
```

Por lo tanto, la excepción de `evaluateRouteGuard` para consentimiento pendiente no explica que `/login` responda 200.

## PR248-H05 — bloqueante alto — middleware no descubierto por Next

### Evidencia del repo

- App Router: `src/app`.
- Middleware existente: `/middleware.ts` en raíz.
- No existe `src/middleware.ts`.

La convención de Next.js 15 para proyectos con `src` requiere que middleware esté dentro de `src`, al mismo nivel que `app`.

### Evidencia de build

CI run `37190624714`, step `next build`:

- lista `Route (app)` completa;
- no imprime ninguna entrada `Middleware`.

Un build con middleware descubierto debe reportarlo.

### Evidencia de runtime

Deployment:
`dpl_7fZoDeJHbDG25qfKjBTiMygZ2pES`

Los runtime logs muestran:

```text
GET /login 200
GET /courier/feed 200
```

durante la misma sesión E2E, pero no hay actividad registrada como `edge-middleware`.

### Impacto

T-336 depende de `updateSession()` para convertir `/login` en gateway de sesión. Si Next no compila el middleware, el guard correcto en unit tests nunca participa en la request real.

No se afirma todavía impacto de seguridad sobre todas las rutas; sí queda demostrado el incumplimiento runtime del contrato de T-336.

## Arreglo esperado

1. Mover el entrypoint:
   `middleware.ts` → `src/middleware.ts`.
2. Mantener la lógica actual de `updateSession` y matcher salvo necesidad demostrada.
3. Agregar un control con `next/experimental/testing/server`:
   - `/login` matchea;
   - `/courier/feed` matchea;
   - URL 404 normal matchea;
   - `/api/health` y assets excluidos no matchean.
4. Ajustar `package.json` para que lint/format no referencien el archivo legacy de raíz.
5. Ejecutar `next build` y demostrar que el output reconoce Middleware.
6. Desplegar Preview nuevo.
7. Ejecutar el E2E T-336 sin autocorrección:
   courier login → 404 → click → `/courier/feed`.

## Evidencia RED existente

No hace falta fabricar una mutación nueva para este bug:

- trusted e2e-preview run `37190004737`;
- tres intentos RED contra Preview;
- cookie real presente;
- consentimiento real active.

Esa es una prueba discriminante más fuerte que una mutación sintética.

## H04

PR248-H04 queda abierto pero deja de contarse como bloqueante raíz: su verificación solo puede cerrarse después de arreglar H05 y obtener E2E Preview GREEN.

## Resultado

**1 bloqueante raíz: PR248-H05.**

No hay decisiones 🔵 pendientes.
