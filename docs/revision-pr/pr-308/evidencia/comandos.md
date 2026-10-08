# Evidencia independiente — PR #308 / T-350 / ronda 1

SHA inspeccionado: `823d5cc05ec7debf93c47de66df06469c0e43b0c`. Base develop: `d2ad3315ae9403194a35726b25f84996110a9216`.

## Fuente de la prueba E2E

PR temporal #307: `closed / merged=false`; HEAD final `39e8387539b6360179250fe244c65400b32ba5e8`.

SHA de blobs entre HEAD de #308 y HEAD de #307:

```text
components.test.tsx                         a485d4a14532943d48cadeb61c6789efd0cb8681 = idéntico
route-map.test.tsx                          89d98f84a81dd0650cfca4a97f5bb524899b45dd = idéntico
components/trip-courier-view.tsx           b9de580d45fb274c6294e47a76d639a21dc17bed = idéntico
components/trip-merchant-view.tsx          72205b77a93f4e0b805f7b45145958ed588ef3f5 = idéntico
components/trip-route-map.tsx              34de32348176bbc0fa597e4e340460d22ae9a653 = idéntico
```

Se recuperaron logs de Actions:

```text
37752295736 job 113228292311:
  ✓ DoD temporal T-350 axe AA viaje R07
  ✓ DoD temporal T-350 axe AA viaje C06
  ✓ DoD axe AA viaje (T-309)
  39 passed, 8 failed TOTAL

37755123346 job 113237786034:
  ✘ C06 mutante: getByRole('heading', { name:'Repartidor asignado' }) not found
  ✘ R07 SDK mutante: route-map-fallback Expected 0, Received 1
  37 passed, 10 failed TOTAL

37757764311 job 113246509689:
  ✓ DoD temporal T-350 axe AA viaje R07
  ✓ DoD temporal T-350 axe AA viaje C06
  ✓ DoD axe AA viaje (T-309)
  39 passed, 8 failed TOTAL
```

En `trip-axe-shared.review.ts` se verificaron `route-map-fallback` count cero, ambos pines, `.gm-style` visible, seis tags de axe, `violations=[]` y `passes>0`. Las ocho fallas fuera de T-350 se deben a 5 main-flow, 2 notifications y 1 onboarding axe T-351; **ningún job E2E completo quedó GREEN**.

## CI de #308 en SHA autor

```text
unit 113254104206: Test Files 123 passed, Tests 1945 passed;
                   workflows 75/75, ADR 6/6
db-tests 113254104058: Files=19, Tests=1854, PASS;
                       Files=1, Tests=10, PASS
typecheck/lint/build/audit/bundle-budget: success
approval-policy: failure («Falta el informe completo ... sin bloqueantes.»)
Vercel: failure («Deployment rate limited — retry in 24 hours.»)
```

La rama `feat/T-350-trip-axe-aa` está 2 commits atrás de `develop` (PR306/T-351 ficha y PR298/T-314). GitHub `mergeable=true` en el instante consultado.

## Control en memoria de pérdida de bitácora

```js
const headers = [
  '## 2026-10-08 — alta de tarea',
  '## 2026-10-08 — ronda 1 de revisión de la ficha: PR305-H01, H02 y H03 (Lautaro073, agente)'
];
function preservesHistory(content) {
  const lines = content.split('\n');
  const indices = headers.map(h => lines.indexOf(h));
  return indices.every(n => n >= 0) && indices[0] < indices[1];
}
// original: fetch_file docs/tasks/log/T-350.md desde develop
// branch:   fetch_file docs/tasks/log/T-350.md desde el HEAD de PR #308
// baseline: original -> GREEN
// branch:   branch -> RED
// fixture sintético: original + sesiones nuevas -> GREEN
// quitar cualquiera de los dos headings del fixture -> RED
```

Verificación independiente (JS en memoria; **no se aplicó un arreglo al repo**):

```text
originalHasBoth = true
prHasBoth = false
syntheticCheck = true
mutA = false
mutB = false
Original 60 líneas, PR 120 líneas.
```

No se ejecutaron tests locales, Supabase ni deploys desde esta revisión. No se leyeron secretos ni se inspeccionó la configuración privada de Vercel. El MAP ID de Production requiere confirmación manual de Lautaro073.
