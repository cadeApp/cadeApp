# PR #251 · T-313 — Ronda 2

- **SHA de cierre:** `604d028b5573aa6addf7514e20eb5d7b6686a030`
- **SHA funcional revalidado:** `79c6985e8c9717cf00f28c1baa6e7e4fbd38e726`
- **Fecha:** 2026-10-05
- **Resultado:** CON BLOQUEANTES (1)

El commit `604d028` posterior al SHA funcional solo actualiza `docs/tasks/log/T-313.md`; no modifica el spec.

## H01 · ARREGLADO Y VERIFICADO

El caso `Un courier no entra a (merchant)` recorre 11 rutas: 7 canónicas y 4 aliases, incluidos representantes de ambos `[id]`. La enumeración se contrastó contra el árbol actual de `src/app/(merchant)`.

## H02 · ARREGLADO Y VERIFICADO

`registrationContext` conserva `testError`; si cleanup falla también, lanza `[E2E Lifecycle Error]` con ambos errores y `cause`. Si solo falla cleanup, lo relanza.

## H03 · ARREGLADO Y VERIFICADO

La PR ya no declara como cumplido un bloque que la bitácora niega. En el CI integrado del SHA funcional:
- 119 Test Files passed;
- 1899 Tests passed;
- `tools/verify-fichas.test.ts`: 7/7;
- lint, typecheck, unit, db-tests, audit, build y bundle-budget: GREEN.

## H04 · SIGUE ABIERTO

### RED real del Preview

Run `37350595553`: **3 failed**, todos de T-313.

1. **Alta por UI:** `merchant-registration.spec.ts:145`
   - esperaba 0 alerts;
   - recibió error de registro;
   - en retry apareció rate limit de email.

2. **Courier en merchant:**
   - esperado: `/courier/feed`;
   - recibido: `/merchant/onboarding`.

3. **Merchant sin consentimiento:**
   - esperado: `/login?consentRequired=1`;
   - recibido: `/merchant/onboarding`.

Los fallos 2 y 3 no sirven todavía como mutación discriminante porque la rama está 3 commits detrás de `develop` y no contiene aún la corrección T-336 que activa el middleware desde `src/middleware.ts`.

El fallo 1 es coherente con que Develop todavía entra al camino de email/rate-limit. D01 prohíbe arreglar esto adulterando el spec o tocando Staging.

### D02 — opción A autorizada

Solo cuando exista baseline GREEN:

Archivo temporalmente autorizado:
`src/features/auth/guards.ts`

Símbolo:
`evaluateRouteGuard`

Bloque:
`// 4. Rutas protegidas de comercio (merchant) - Lista blanca estricta`

Mutación exacta:
```ts
if (session.role !== 'merchant') {
  return { action: 'allow' };
}
```

en reemplazo temporal de la redirección actual.

Objetivo: que el test `DoD: Un courier no entra a (merchant)` falle en el Preview automático **sin tocar el spec**.

Flujo obligatorio:
1. commit separado del probe;
2. push normal;
3. registrar SHA + run RED;
4. `git revert --no-edit <sha-probe>`;
5. push normal;
6. CI + e2e-preview GREEN finales.

Prohibido:
- cambiar expectativas;
- crear tests falsos/alternativos;
- usar `.skip`/`.only`;
- tocar Staging;
- rebase/amend/force-push.

## Acción manual de entorno

Si tras sincronizar `develop` el alta sigue fallando por email/rate-limit, Lautaro debe revisar **Supabase Develop** y dejar la confirmación de email desactivada para ese entorno de prueba. El código de `registerAction` ya contempla Confirm Email OFF y cierra la sesión local si Supabase entrega una sesión.

## P3

Comentario de solicitud: `5999858656`. Visto bueno: pendiente.

## Veredicto

**CON BLOQUEANTES (1): PR251-H04.**

No apruebo ni mergeo.
