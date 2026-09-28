# Informe de revisión — PR #117 / T-201 — Ronda 5

**SHA revisado:** `aea137697424c0da86d256c0675b0ca6a7267eda`  
**Fecha:** 2026-09-28

## Resultado

**CON BLOQUEANTE (1): H11.**

H04 deja de bloquear por decisión humana explícita de Lautaro073. No se falsea evidencia: queda registrado como waiver/aceptación de riesgo.

## D04 · waiver visual

Lautaro073 indicó que no dispone de Safari y decide continuar confiando en la implementación.

Estado:
- H04 = `aceptado`;
- no se marca como `verificado`;
- el checkbox visual puede permanecer sin marcar o documentarse como excepción aceptada;
- riesgo residual: T01/T03/T04 no fueron probados en Safari/dispositivo real ni con capturas 390/360.

## CI inspeccionado en profundidad

Workflow CI #538 del SHA `aea137697424c0da86d256c0675b0ca6a7267eda`: **success**.

Jobs:
- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- audit ✅ advisory
- bundle-budget ✅ advisory

La revisión abrió los logs, no solo el color.

### Evidencia favorable

- 98 test files / 1260 tests passed.
- `courier-panel.test.tsx`: 16 tests pass.
- `offline-state.test.tsx`: 5 tests pass.
- `visual-verification.test.tsx`: 7 tests pass.
- `ios-install-guide.test.tsx`: 2 tests pass.
- `sw.test.ts`: 9 tests pass.
- `manifest.test.ts`: 4 tests pass.
- DB: 12 files / 1601 pgTAP tests, all successful.

Esto permite cerrar H01–H03 y H06–H07 como verificados por CI.

## Advertencias CI que NO bloquean esta PR

- `pnpm audit`: 2 vulnerabilidades; ya estaban igual en `develop` y no hay cambios de dependencias.
- formatting advisory: repo ya tenía 139 archivos fuera de formato; el SHA reporta 150. El workflow lo trata explícitamente como advisory.
- warnings de Node 20/punycode y rate-limit transitorio de Docker: infraestructura/preexistente; db-tests finalmente pasaron.
- varias rutas ya excedían 180 kB en `develop` (admin, login/mfa, trips, design-system).

## H11 · regresión nueva de bundle en rutas courier

**Severidad:** alto · BLOQUEANTE

Comparación exacta del job `bundle-budget`:

| Ruta | develop | PR R5 | Delta |
|---|---:|---:|---:|
| `/courier/feed` | 176 kB · OK | 244 kB · supera | **+68 kB** |
| `/courier/offers` | 176 kB · OK | 244 kB · supera | **+68 kB** |

Estas dos rutas estaban dentro del presupuesto antes de T-201 y pasan a estar 64 kB por encima del límite de 180 kB.

### Grafo que introduce la regresión

El diff relevante agrega en `CourierFeed`:

```ts
import { useOfflineStatus } from '@/features/notifications';
```

Y el entry point nuevo de notifications es:

```ts
export * from './install';
export * from './offline';
```

A su vez `install/index.ts` reexporta `IosInstallGuideSheet` y `offline/index.ts` reexporta todas las vistas offline. El feature `offers/index.ts` exporta tanto `CourierFeed` como `MyOffersList`; por eso el nuevo grafo puede afectar también `/courier/offers`, aunque esa página use `MyOffersList`.

El patrón coincide con el problema de barrels cliente ya trabajado en T-204: el entry point público debe ser suficientemente slim para no arrastrar runtime no usado.

### Arreglo esperado — primera opción mínima

Modificar `src/features/notifications/index.ts` para eliminar `export *` anidados y exponer explícitamente solo símbolos públicos desde los módulos hoja.

Ejemplo:

```ts
export { isIosSafariNonStandalone } from './install/is-ios';
export { IosInstallGuideSheet } from './install/ios-install-guide-sheet';
export { useOfflineStatus } from './offline/use-offline-status';
export { OfflineBanner, OfflineFloatingCard } from './offline/offline-banner';
export { ErrorView } from './offline/error-view';
export { NotFoundView } from './offline/not-found-view';
```

Después ejecutar build y presupuesto.

**Criterio de salida:** `/courier/feed` y `/courier/offers` deben volver a **≤180 kB**. Si el cambio de barrel no alcanza, no aplicar optimizaciones aleatorias: medir qué chunk sigue entrando y separar el componente pesado de instalación mediante carga diferida respetando la regla de arquitectura.

### Si hace falta segunda etapa

El candidato pesado es `IosInstallGuideSheet`/Sheet. En ese caso se permite modificar `src/app/providers.tsx` y `src/features/notifications/index.ts` para que el Sheet se cargue de forma diferida desde la API pública del feature, sin imports profundos desde `src/app` ni desde `offers`.

No modificar el comportamiento T01/T03/T04 ni volver a tocar offers salvo que una prueba demuestre necesidad.

### Verificación obligatoria

```bash
pnpm build 2>&1 | tee build-output.txt
node .github/workflows/check-bundle-budget.mjs build-output.txt
```

Pegar en PR las líneas de `/courier/feed` y `/courier/offers` antes/después.

No aceptar que el job esté “verde” si esas dos rutas siguen >180: ese job es advisory.
