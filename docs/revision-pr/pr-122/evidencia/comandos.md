# Evidencia y reproducciones — PR #122 — Ronda 1 vigente

**SHA funcional inspeccionado:** `5ff06783a0b70558c03d05d91c9b55dd7d1c2b3a`.

> Esta revisión se hizo contra el contenido exacto del SHA mediante el conector GitHub. El entorno actual no tiene checkout ejecutable del repo, por lo que los comandos de shell de esta sección son la batería que debe reproducirse en el worktree; no se registran falsamente como ejecutados por el revisor.

## Estado comprobado

- PR abierta, no Draft, mergeable.
- Rama 3 commits ahead / 0 behind respecto de `develop`.
- Ficha autoritativa leída desde `develop`.
- `docs/tasks/T-205.md` en la rama marca todos los DoD como `[x]`.
- CI de cierre no se consultó porque hay bloqueantes.
- El comentario de la revisión anterior se considera obsoleto por decisión de Lautaro073.

## H01 — accesibilidad incompleta

### Targets de `/courier/offers`

`src/features/offers/components/my-offers-list.tsx`:

- línea 83: `min-h-10`
- línea 94: `min-h-10`
- línea 105: `min-h-10`

La ruta `src/app/(courier)/courier/offers/page.tsx` renderiza directamente `MyOffersList`.

Reproducción/mutación después del arreglo:

```bash
pnpm vitest run src/features/offers/components/my-offers-list.test.tsx
```

Agregar una regresión que obtenga los tres tabs por role/name y exija `min-h-12`. Luego volver temporalmente uno a `min-h-10`: el test debe mostrar **1 failed**. Restaurar y confirmar verde.

### Heading order de CourierFeed

En el estado aprobado/no-disponible:

- `courier-feed.tsx:130` → `h1`
- `courier-feed.tsx:154` → `h3`

Mutación:

```bash
pnpm vitest run src/features/offers/courier-panel.test.tsx
```

Agregar una regresión del estado `courierStatus="approved"`, `isAvailable={false}` que enumere headings y exija secuencia continua. Con el `h3` actual debe fallar; cambiarlo a `h2`, repetir y exigir verde.

### Reduced motion

No hay regla global de `prefers-reduced-motion` en `src/app/globals.css`. El mecanismo compartido está en `src/ui/motion/index.tsx`.

Clases directas observadas en superficies de T-205:

```text
src/app/(courier)/courier/profile/notifications/page.tsx:12  animate-pulse
src/features/offers/components/courier-feed.tsx:136             animate-ping
src/features/requests/components/create-request-form.tsx:296    animate-spin
src/features/requests/components/create-request-form.tsx:390    animate-spin
src/features/courier-onboarding/components/identity-form.tsx:278 animate-spin
src/features/courier-onboarding/components/vehicle-form.tsx:336  animate-spin
src/features/courier-onboarding/components/vehicle-form.tsx:374  animate-spin
src/features/courier-onboarding/components/vehicle-form.tsx:472  animate-spin
src/features/courier-onboarding/components/status-view.tsx:42    animate-pulse
src/features/trips/components/trip-merchant-view.tsx:92          animate-pulse
```

Batería final: abrir las cinco pantallas con emulación `prefers-reduced-motion: reduce`; ninguna animación continua/decorativa debe seguir ejecutándose. Si se conservan loaders esenciales, deben implementarse con el mecanismo permitido y respetar la preferencia.

## H02 — controles que pueden quedar falsamente verdes

### Targets

En `dod-t205.test.tsx`, `interactiveContainers` solo contiene `CreateRequestForm` y `RequestOffersList`. La mutación `MyOffersList min-h-12 -> min-h-10` no modifica el resultado de ese test.

### Inputmode

El test central solo consulta teléfonos:

```text
input[type="tel"], input#recipient-phone
input[type="tel"], input#phone
```

Campos numéricos actualmente correctos pero fuera del control:

- CreateRequestForm: cambio libre → `inputMode="numeric"`
- OfferSheet: monto → `inputMode="numeric"`
- IdentityForm: DNI → `inputMode="numeric"`

Mutación exigida: quitar temporalmente `inputMode` de cada uno y demostrar que su **suite específica** falla.

### Bundle/code splitting

El caso DoD 1.4 actual solo hace `.toBeDefined()` sobre:

- `IdentityForm`
- `VehicleForm`
- `TripMerchantContainer`
- `TripCourierContainer`

Una importación estática conserva todos esos exports; por lo tanto el test seguiría verde.

No crear otro proxy. Medición canónica:

```bash
rm -rf .next
pnpm build 2>&1 | tee /tmp/t205-build.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build.txt
```

Registrar la tabla exacta. El control de regresión del bundle es el valor de First Load JS, no la existencia del export.

## H03 — evidencia de aceptación faltante

Antes de volver a marcar los ítems como `[x]`, registrar por cada una de estas cinco superficies:

1. crear solicitud;
2. detalle con ofertas;
3. lista del repartidor;
4. onboarding;
5. viaje.

### Lighthouse móvil

Registrar por superficie:

```text
ruta | performance | accessibility | fecha | navegador/build SHA
```

Umbrales: performance >= 80 y accessibility >= 95.

### Axe

Registrar salida de auditoría axe AA real de navegador. Si no se puede ejecutar sin agregar dependencias al repo, dejar el criterio pendiente y decirlo; no sustituirlo por el test de headings.

### Browser

En 390 px y 360 px:

- teclado y orden de tabulación;
- foco visible;
- contraste;
- targets renderizados;
- ausencia de scroll horizontal;
- `prefers-reduced-motion: reduce`;
- capturas Stitch/implementación con ruta o enlace verificable.

## Checks finales del autor

```bash
pnpm typecheck
pnpm lint
pnpm test
rm -rf .next
pnpm build 2>&1 | tee /tmp/t205-build-final.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build-final.txt
git diff --check
git status --short
git rev-parse HEAD
git ls-remote origin feat/T-205-accesibilidad-rendimiento
```

## H04 — trazabilidad

La bitácora afirma `f7fe5dd`; una consulta directa de GitHub devolvió **No commit found for SHA**. No volver a escribir un SHA futuro/autorreferencial. Si la bitácora se escribe antes del commit, usar `por commitear`; la siguiente sesión puede registrar el hash real.

## Validación de los artefactos de revisión

El comando normativo es:

```bash
node docs/revision-pr/analizar.mjs verificacion
```

No pudo ejecutarse en este entorno por ausencia de checkout del repo. No se declara como corrido; debe ejecutarse desde el worktree antes de considerar esta ronda lista para archivo definitivo.
