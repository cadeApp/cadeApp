# Ronda 1 — PR #253 (T-309) — Revisión independiente

- SHA revisado: `0dc814cf1e240f50bc3c9add370ac924866c39cc`
- develop: `1cd3da01b3af9619e4a19107ba5e8354a18c2159`
- Fecha: 2026-10-05
- Rama al revisar: 2 delante / 1 detrás.
- D01: **1-A**, resuelta por Lautaro073.

## Informe revisar-pr

~~~text
Informe revisar-pr — T-309 — 2026-10-05 — generado por revisión independiente
Resultado: CON BLOQUEANTES (8)
Checks locales: typecheck ⚪ · lint ⚪ · test ⚪ · E2E ⚪ · test:db n.a.

BLOQUEANTES:
- PR253-H01 [uploads-a11y.spec.ts:21-43; package.json] axe-core se obtiene de una transitiva y de internals de .pnpm. D01/1-A: instalar @axe-core/playwright@4.13.0 y usar AxeBuilder.
- PR253-H02 [uploads-a11y.spec.ts:150-182] usa selectores CSS (#file-input, [data-slot]) en vez de rol/label accesible.
- PR253-H03 [uploads-a11y.spec.ts:240-259; guards.ts:287-294] inicia merchant y después courier en la misma page; /login redirige si ya existe sesión.
- PR253-H04 [uploads-a11y.spec.ts:261-273; staging-seed.ts:493; CC-008] audita /trips/:id con una solicitud published sin accepted_offer; get_trip_details exige matched/in_transit/delivered.
- PR253-H05 [uploads-a11y.spec.ts:71-78] axe termina en WCAG 2.1; la regla vigente exige WCAG 2.2 AA.
- PR253-H06 [upload case; e2e/AGENTS.md:12; storage RLS] el upload exitoso deja un objeto real en courier-docs; cleanupStagingData no limpia Storage y el courier no tiene DELETE.
- PR253-H07 [bitácora/body] el “RED” son 3 fallos fail-closed de entorno, no mutaciones de las propiedades del DoD.
- PR253-H08 [bitácora/body] se marca pnpm test verde, pero la evidencia mostrada es solo verify-fichas 7/7.

MEJORAS:
- ninguna.

No revisado / dudas:
- CI no inspeccionado para cierre porque hay bloqueantes.
- El checkout independiente no pudo clonarse por DNS del entorno; no se afirma ejecución local.
~~~

## Evidencia resumida

- `package.json` no declara axe; `pnpm-lock.yaml` trae `axe-core@4.13.0` vía `eslint-plugin-jsx-a11y`.
- `evaluateRouteGuard('/login', session)` redirige a la home del usuario; el test reutiliza la misma page para dos roles.
- El seed base crea `delivery_requests.status='published'`; CC-008 rechaza estados fuera de `matched|in_transit|delivered` y exige `accepted_offer_id`.
- RLS de `courier-docs`: INSERT del courier dueño, ALL del admin; no DELETE del courier.
- La bitácora declara `test ✅ (7/7 en verify-fichas)`, que no equivale a `pnpm test`.

## Prompt de arreglo

~~~text
Tarea: T-309, PR #253, rama feat/T-309-uploads-a11y.

0. git pull. Sin rebase, force-push ni amend.
1. git fetch origin && git merge origin/develop. No rebasees.
2. La ficha YA fue ampliada por D01/1-A: package.json, pnpm-lock.yaml y @axe-core/playwright@4.13.0 están autorizados. No amplíes nada más.

Podés tocar SOLO:
- e2e/specs/uploads-a11y.spec.ts
- package.json
- pnpm-lock.yaml
- docs/tasks/log/T-309.md
- body/comentarios de la PR para evidencia

Prohibido:
- docs/revision-pr/**
- otros e2e/fixtures, e2e/pages, src/**, supabase/**, .github/**, .agents/**
- dependencias distintas de @axe-core/playwright@4.13.0
- crear tests falsos o tautológicos, adulterar mocks/aserciones/datos para conseguir verde
- .skip, .only, retries, sleeps fijos, subir timeouts o bajar checks
- marcar hallazgos como verificados
- rebase, amend, force-push

1. H01/H05 — axe:
   - pnpm add -D @axe-core/playwright@4.13.0
   - eliminar fs/path/loadAxeCoreSource/window.axe manual;
   - importar AxeBuilder;
   - constante readonly exacta: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22a, wcag22aa;
   - runAxeAudit: new AxeBuilder({ page }).withTags([...]).analyze();
   - aserción de contrato de tags para que quitar wcag22a/wcag22aa quede RED.
   - no edites pnpm-lock.yaml a mano.

2. H02 — flujo accesible:
   - cero page.locator('#...'), [data-slot] o clases;
   - input DNI frente con getByLabel(/DNI frente/i);
   - error por getByRole('alert');
   - segundo setInputFiles sobre el mismo locator accesible después de desactivar el corte;
   - éxito por role=status + storage path real, no data-status CSS.
   - RED: label inexistente debe tumbar el caso; sin fallback CSS.

3. H03 — sesiones:
   - agregá browser al test axe;
   - login queda en page anónima;
   - merchant en BrowserContext/page propio usando loginAsMerchant;
   - courier en OTRO BrowserContext/page usando loginAsCourier;
   - feed, viaje y onboarding en la page courier;
   - cerrá contextos en finally;
   - antes de cada axe, expect(page).toHaveURL(ruta canónica).
   - RED: reutilizar la page merchant para courier debe fallar antes de axe.

4. H04 — viaje:
   - importá seedDeliveryRequestInState desde ../fixtures;
   - creá status:'matched', assignedCourierId:courier.id, withContacts:true;
   - auditá /trips/<id devuelto>, no createdRequestIds[0].
   - RED: cambiar matched por published debe fallar la precondición.

5. H06 — cleanup Storage:
   - tras success leé el storage path real de sessionStorage;
   - importá createAdminClient desde @/server/supabase/admin;
   - en finally: admin.storage.from('courier-docs').remove([path]); error debe ser null;
   - no loguees secrets, URLs firmadas ni documento.
   - RED: omitir remove temporalmente debe ser detectable comprobando con admin que el objeto sigue existiendo.

6. H07 — RED conductual:
   - retry: dejá simulatedCutActive=true en el segundo intento => success debe fallar;
   - servidor: mutá a nombre .jpg + contentType image/jpeg => la expectativa de rechazo debe fallar; limpiá si crea objeto;
   - axe: antes de CADA una de las 5 auditorías inyectá temporalmente un <img> sin alt => esa auditoría debe reportar violación.
   - revertí todas las mutaciones antes del commit final.

7. H08 — checks:
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm exec playwright test e2e/specs/uploads-a11y.spec.ts --project=chromium
   Un fail-closed local NO cuenta como RED conductual. El cierre remoto es e2e-preview del SHA final.
   Actualizá bitácora/body con el comando exacto realmente ejecutado.

Al terminar:
- bitácora: hecho / pruebas / falta; no escribas “verificado”
- commit Conventional Commits + [T-309]
- push
- pegá: git ls-remote origin feat/T-309-uploads-a11y
- mantené Draft.
~~~
