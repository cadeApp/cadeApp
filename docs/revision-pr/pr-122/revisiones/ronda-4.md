# PR #122 — T-205 — Ronda 4

**Fecha:** 2026-09-29  
**SHA funcional revisado:** `5915ad4e66457fd83103518bcf5ef41de4da5273`  
**HEAD revisado:** `732a9bdc16ef495920c0a6c55920aa3ae427aca4`  
**Resultado:** **CON BLOQUEANTES**

## Cambios desde Ronda 3

Desde el commit documental del reviewer `e52b99b2...` entraron dos commits:

- `5915ad4e...` — `fix(T-205): resolver clipping horizontal y regenerar capturas con harness cdp [T-205]`
- `732a9bdc...` — `docs(tasks): registrar commit de ronda 3 en bitacora [T-205]`

No se modificó código funcional de producto. Los cambios son:

- 14 PNG T-205 reemplazadas;
- bitácora T-205 ampliada.

La rama permanece 0 commits behind de `develop`.

## Revalidación de R03

### Mejora visible

El reviewer decodificó e inspeccionó nuevamente las 14 capturas a 390 y 360 px.

Las nuevas imágenes **ya no presentan el clipping horizontal visible** detectado en Ronda 3:

- Crear solicitud: botones y contenido quedan dentro del viewport.
- Detalle con ofertas: empty state y filtros se leen completos.
- Courier feed: switch, badge y tarjeta quedan dentro.
- My offers: los tres tabs se ven completos.
- Identity/Vehicle: cards, inputs, columnas y acciones quedan dentro.
- Trip merchant: badge, precio, botones y estados quedan dentro.

Por lo tanto el síntoma visual original de R03 mejoró.

### Pero R03 no puede considerarse verificado

La bitácora afirma que se creó este harness reproducible:

`src/features/requests/evidence/browser-audit.test.tsx`

Ese archivo **no existe en el HEAD**. Se verificó además la variante:

`src/features/requests/evidence/T-205/browser-audit.test.tsx`

y tampoco existe.

El compare `e52b99b2... -> 732a9bdc...` confirma que no se agregó ningún archivo de harness: solo bitácora + PNG.

Sin ese archivo no es posible reproducir de forma independiente:

- el servidor local declarado;
- el montaje de las siete superficies;
- la carga de CSS compilado;
- el CDP / `Emulation.setDeviceMetricsOverride`;
- el detector de offenders;
- los supuestos 0 offenders;
- la generación exacta de las PNG.

R03 pasa de “abierto por clipping visible” a **parcial por evidencia no reproducible**.

---

## PR122-R04 — Harness declarado pero inexistente y árbol de captura no canónico

**Severidad:** alta  
**Categoría:** test-coverage / conventions  
**Patrón:** `P15-entregable-declarado-pero-no-ejecutable`

### A. El entregable no existe

La bitácora dice literalmente:

> Se construyó el harness reproducible `src/features/requests/evidence/browser-audit.test.tsx`

GitHub devuelve 404 para esa ruta en `732a9bdc...`.

El archivo tampoco aparece en los dos commits de arreglo.

Eso vuelve no ejecutable la principal evidencia usada para afirmar “0 offenders”.

### B. Las capturas no reproducen exactamente el árbol real de onboarding

Las nuevas PNG de:

- `identity_form_390x844.png`
- `identity_form_360x800.png`
- `vehicle_form_390x844.png`
- `vehicle_form_360x800.png`

muestran **dos barras de progreso completas**:

1. una barra fuera del Card;
2. otra barra dentro del Card.

Pero las rutas reales son:

`src/app/(courier)/courier/onboarding/identity/page.tsx`

```tsx
<div className="flex flex-col items-center justify-start px-4 py-6">
  <IdentityForm courierId={...} />
</div>
```

y:

`src/app/(courier)/courier/onboarding/vehicle/page.tsx`

```tsx
<div className="flex flex-col items-center justify-start px-4 py-6">
  <VehicleForm courierId={...} />
</div>
```

No existe `src/app/(courier)/courier/onboarding/layout.tsx`.

`IdentityForm` y `VehicleForm` ya incluyen internamente su propio:

`<StepIndicator ... />`

El `CourierLayout` real agrega TopBar + main + CourierNav, **no una segunda barra de pasos**.

Por tanto las capturas provienen de un montaje distinto al árbol canónico de la aplicación, pese a que la bitácora dice “montadas dentro de sus layouts canónicos”.

### Consecuencia

Las PNG sirven para mostrar que **ese montaje particular** cabe en 390/360, pero no son evidencia suficiente de que las rutas reales de Next.js:

- carguen exactamente ese árbol;
- tengan 0 offenders;
- respeten navegación/foco;
- no tengan clipping integrado.

### Corrección

1. Versionar el harness real utilizado, dentro de archivos permitidos.
2. El harness debe importar/renderizar la misma estructura que usa la ruta real, sin inventar una segunda barra de pasos.
3. Registrar comando exacto para ejecutarlo.
4. Ejecutarlo en 390 y 360.
5. Adjuntar salida textual reproducible con 0 offenders.
6. Regenerar las 14 PNG desde ese mismo harness.
7. Las capturas de onboarding deben mostrar una sola barra de progreso, igual que la ruta real.
8. Si el harness necesita duplicar/recrear layouts manualmente, debe demostrar que el DOM resultante coincide con los layouts/pages actuales; preferible reutilizar directamente los componentes/layouts existentes.

No aceptar una descripción en la bitácora sin el archivo que ejecuta esa descripción.

---

## PR122-H03 — sigue bloqueante

La propia bitácora sigue declarando:

- Lighthouse móvil: pendiente.
- axe AA real: pendiente.

Y `docs/tasks/T-205.md` mantiene correctamente los criterios runtime en `[ ]`.

Mientras estos requisitos sigan abiertos, **T-205 no cumple su DoD completo**.

No corresponde revisar CI final para aprobación mientras el DoD siga abierto.

## R01 / R02

Continúan corregidos por inspección:

- ficha autoritativa restaurada;
- non-null assertions retiradas.

## Estado de aprobación

**No aprobar ni mergear todavía.**

Para pasar a una ronda aprobable:

1. versionar/corregir el harness y revalidar R04;
2. generar evidencia browser realmente canónica y reproducible;
3. completar axe AA y Lighthouse móvil de las cinco superficies;
4. mantener los checkboxes en `[ ]` hasta obtener evidencia;
5. volver a revisión sobre SHA nuevo;
6. recién sin bloqueantes revisar CI final.
