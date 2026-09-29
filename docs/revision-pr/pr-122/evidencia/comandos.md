# Evidencia y reproducciones — PR #122

## Ronda 3 — SHA `fc0108503a630746ffa05fa463603e3bd88f175f`

### Commits nuevos desde Ronda 2

```text
f71ec26657adcff72ab68319b380ce682da3da4d
fix(T-205): atender hallazgos y regresiones de ronda 2 en PR 122 [T-205]

fc0108503a630746ffa05fa463603e3bd88f175f
docs(tasks): registrar commit de ronda 2 en bitacora [T-205]
```

### R01

`docs/tasks/T-205.md` volvió a:

```md
- [ ] axe AA sin violaciones; objetivos de 48 px; `inputmode` numérico; Lighthouse móvil ≥ 80 en rendimiento y ≥ 95 en accesibilidad en crear solicitud, detalle con ofertas, lista del repartidor, onboarding y viaje; first-load JS dentro del presupuesto de la regla 25.
```

La redacción coincide con `develop`.

### R02

El test de headings ahora usa:

```ts
const current = levels[i];
const previous = levels[i - 1];

expect(current).toBeDefined();
expect(previous).toBeDefined();

if (current === undefined || previous === undefined) {
  continue;
}

expect(current - previous).toBeLessThanOrEqual(1);
```

No contiene las non-null assertions detectadas en Ronda 2.

### H03 — estado honesto de DoD

En el HEAD siguen `[ ]`:

- axe/Lighthouse/48 px/inputmode/bundle;
- browser 390/360 + reduced motion + teclado + contraste + overflow + capturas;
- auditoría `src/ui/**`.

Axe y Lighthouse están explícitamente documentados como pendientes.

### Evidencia PNG inspeccionada por el revisor

Se decodificaron e inspeccionaron visualmente las 14 PNG añadidas:

```text
src/features/requests/evidence/T-205/create_request_390x844.png
src/features/requests/evidence/T-205/create_request_360x800.png
src/features/requests/evidence/T-205/request_offers_390x844.png
src/features/requests/evidence/T-205/request_offers_360x800.png

src/features/offers/evidence/T-205/courier_feed_390x844.png
src/features/offers/evidence/T-205/courier_feed_360x800.png
src/features/offers/evidence/T-205/my_offers_390x844.png
src/features/offers/evidence/T-205/my_offers_360x800.png

src/features/courier-onboarding/evidence/T-205/identity_form_390x844.png
src/features/courier-onboarding/evidence/T-205/identity_form_360x800.png
src/features/courier-onboarding/evidence/T-205/vehicle_form_390x844.png
src/features/courier-onboarding/evidence/T-205/vehicle_form_360x800.png

src/features/trips/evidence/T-205/trip_merchant_390x844.png
src/features/trips/evidence/T-205/trip_merchant_360x800.png
```

### Hallazgos visuales R03

- **Create request:** segunda acción de entrega se corta por el borde derecho.
- **Request offers:** texto del empty state se corta a la derecha.
- **Courier feed:** control de disponibilidad aparece recortado.
- **My offers:** tercera pestaña queda fuera/parcialmente fuera.
- **Identity form:** textos y zonas de documentación desbordan visualmente.
- **Vehicle form:** segunda columna y textos/acciones quedan cortados.
- **Trip merchant:** badge superior, precio, botón de llamada, estado “Entregado” y textos inferiores quedan truncados.

Los mismos patrones aparecen en 390 y/o 360.

### Por qué el check actual puede false-green

`src/app/globals.css` contiene:

```css
body {
  ...
  overflow-x: hidden;
}
```

La bitácora usa como prueba:

```text
scrollWidth <= innerWidth
```

Ese check no basta para detectar elementos que salen del viewport y luego son recortados por overflow oculto.

### Auditoría browser correcta

Además del scrollWidth, ejecutar en cada viewport:

```js
const offenders = [...document.querySelectorAll('body *')]
  .map((el) => {
    const rect = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 80),
      left: rect.left,
      right: rect.right,
      width: rect.width,
    };
  })
  .filter(
    (item) =>
      item.width > 0 &&
      (item.right > window.innerWidth + 1 || item.left < -1)
  );

console.table(offenders);
```

Esperado para cerrar: **0 offenders relevantes**.

Registrar además:

```js
({
  innerWidth: window.innerWidth,
  rootScrollWidth: document.documentElement.scrollWidth,
  bodyScrollWidth: document.body.scrollWidth,
  bodyOverflowX: getComputedStyle(document.body).overflowX,
  bodyFont: getComputedStyle(document.body).fontFamily,
})
```

### Harness reproducible

La próxima evidencia debe registrar:

- URL/ruta exacta;
- comando usado para iniciar la app/harness;
- comando/herramienta de captura;
- viewport exacto;
- si había sesión autenticada o fixture;
- salida del detector de offenders.

Si no se puede capturar la ruta real completa, dejar el criterio en `[ ]` y no describir el resultado como “verificación de la ruta”.

### Si el overflow es del producto real

No corregir por conjetura. Usar la lista de offenders para tocar solo el layout responsable. Candidatos observados por inspección:

- CreateRequestForm: fila de acciones de destino.
- MyOffersList: grid de tabs.
- StepIndicator: cuatro pasos horizontales.
- TripMerchantView: encabezado/progreso/contacto en ancho móvil.

Volver a capturar 390 y 360 después de cada arreglo.

### Lighthouse / axe

Siguen pendientes. Para una ronda aprobable deben existir resultados reales de las cinco superficies o, si el entorno no lo permite, el DoD debe permanecer abierto y la PR no puede cerrarse como T-205 completa.

## Checks finales cuando H03/R03 estén resueltos

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

CI final se revisa recién cuando ya no existan bloqueantes de aceptación.

El analizador de revisión debe ejecutarse en un worktree real:

```bash
node docs/revision-pr/analizar.mjs verificacion
```
