# PR #122 — T-205 — Ronda 5

**Fecha:** 2026-09-29  
**SHA funcional revisado:** `f182000...`  
**HEAD revisado:** `bae8c771e2a42c20a45764cc984fefb5265de160`  
**Resultado:** **CON BLOQUEANTES**

## Cambios desde Ronda 4

Desde el commit documental del reviewer `3e74e060...` entraron dos commits:

- `f182000...` — versiona el harness browser, regenera capturas y agrega exports auxiliares en courier-onboarding.
- `bae8c771...` — registra la sesión en bitácora.

La rama sigue 0 commits behind de `develop`.

## Lo que mejoró

### R03 — mejora visible

Las 14 PNG actuales fueron inspeccionadas de nuevo. Ya no muestran el clipping horizontal detectado originalmente.

### R04 — avance real

Ahora sí existen:

- `src/features/requests/evidence/T-205/browser-audit.tsx`
- `src/features/requests/evidence/T-205/vitest.config.ts`

y las capturas de onboarding muestran una sola barra de progreso.

Sin embargo R04 todavía no puede considerarse cerrado porque el harness no monta exactamente las rutas/layouts canónicos de Next.js.

---

## PR122-R05 — El harness puede pasar con CSS vacío

**Severidad:** alta  
**Categoría:** test-coverage  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

El harness contiene:

```ts
const cssPath = path.resolve('.next/static/css/b30c4bb5cec07bc0.css');
const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
```

Problemas:

1. El nombre `b30c4bb5cec07bc0.css` es un hash de build y no es estable.
2. El comando documentado para ejecutar el harness es solo:
   `npx vitest run -c src/features/requests/evidence/T-205/vitest.config.ts`
   y no garantiza un `pnpm build` previo.
3. En un checkout limpio, si `.next` no existe o el hash cambió, el harness continúa con `cssContent = ''`.
4. El test solo exige `offendersCount === 0`, por lo que HTML sin Tailwind/CSS puede dar un falso verde y generar screenshots que no representan el producto.

**Corrección esperada:**

- no hardcodear un hash;
- exigir que exista `.next/static/css`;
- descubrir todos los `.css` generados del build y concatenarlos;
- fallar explícitamente si no hay CSS;
- documentar `pnpm build` antes del harness.

Ejemplo de patrón válido:

```ts
const cssDir = path.resolve('.next/static/css');
if (!fs.existsSync(cssDir)) {
  throw new Error('Falta .next/static/css. Ejecutá pnpm build antes del browser audit.');
}

const cssFiles = fs.readdirSync(cssDir).filter((name) => name.endsWith('.css'));
if (cssFiles.length === 0) {
  throw new Error('No se encontraron CSS compilados de Next.js.');
}

const cssContent = cssFiles
  .map((name) => fs.readFileSync(path.join(cssDir, name), 'utf8'))
  .join('\n');
```

Mutación RED obligatoria: apuntar temporalmente a un directorio CSS inexistente y comprobar que el harness falla antes de abrir Edge.

---

## PR122-R06 — El harness todavía no representa las rutas canónicas

**Severidad:** alta  
**Categoría:** test-coverage / evidencia  
**Patrón:** `P15-entregable-declarado-pero-no-ejecutable`

La bitácora/body lo llama “harness canónico” y afirma montar layouts reales, pero el archivo implementa funciones propias:

- `wrapMerchant`
- `wrapCourier`
- `wrapTrip`

### Diferencias concretas

#### Merchant

Layout real `src/app/(merchant)/layout.tsx` incluye:

```tsx
<MerchantNav />
```

`wrapMerchant` no lo incluye.

#### Courier

Layout real `src/app/(courier)/layout.tsx` incluye siempre:

```tsx
<CourierNav />
```

y es `CourierNav` quien decide ocultarse durante onboarding.

El harness reimplementa manualmente la navegación con `BottomNav` y una condición propia.

#### Trip

La ruta real `src/app/trips/[id]/page.tsx` renderiza para merchant:

```tsx
<TripMerchantContainer trip={trip} />
<ReportIncidentButton ... />
```

El harness renderiza:

```tsx
wrapTrip(<TripMerchantView trip={mockTrip} />)
```

Además inventa un `TopBar` con badge “Viaje” que no forma parte de esa page/layout real.

Por lo tanto el resultado mide un montaje SSR de componentes, no la ruta canónica.

### Límite adicional

El harness usa `renderToString`: no hay hidratación del cliente. Puede servir como chequeo estático de layout, pero **no demuestra** teclado, foco, navegación interactiva ni comportamiento real de los client components. Esto es coherente con que el checkbox browser siga `[ ]`, pero contradice describirlo como verificación canónica completa.

**Corrección esperada:**

- cambiar la descripción de la evidencia a “SSR layout harness” si se mantiene este enfoque;
- no usarlo como sustituto de la verificación browser real de H03;
- si se afirma “canónico”, reutilizar las estructuras reales sin recrearlas manualmente;
- como mínimo incluir las mismas piezas que la ruta real para las superficies auditadas.

---

## PR122-R07 — Cambio en API pública de feature + bundle actual no revalidado

**Severidad:** alta  
**Categoría:** arquitectura / rendimiento  
**Patrón:** `P10-desvio-de-ficha-sin-consultar`

Regla 20 define `src/features/<x>/index.ts` como la **API pública apta para cliente**.

La última ronda agregó:

```ts
export { IdentityForm as CanonicalIdentityForm } from './components/identity-form';
export { VehicleForm as CanonicalVehicleForm } from './components/vehicle-form';
```

solo para que el harness pueda evitar los exports dinámicos existentes.

Esto introduce dos problemas:

1. Expande la API pública de producción por una necesidad de evidencia/test.
2. Agrega reexports estáticos de los mismos componentes que el producto expone de forma dinámica para aislamiento de bundle.

No se afirma aquí que el bundle haya aumentado; lo que sí es verificable es que **el grafo público cambió después de la medición mostrada** y la sección de verificaciones de esta ronda no registra un nuevo `pnpm build` + `check-bundle-budget.mjs`.

Por tanto los números de First Load JS del body no están demostrados para el HEAD actual.

**Corrección preferida:**

- retirar `CanonicalIdentityForm` y `CanonicalVehicleForm` de la API pública;
- mantener cualquier import interno de evidencia dentro de la propia feature `courier-onboarding` o dividir el harness por feature, sin tocar la API de producción;
- después ejecutar un build limpio y la medición canónica de bundle.

Si se decide conservar esos exports, debe justificarse formalmente como cambio de API pública y revalidarse el bundle del HEAD actual; T-205 prohíbe cambios de contrato sin procedimiento.

---

## PR122-H03 — Sigue abierto

La propia ficha mantiene correctamente en `[ ]`:

- axe AA / Lighthouse / first-load combinado;
- browser 390/360 + reduced-motion + teclado + contraste + overflow + capturas;
- auditoría integrada de primitivas.

La bitácora además dice explícitamente:

- Lighthouse móvil: pendiente.
- axe AA: pendiente.

Por lo tanto T-205 todavía no cumple el DoD completo.

## Estado de aprobación

**No aprobar ni mergear todavía.**

Para una ronda aprobable:

1. corregir R05;
2. corregir o reclasificar honestamente R06;
3. resolver R07 y volver a medir bundle sobre el HEAD resultante;
4. completar axe/Lighthouse/browser real de H03;
5. volver a revisión sobre SHA nuevo;
6. recién entonces revisar CI final.
