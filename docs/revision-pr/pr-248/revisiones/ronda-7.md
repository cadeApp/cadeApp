# Informe de revisión — PR #248 / T-336 — Ronda 7 final

**SHA revisado:** `ab2f52512a103f81d70bc46bcabe437a02f87439`  
**Base original:** `develop@59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Fecha:** 2026-10-04  
**Resultado:** **SIN BLOQUEANTES**

## PR248-H05 — cerrado

**Estado:** `arreglado-verificado`

La corrección mueve el entrypoint real:

```text
middleware.ts
→ src/middleware.ts
```

sin duplicarlo ni dejar un shim en raíz.

La lógica de `updateSession` y el matcher se conservaron.

`src/middleware.test.ts` importa la `config` real desde `./middleware` y usa `unstable_doesMiddlewareMatch`.

El build del HEAD actual, run `37192309514`, reporta explícitamente:

```text
ƒ Middleware                                136 kB
```

Esto cierra la causa raíz que en R6 impedía ejecutar las guards en runtime.

## PR248-H04 — cerrado

**Estado:** `arreglado-verificado`

El trusted e2e-preview del SHA actual:

`37192403607`

terminó GREEN.

El spec permanente no contiene autocorrección:

```ts
await Promise.all([
  page.waitForURL((url) => url.pathname === '/courier/feed', { timeout: 10000 }),
  irAlInicio.click(),
]);

expect(new URL(page.url()).pathname).toBe('/courier/feed');
```

Resultado del run:

```text
Running 21 tests using 1 worker
T-336 ... ✓ (11.3s)
21 passed

Running 3 tests using 1 worker
3 passed
```

La cookie Supabase se conserva entre login y 404.

Secuencia verificada:

```text
courier login
→ /courier/feed
→ /t336-404-session-regression
→ click Ir al inicio
→ /courier/feed
```

No hay:
- `page.goto('/login')` de rescate;
- relogin;
- branch correctiva;
- retry manual en el test.

El RED previo está demostrado por run `37190004737`, donde el mismo flujo fallaba tres veces antes de que Next descubriera el middleware.

## CI exact-head

Run `37192309514`:

- **119 test files / 1898 tests PASS**
- DB **10/10 + 1811/1811 PASS**
- lint: GREEN
- typecheck: GREEN
- build: GREEN
- audit: GREEN
- bundle-budget: GREEN
- `/courier/feed = 159 kB`
- `/courier/profile = 178 kB`
- `ƒ Middleware = 136 kB`

Vercel: GREEN.

e2e-preview:
- Chromium **21/21**
- global-settings **3/3**
- status publicado: **success**

## Estado final

- H01 → arreglado-verificado
- H02 → arreglado-verificado
- H03 → arreglado-verificado
- H04 → arreglado-verificado
- H05 → arreglado-verificado

## Sincronización con develop

La rama está actualmente:
- ahead: 16
- behind: 1
- status: diverged

No aparece un defecto de T-336 por eso. Antes del merge debe seguirse la política normal del repo para integrar el commit nuevo de develop y revalidar conflictos/checks si GitHub no permite merge directo.

## Resultado final

**0 bloqueantes técnicos/de evidencia.**
