# Evidencia y comandos — PR #122 — Ronda 1

SHA funcional revisado: `79d3aeaa4949bd85820467592dafb62fdc2232d4`.

## Inspección realizada

- `docs/tasks/T-205.md` desde `develop`.
- `AGENTS.md`, reglas 25/40/60 y skill `revisar-pr`.
- Diff completo y bitácora.
- `src/features/requests/dod-t205.test.tsx`.
- Superficies clave para enumerar targets.
- `.github/workflows/ci.yml` y `.github/workflows/check-bundle-budget.mjs`.

Esta revisión no tuvo checkout ejecutable. Los comandos siguientes son reproducibles para un worktree limpio; **no se registran como ejecutados por la revisión**.

## H01 — First Load JS

Control real del repo:

```bash
git worktree add /tmp/wt-pr122 <SHA-A-VALIDAR>
cd /tmp/wt-pr122
pnpm install --frozen-lockfile
pnpm build 2>&1 | tee /tmp/t205-build.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build.txt
```

La evidencia válida de RED es la tabla real del build con al menos una ruta de comercio/repartidor > 180 kB. El checker es advisory ante una ruta excedida, así que hay que leer el valor: exit 0 no convierte “Supera el límite” en verde.

Si el build exacto no muestra ninguna ruta > 180 kB, **no fabricar el rojo**: registrarlo y pedir decisión.

Para GREEN, repetir exactamente la misma medición después de corregir y comprobar todas las rutas auditadas <= 180 kB.

## H02 — targets 48 px

Barrido estático mínimo:

```bash
git grep -nE 'min-h-\[44px\]|min-h-10|h-10|py-1\.5' -- \
  'src/features/requests/**/*.tsx' \
  'src/features/offers/**/*.tsx' \
  'src/features/courier-onboarding/**/*.tsx' \
  'src/features/merchants/**/*.tsx' \
  'src/features/trips/**/*.tsx'
```

Casos ya observados:

- `create-request-form.tsx`: usar ubicación, Sí/No y presets con 44 px.
- `request-offers-list.tsx`: Documentación/Precio sin min-height.
- `offer-sheet.tsx`: chips rápidos `min-h-10`.
- `vehicle-form.tsx`: uploads Licencia/Seguro `h-10`.

La validación final no puede ser solo grep. En navegador a 390 y 360 px, en cada superficie del DoD, enumerar elementos interactivos visibles y registrar etiqueta + `getBoundingClientRect().width/height`. Los targets aplicables deben medir al menos 48x48.

Mutación RED por cada control corregido: quitar temporalmente su `min-h-12` o volverlo a 40/44 px; el control de regresión específico debe fallar. Restaurar antes de continuar.

## H03 — dependencia privada de axe

```bash
node -e "const p=require('./package.json'); console.log(Boolean((p.dependencies||{})['axe-core'] || (p.devDependencies||{})['axe-core']))"
git grep -n "node_modules/.pnpm/axe-core" -- src
```

En el SHA revisado se espera `false` y una coincidencia en `dod-t205.test.tsx`.

Arreglo con D01=1-A:

- eliminar `createRequire` y el require privado;
- no tocar `package.json` ni lockfile;
- dejar para `TripMerchantView` una regresión semántica que enumere headings y falle ante un salto de nivel;
- corregir la jerarquía real `h1 -> h3`;
- documentar la auditoría integral desde navegador; si axe real no puede ejecutarse, declararlo pendiente y no falsificarlo.

Mutación RED: volver temporalmente el heading corregido a `h3`; el test semántico debe fallar. Restaurar y confirmar verde.

## Comandos finales

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build 2>&1 | tee /tmp/t205-build-final.txt
node .github/workflows/check-bundle-budget.mjs /tmp/t205-build-final.txt
git diff --check
git status --short
git ls-remote origin feat/T-205-accesibilidad-rendimiento
```

No editar `docs/revision-pr/**` desde la sesión de arreglo. No bajar umbrales, borrar casos, introducir `.skip`/`.only`, cambiar expectativas para que coincidan con una implementación incorrecta ni crear tests tautológicos.
