# Evidencia y reproducciones — PR #122

## Ronda 5 — HEAD `bae8c771e2a42c20a45764cc984fefb5265de160`

### Archivos nuevos relevantes

```text
src/features/requests/evidence/T-205/browser-audit.tsx
src/features/requests/evidence/T-205/vitest.config.ts
```

El harness existe y se puede invocar explícitamente con Vitest.

### R05 — CSS compilado no reproducible

Código actual:

```ts
const cssPath = path.resolve('.next/static/css/b30c4bb5cec07bc0.css');
const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
```

Problema reproducible:

- `.next` no está versionado;
- el nombre de CSS contiene hash de build;
- un build nuevo puede generar otro nombre;
- si el archivo no existe, el harness sigue con CSS vacío;
- el test solo exige `offendersCount === 0`.

Corrección mínima:

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

Comando reproducible esperado:

```bash
rm -rf .next
pnpm build
pnpm exec vitest run -c src/features/requests/evidence/T-205/vitest.config.ts
```

Mutación RED: cambiar temporalmente `cssDir` a una ruta inexistente; el audit debe fallar antes de iniciar Edge.

### R06 — diferencias entre harness y rutas reales

#### Merchant

Real:

`src/app/(merchant)/layout.tsx`

incluye `<MerchantNav />`.

Harness:

`wrapMerchant`

no lo incluye.

#### Courier

Real:

`src/app/(courier)/layout.tsx`

incluye `<CourierNav />`.

Harness:

- recrea `BottomNav` y sus items manualmente;
- aplica su propia lógica `showNav`.

#### Trip

Real:

`src/app/trips/[id]/page.tsx`

para merchant:

```tsx
<TripMerchantContainer trip={trip} />
<ReportIncidentButton ... />
```

Harness:

```tsx
wrapTrip(<TripMerchantView trip={mockTrip} />)
```

Además `wrapTrip` agrega un TopBar “Viaje” que no proviene de la page real.

#### Runtime

El harness genera HTML con `renderToString`. No hidrata client components.

Consecuencia: sirve para layout SSR/fixture y screenshots, pero no demuestra:

- orden de tabulación real;
- focus management;
- interacción del cliente;
- comportamiento hidratado;
- la ruta completa de Next.js.

La ficha browser debe permanecer `[ ]` hasta una verificación real.

### R07 — API pública y bundle

Regla 20:

`src/features/<x>/index.ts` = API pública apta para cliente.

Cambios nuevos:

```ts
export { IdentityForm as CanonicalIdentityForm } from './components/identity-form';
export { VehicleForm as CanonicalVehicleForm } from './components/vehicle-form';
```

Los exports dinámicos ya existentes siguen siendo:

```ts
export const IdentityForm = dynamic(...)
export const VehicleForm = dynamic(...)
```

El cambio nuevo agrega caminos estáticos por el mismo barrel.

La ronda actual documenta:

- typecheck;
- lint;
- tests;
- browser harness.

No documenta un `pnpm build` + `check-bundle-budget.mjs` posterior a estos nuevos exports.

Revalidación necesaria:

```bash
rm -rf .next
pnpm build 2>&1 | tee /tmp/t205-build-r5.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build-r5.txt
```

No reutilizar la tabla de tamaños de una ronda anterior.

### H03

En el HEAD actual permanecen `[ ]`:

- axe AA / Lighthouse / first-load combinado;
- browser 390/360 + reduced-motion + teclado + contraste + overflow;
- auditoría integrada src/ui.

La propia bitácora declara axe y Lighthouse pendientes.

### CI final

No se usa como criterio de cierre mientras existan H03/R05/R06/R07.

Cuando ya no haya bloqueantes:

```bash
pnpm typecheck
pnpm lint
pnpm test
rm -rf .next
pnpm build 2>&1 | tee /tmp/t205-build-final.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build-final.txt
git diff --check
node docs/revision-pr/analizar.mjs verificacion
```
