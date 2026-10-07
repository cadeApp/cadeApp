# e2e/ — pruebas de punta a punta (dueña de la carpeta: P3)

- Corre en CI contra el Vercel Preview de cada PR interna con Supabase Develop (`e2e-preview`), contra staging en
  checkpoints y release candidates (`e2e-staging`), o local con seed. Cada gate va serializado por `concurrency`
  y con `--workers=1`. Nunca contra producción.
- Specs: `e2e/specs/<flujo>.spec.ts`, uno por flujo. Los escriben P2 o P3 según la ficha; P3 da visto bueno y aprueba Lautaro073.
- Todo spec en `e2e/specs/` entra solo a los gates (T-331): `e2e-preview` y `e2e-staging` corren el proyecto
  `chromium` y `e2e-preview` además `global-settings`. No hace falta tocar `.github/**` para sumar un spec; alcanza con
  que la ficha lo liste en sus archivos permitidos.
- Fixtures y page objects en `e2e/fixtures` y `e2e/pages`: los mantiene P3; uno nuevo se pide o lo lista la ficha.
- Selectores por rol o label accesible; nada de clases CSS ni textos frágiles.
- Cada spec crea sus propios usuarios y datos por fixtures y los limpia al terminar.
- Specs que cambian `platform_settings` van en el proyecto `global-settings` (serial) y restauran el valor.
- Cada aserción del DoD tiene que fallar si se rompe la regla que prueba (demostrarlo una vez y anotarlo).
- **Mutaciones RED de un control de seguridad (T-347):** para demostrar que un E2E queda RED al quitar una regla de
  `src/**`, nunca se pushea ni se despliega código roto. Se usa el workflow `e2e-mutation`:
  - la mutación vive como patch revisado en `e2e/mutations/` (`manifest.json` + `<id>.patch`, solo `src/**`, con
    `expectedFailure` que nombra la aserción concreta). Una mutación nueva entra por PR;
  - se pide con un `repository_dispatch` `e2e.mutation.requested` y `client_payload` `{ target, mutation }`. El
    único `target` es `develop` (PR294-A01): se prueba código ya mergeado, nunca una PR abierta:
    `gh api repos/cadeApp/cadeApp/dispatches -f event_type=e2e.mutation.requested -f 'client_payload[target]=develop' -f 'client_payload[mutation]=<id>'`;
  - corre en el runner trusted con el workflow de la rama por defecto: build de control y build mutado en
    `127.0.0.1`, el mismo caso sin retries. Solo `RED_CONFIRMED` (control GREEN y mutante RED por
    `expectedFailure`) es evidencia. El artifact `e2e-mutation-<id>-<sha7>` trae solo evidencia minimizada
    (resumen, patch y estado de cada fase), nunca salidas crudas de Playwright ni de los procesos;
  - `MUTANT_SURVIVED` no se arregla tocando el spec ni `expectedFailure`: se reporta a Lautaro073.
  - Mutaciones de base de datos (RPC, RLS, grants) no van acá: siguen con pgTAP en `db-tests`.
