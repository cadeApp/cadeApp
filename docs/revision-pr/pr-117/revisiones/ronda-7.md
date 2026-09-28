# Informe de revisión — PR #117 / T-201 — Ronda 7

**SHA revisado:** `52b47f80f501a070fc20b8847bd3acc12d12d158`  
**Fecha:** 2026-09-28  
**develop:** `c5d2612d211469468ec1ee465939c4b46fa9a6ba`

## Resultado

**CON BLOQUEANTE (1): PR117-R01.**

No hay decisiones humanas pendientes.

## Sincronización / alcance

- La rama ya incorporó `develop`: ahead 18 / behind 0.
- Mergeable: sí.
- El autor no tocó `docs/revision-pr/pr-117/**`.
- Los archivos adicionales desde R6 corresponden a los merges de T-116/T-206 desde develop.
- El cambio productivo propio de T-201 desde R6 es `courier-feed.tsx` + bitácora.

## H12 · cerrado/verificado

El SHA actual contiene:

```ts
import { useOfflineStatus } from '@/features/notifications';
```

y ya no contiene:
- import profundo `notifications/offline/use-offline-status`;
- `eslint-disable-next-line boundaries/entry-point`.

CI #556 ejecutó `pnpm lint` y reportó:

```text
✔ No ESLint warnings or errors
```

La bitácora del autor además documenta el RED esperado al quitar solo el disable manteniendo el import profundo: `boundaries/entry-point` falla.

La revisión intentó reproducir esa mutación en un checkout limpio, pero el shell local no pudo clonar el repo porque no resuelve `github.com`. No se atribuye una mutación independiente inexistente; el GREEN sí fue verificado mediante CI remoto exacto + inspección del código.

## PR117-R01 · regresión de performance al corregir H12

**Severidad:** alto · BLOQUEANTE

CI #556 del SHA actual:

```text
/courier/feed    198 kB  Supera el límite
/courier/offers  198 kB  Supera el límite
```

CI #553 del develop actual:

```text
/courier/feed    176 kB  OK
/courier/offers  176 kB  OK
```

Delta actual: **+22 kB por ruta**.

La regla 25 fija explícitamente **≤180 kB First-Load JS** para rutas de comercio/repartidor.

### Causa raíz

`CourierFeed` debe importar el hook por la API pública:

```ts
import { useOfflineStatus } from '@/features/notifications';
```

Pero `notifications/index.ts` hoy reexporta estáticamente en el mismo módulo:

- `IosInstallGuideSheet`
- `OfflineBanner`
- `OfflineFloatingCard`
- `ErrorView`
- `NotFoundView`

Ese grafo visual pesado se vuelve alcanzable desde el mismo entry point cliente usado por `CourierFeed`. Corregir H12 sin desacoplar la **carga** de esos componentes devuelve la ruta a 198 kB.

### Arreglo esperado

Mantener **intacto** el import canónico de `CourierFeed`.

En `src/features/notifications/index.ts`:
1. conservar exports directos livianos:
   - `useOfflineStatus`
   - `isIosSafariNonStandalone`
2. reemplazar los exports estáticos de componentes visuales por **loaders públicos** basados en `import()`, por ejemplo:

```ts
export const loadOfflineBanner = () =>
  import('./offline/offline-banner').then((m) => ({ default: m.OfflineBanner }));

export const loadOfflineFloatingCard = () =>
  import('./offline/offline-banner').then((m) => ({ default: m.OfflineFloatingCard }));

export const loadIosInstallGuideSheet = () =>
  import('./install/ios-install-guide-sheet').then((m) => ({ default: m.IosInstallGuideSheet }));

export const loadErrorView = () =>
  import('./offline/error-view').then((m) => ({ default: m.ErrorView }));

export const loadNotFoundView = () =>
  import('./offline/not-found-view').then((m) => ({ default: m.NotFoundView }));
```

En consumidores `src/app/**`, usar esos loaders con `next/dynamic` **importados siempre desde `@/features/notifications`**.

No hacer imports profundos desde app ni offers.

### Archivos permitidos para R01

- `src/features/notifications/index.ts`
- `src/app/providers.tsx`
- `src/app/error.tsx`
- `src/app/not-found.tsx`
- `docs/tasks/log/T-201.md`
- body/comentario de PR para evidencia

No tocar:
- `src/features/offers/**`
- componentes hoja de notifications ya aceptados por D05
- tests existentes salvo que una incompatibilidad real del refactor lo exija
- `docs/revision-pr/**`
- package/lockfiles
- Supabase/server

## RED / GREEN obligatorio

RED ya reproducido remotamente en CI #556:

```text
/courier/feed    198 kB
/courier/offers  198 kB
```

Después del arreglo:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build 2>&1 | tee build-output.txt
node .github/workflows/check-bundle-budget.mjs build-output.txt
```

GREEN requerido:

```text
/courier/feed    <= 180 kB
/courier/offers  <= 180 kB
```

Mutación posterior:
- restaurar temporalmente en `notifications/index.ts` los exports estáticos actuales de los componentes visuales;
- volver a build/budget;
- las rutas courier deben volver a superar 180;
- restaurar manualmente los loaders dinámicos y confirmar GREEN.

No debilitar `check-bundle-budget.mjs`, no subir el límite y no aceptar el color verde del job advisory como evidencia.

## Otros checks

CI #556:
- unit: 99 files / 1312 tests ✅
- db: 12 files / 1601 tests ✅
- typecheck/lint/build ✅
- audit: 2 vulnerabilidades advisory, preexistente
- formato: advisory; no bloquea esta tarea
- Docker rate-limit: transitorio; pgTAP terminó verde

No se encontraron otros bloqueantes de T-201 en esta ronda.
