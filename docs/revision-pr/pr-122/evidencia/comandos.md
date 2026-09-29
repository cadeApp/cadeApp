# Evidencia y reproducciones — PR #122

## Ronda 4 — HEAD `732a9bdc16ef495920c0a6c55920aa3ae427aca4`

### Commits desde Ronda 3

```text
5915ad4e66457fd83103518bcf5ef41de4da5273
fix(T-205): resolver clipping horizontal y regenerar capturas con harness cdp [T-205]

732a9bdc16ef495920c0a6c55920aa3ae427aca4
docs(tasks): registrar commit de ronda 3 en bitacora [T-205]
```

### PNG nuevas

Se inspeccionaron las 14 PNG T-205 a 390 y 360 px.

Resultado visual:

- ya no hay clipping evidente como en Ronda 3;
- los tres tabs de MyOffersList son visibles;
- botones y badges de TripMerchantView caben;
- formularios de onboarding caben;
- CreateRequest y RequestOffers no muestran recortes horizontales visibles.

### Harness declarado

La bitácora declara:

`src/features/requests/evidence/browser-audit.test.tsx`

Consulta GitHub en el HEAD:

```text
404 Not Found
```

También se comprobó:

`src/features/requests/evidence/T-205/browser-audit.test.tsx`

Resultado:

```text
404 Not Found
```

El compare entre `e52b99b2...` y `732a9bdc...` contiene únicamente:

- `docs/tasks/log/T-205.md`;
- las 14 PNG T-205.

No hay script/test/harness agregado.

### Diferencia entre capturas y árbol canónico de onboarding

Ruta real identity:

`src/app/(courier)/courier/onboarding/identity/page.tsx`

```tsx
<div className="flex flex-col items-center justify-start px-4 py-6">
  <IdentityForm courierId={user?.id || 'temp-courier'} />
</div>
```

Ruta real vehicle:

`src/app/(courier)/courier/onboarding/vehicle/page.tsx`

```tsx
<div className="flex flex-col items-center justify-start px-4 py-6">
  <VehicleForm courierId={user?.id || 'temp-courier'} />
</div>
```

No existe:

`src/app/(courier)/courier/onboarding/layout.tsx`

El layout de grupo real:

`src/app/(courier)/layout.tsx`

solo agrega:

- TopBar;
- main;
- CourierNav.

No agrega StepIndicator.

Los componentes:

- `IdentityForm`;
- `VehicleForm`;

ya contienen internamente su propio:

`<StepIndicator ... />`

Sin embargo las cuatro PNG de onboarding de Ronda 4 muestran **dos barras completas de pasos**: una exterior y otra dentro del Card.

Conclusión: el montaje capturado no coincide exactamente con el árbol canónico de las rutas reales.

### Corrección esperada

Versionar el harness real dentro de un path permitido, por ejemplo:

`src/features/requests/evidence/T-205/browser-audit.test.tsx`

o un archivo equivalente claramente documentado.

Debe:

1. reutilizar los layouts/pages/componentes reales;
2. no inventar un segundo StepIndicator;
3. registrar el comando exacto;
4. usar CDP / viewport móvil como se describe;
5. producir salida textual de offenders;
6. regenerar las 14 PNG desde ese mismo mecanismo.

Después, un tercero debe poder ejecutar el comando desde el repo y obtener los mismos resultados.

### H03

Todavía pendientes según la propia bitácora:

- Lighthouse móvil;
- axe AA.

Los checkboxes de DoD permanecen correctamente en `[ ]`.

### CI

No se revisa como criterio final mientras H03/R04 sigan bloqueando.

Cuando no queden bloqueantes:

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
