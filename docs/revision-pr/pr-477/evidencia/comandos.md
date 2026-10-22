# Evidencia — PR #477, ronda 1
Código auditado en SHA 620d92c04a95ebdee8e8c28f9f798c2a4e39bdc5. No se clonó ni ejecutó Vitest/E2E. No se inventan resultados.

## H01 — Prueba por inspección
- src/features/requests/queries.test.ts:2983 usa readFileSync y matchAll sobre fuente para representar tres lectores; no registra las llamadas reales de .select().
- src/server/live/t204.test.ts:1353 usa readFileSync + slice de texto; tampoco registra .select().

## H02 — Harness autocontenido ejecutado
Reproduce exclusivamente la aserción regex (NO es Vitest ni un test real de DOM):

~~~bash
node <<'NODE'
const regex = /approxDistanceLabel\(req\.approxDistanceKm\)/;
const original = '<span>{approxDistanceLabel(req.approxDistanceKm)}</span>';
const mutated = original.replace('{approxDistanceLabel(req.approxDistanceKm)}', '{req.approxDistanceKm}{/* approxDistanceLabel(req.approxDistanceKm) */}');
if (!regex.test(original) || !regex.test(mutated)) throw new Error('No se reproduce');
console.log('Original: true; mutado: true');
NODE
~~~

Salida verificada: `Original: true; mutado: true`. La llamada al helper quedó solo en un comentario.

## Batería independiente pendiente sobre el nuevo SHA
1. Baseline GREEN de tests modificados.
2. Mutación individual de proyección route_distance_m→approx_distance_m en getMerchantHistoryRequests, getMerchantRequests, getMerchantRequestWithOffers y getAvailableRequestsLiveServer. Cada test debe fallar por el campo incorrecto, no por mocks o TypeError.
3. Mutar el JSX de MerchantRequestsList a texto crudo: el test que monta la UI debe fallar.
4. Restaurar todas las mutaciones, revalidar GREEN y guardar líneas Test Files/Tests genuinas.

Comandos previstos:
~~~bash
pnpm exec vitest run src/features/requests/queries.test.ts src/server/live/t204.test.ts src/features/requests/components/merchant-requests-list.test.tsx
pnpm typecheck && pnpm lint && pnpm test
~~~

CI y E2E remotos pendientes de verificación sobre el SHA final. No se levantó DB, Docker ni servicios externos.

## Ronda 2 (SHA ea2aa9bfbd3862ac32a8da3f745c4e7b4dd24177) — comprobación propia de proyecciones (no Vitest)

Se ejecutó una versión equivalente a este harness en Node sobre contenidos de los seis archivos recuperados de GitHub para el SHA exacto. Extrae exclusivamente la primera proyección `delivery_requests.select(`... `)` de cada función; aplica en memoria una mutación de columna. **No ejecuta funciones TypeScript ni Vitest**, y no sustituye los cinco RED reportados por el autor.

~~~bash
node --input-type=module <<'NODE'
import {readFileSync} from 'node:fs';
const targets=[
 ['getMerchantHistoryRequests','src/features/requests/queries.ts'],
 ['getMerchantRequests','src/features/requests/queries.ts'],
 ['getMerchantRequestWithOffers','src/features/requests/queries.ts'],
 ['getAvailableRequestsLiveServer','src/server/live/t204.ts'],
];
for(const [name,path] of targets){
 const source=readFileSync(path,'utf8');
 const head='export async function '+name+'(';
 const start=source.indexOf(head);
 if(start<0)throw new Error('No existe '+name);
 const tail=source.slice(start+head.length);
 const next=tail.search(/\nexport (?:async )?function /);
 const block=next<0?tail:tail.slice(0,next);
 const m=block.match(/\.from\('delivery_requests'\)\s*\.select\(\s*\`([\s\S]*?)\`/);
 if(!m)throw new Error('Sin select real: '+name);
 const projection=m[1], baseline=/\broute_distance_m\b/.test(projection)&&!/\bapprox_distance_m\b/.test(projection);
 const mutation=projection.replace('route_distance_m','approx_distance_m');
 const after=/\broute_distance_m\b/.test(mutation)&&!/\bapprox_distance_m\b/.test(mutation);
 if(!baseline||after)throw new Error('Control no detecta mutación: '+name);
 console.log(name+': baseline=PASS; mutant=FAIL');
}
NODE
~~~

Resultado propio observado:

~~~text
getMerchantHistoryRequests: baseline=PASS; mutant=FAIL
getMerchantRequests: baseline=PASS; mutant=FAIL
getMerchantRequestWithOffers: baseline=PASS; mutant=FAIL
getAvailableRequestsLiveServer: baseline=PASS; mutant=FAIL
~~~

El test nuevo de comercio invoca las tres funciones y compara el registro de `.select`; el de live invoca `getAvailableRequestsLiveServer` y compara `reqBuilder._calls.select[0]`. El test DOM monta `MerchantRequestsList` y compara las tres etiquetas visibles. Todo corroborado por inspección.

CI en el commit auditado: [unit job 119457659964](https://github.com/cadeApp/cadeApp/actions/runs/39667889275/job/119457659964): `Test Files 155 passed (155)`, `Tests 3165 passed (3165)`; typecheck/lint/build/audit/bundle-budget success. `db-tests` pending y `e2e-preview` error por cancelación (no verde). Bitácora declara RED de cinco mutaciones y E2E 8/9; no se presenta como evidencia independiente de ejecución.

El fallback 500 de feed se rastrea en [issue #478](https://github.com/cadeApp/cadeApp/issues/478); su causa permanece sin diagnosticar.
