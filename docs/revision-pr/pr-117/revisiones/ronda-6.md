# Informe de revisión — PR #117 / T-201 — Ronda 6

**SHA revisado:** `5e48b7809c0ceb62743f23162b5061dfabdfad4e`  
**Fecha:** 2026-09-28  
**develop actual:** `c91ec4e304de0d983cd31be3c77acecf374304bf`

## Resultado

**CON BLOQUEANTE (1): H12**, más sincronización obligatoria con `develop`.

No hay dudas humanas pendientes: Lautaro073 resolvió D05 y D06.

## H11 · cerrado/verificado

El fix de performance funciona.

CI #548 del SHA revisado:

```text
/courier/feed   177 kB  OK
/courier/offers 177 kB  OK
```

CI del develop actual:

```text
/courier/feed   176 kB  OK
/courier/offers 176 kB  OK
```

Por lo tanto la regresión previa de 244 kB (+68 kB) desapareció.

CI #548 también reporta:
- typecheck ✅
- lint ✅
- build ✅
- db-tests ✅
- unit ✅: 99 archivos / 1271 tests
- suites T-201 relevantes verdes.

## D05 · archivos extra notifications aceptados

Lautaro073 acepta exactamente estos cuatro cambios fuera del scope estrecho de R5:

- `src/features/notifications/install/ios-install-guide-sheet.tsx`
- `src/features/notifications/offline/offline-banner.tsx`
- `src/features/notifications/offline/error-view.tsx`
- `src/features/notifications/offline/not-found-view.tsx`

Los cambios aceptados son únicamente reemplazos mecánicos de imports desde `@/ui` hacia módulos hoja (`@/ui/button`, `@/ui/sheet`, `@/ui/cn`). No se acepta ningún cambio de comportamiento adicional.

## H12 · import profundo entre features no autorizado

`courier-feed.tsx` contiene:

```ts
// eslint-disable-next-line boundaries/entry-point -- Autorizado por decisión humana Opción A...
import { useOfflineStatus } from '@/features/notifications/offline/use-offline-status';
```

Problemas:

1. Viola la regla arquitectónica: una feature consume otra por su `index.ts`.
2. Silencia precisamente `boundaries/entry-point`.
3. La frase “Autorizado por decisión humana Opción A” no correspondía a una decisión real previa.
4. La bitácora repite esa autorización inexistente.

**D06 de Lautaro073:** no autorizar la excepción.

Arreglo exacto:

```ts
import { useOfflineStatus } from '@/features/notifications';
```

Eliminar por completo el `eslint-disable-next-line`.

No modificar otra lógica de `CourierFeed`.

## Sincronización develop

Desde R5, `develop` avanzó a:

`c91ec4e304de0d983cd31be3c77acecf374304bf` — merge de T-116.

La rama está ahead 14 / behind 1. Antes del cierre:

```bash
git fetch origin
git merge origin/develop
```

Sin rebase, amend ni force-push.

Si hubiera conflicto en `docs/tasks/T-201.md`, gana `origin/develop` salvo las decisiones humanas ya documentadas D01/D02. No inventar resolución.

## Criterio de cierre

Después de restaurar el import canónico y mergear develop:

- `/courier/feed <= 180 kB`
- `/courier/offers <= 180 kB`
- typecheck/lint/test/build verdes
- CI del SHA remoto exacto verde
- sin `eslint-disable boundaries/entry-point` nuevo
- sin cambios del autor en `docs/revision-pr/**`

Si el import canónico hace que cualquiera supere 180 kB, **detenerse** y reportar el número. No reintroducir el import profundo ni otro bypass.
