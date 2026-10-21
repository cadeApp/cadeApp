# Evidencia — PR #475 / T-388 y T-389

## Procedimiento independiente ejecutado
Se leyeron mediante el conector GitHub las tres fichas/plan en los commits `967bf1ab02a1b079dd7b3873687b2c1fac6fe9e1` y `bc12c2518b3dc29649529913f5d17b3107254c82`. Se comprobó la cobertura de nueve rutas en ficha y fila del plan, y cinco reglas de semántica/DoD. Resultado real ejecutado sobre esas cadenas:

```text
967bf1ab: Checks 14; PASS 2; faltantes 12
bc12c251: Checks 14; PASS 14; faltantes 0
```

Esto es **verificación documental**, no ejecución de código de producción ni de `verify-fichas`. No atribuir a esta evidencia pruebas RED/GREEN de funcionalidad de la futura implementación.

## Harness completo, autocontenido y copiable
Ejecutar en un clon limpio del SHA deseado. Guardar TODO el bloque siguiente en `/tmp/pr475-spec-check.cjs` y ejecutar desde el root `node /tmp/pr475-spec-check.cjs`. También es válido copiar el script a `/tmp`; solo lee archivos del repo desde cwd y no modifica nada.

```js
const fs=require('node:fs');
const path=require('node:path');
const root=process.cwd();
const [a,b,c]=['docs/tasks/T-388.md','docs/tasks/T-389.md','docs/implementation-plan.md'].map(p=>fs.readFileSync(path.join(root,p),'utf8'));
const allowed=a.split('## Archivos permitidos')[1]?.split('## Fuera de alcance')[0]??'';
const row=c.split('\n').find(x=>x.startsWith('| T-388 |'))??'';
const required=[
'src/lib/format/index.ts','src/lib/format/format.test.ts',
'src/features/offers/components/my-offers-list.tsx',
'src/features/offers/components/my-offers-list.test.tsx',
'src/features/requests/components/merchant-requests-list.tsx',
'src/features/requests/components/merchant-history-view.tsx',
'src/features/requests/components/request-offers-list.tsx',
'src/server/live/t204.ts','src/server/live/t204.test.ts'
];
const checks=required.map(p=>({name:p,ok:allowed.includes(p)&&row.includes(p)}));
checks.push({name:'0m valido',ok:a.includes('Menos de 0,5 km')&&a.includes('con `0`')});
checks.push({name:'RLS distinto de NULL',ok:a.includes('RLS')&&a.includes('no visible')});
checks.push({name:'SELECT verificado en tests',ok:a.includes('.select()')&&a.includes('un mock no puede devolver')});
checks.push({name:'D05-A courier delivered',ok:b.includes('D05-A no cambia')&&b.includes('con el viaje entregado')});
checks.push({name:'elementFromPoint descendants',ok:b.includes('descendiente suyo')});
const failed=checks.filter(x=>!x.ok);
checks.forEach(x=>console.log(x.ok?'OK '+x.name:'FALTA '+x.name));
console.log('Checks '+checks.length+'; faltantes '+failed.length);
if(failed.length)process.exitCode=1;
```

## Comandos de diagnóstico read-only
```bash
git fetch origin
git diff origin/develop...bc12c2518b3dc29649529913f5d17b3107254c82 --stat
git diff 967bf1ab02a1b079dd7b3873687b2c1fac6fe9e1 bc12c2518b3dc29649529913f5d17b3107254c82 -- docs/tasks/T-388.md docs/tasks/T-389.md docs/implementation-plan.md
git merge-tree --write-tree origin/develop bc12c2518b3dc29649529913f5d17b3107254c82
rg -n 'approx_distance_m|route_distance_m' src/features/offers/queries.ts src/features/requests/queries.ts src/server/live/t204.ts
rg -n 'canReportIncident|elementFromPoint|ReportIncidentButton' src/features/incidents src/features/trips e2e/specs/main-flow.spec.ts
```

## Para comprobar la implementación FUTURA
Se deberán ejecutar los tests nuevos y su mutación RED/verdadera en la PR que cambie `src/**`. Para T-388: cada `.select()` parent del lector feed/live/Mis ofertas/comercio debe fallar al volverlo a `approx_distance_m`, sin falsificar mocks; pruebas para `3500`, `0`, `NULL` y parent oculto por RLS; E2E con publicación real y garantía D3. Para T-389: mover el botón fuera de padding y quitar ETA=5 debe dejar RED las pruebas; E2E valida hit-test y click, sin saltarse tests. **Ninguna mutación aplicada al repo durante esta revisión documental.**
