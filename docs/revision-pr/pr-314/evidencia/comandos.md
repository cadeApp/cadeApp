# Evidencia y comandos — PR #314 / T-339 — Ronda 1

**Código base de auditoría:** `d42035c12df95bb24a3a70ce6d0baaf5157fe003` · **GREEN real:** `cad7f7eacfba215ac03256f0e3493b5606ea0dfd`.

## Fuente y runs verificables

- `git diff develop...d42035c12d` (vía GitHub patch): solo `e2e/specs/fixed-price.spec.ts` y `docs/tasks/log/T-339.md`.
- `compare cad7f7eacfba215ac03256f0e3493b5606ea0dfd...d42035c12df95bb24a3a70ce6d0baaf5157fe003`: solo 38 líneas nuevas de bitácora.
- RED inicial: https://github.com/cadeApp/cadeApp/actions/runs/37860963530 , job `113596358915`. 53 PASS/3 FAIL, tres flujos UI no encuentran botón de login; carreras H05 pasan. Corregimos el informe anterior de #257 que decía que fallaba antes de crear la solicitud: el test ya había publicado.
- RED intermedio: https://github.com/cadeApp/cadeApp/actions/runs/37864378329 , job `113607557188`. 54 PASS/2 FAIL; esperado `matched`, recibido `published`; esperado ofertas 1, obtenido 0. Tercer flujo UI y concurrencia PASS.
- GREEN: https://github.com/cadeApp/cadeApp/actions/runs/37866089620 , job `113613109964`. Siete E2E T-339 PASS: spec `fixed-price.spec.ts:72,177,277,337,396,475,526`. Totales `56 passed (12.1m)` y `3 passed (1.1m)` en `global-settings`. No reintentos reportados.
- CI HEAD: https://github.com/cadeApp/cadeApp/actions/runs/37867478855: Vitest 125/2013 PASS, rpc-fake branch coverage 90.04%; pgTAP 20/1903 PASS, `t339_fixed_price.sql ... ok`, db types success, demás jobs success.
- Estado de E2E del HEAD al revisar: run https://github.com/cadeApp/cadeApp/actions/runs/37867592142 estaba in_progress: no atribuirle los 56/3 que corresponden a `cad7f7e`.
- `approval-policy` rojo por placeholder del informe: el archivo `.github/workflows/approval-policy.mjs` exige un cuerpo con marcador `### Informe de revisión de agy`, `Informe revisar-pr — T-339`, `Resultado: SIN BLOQUEANTES`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:` y `No revisado / dudas para Lautaro073:`.

## Código completo para control independiente y mutación

Copiar literal a `/tmp/pr314-check.mjs` y ejecutar en worktree limpio del SHA que se quiera examinar:

```bash
PR314_ROOT="$PWD" node /tmp/pr314-check.mjs
```

```js
// pr314-check.mjs: guard E2E T-339 y mutaciones IN-MEMORY independientes
// Invocación desde checkout limpio en el SHA revisado:
// PR314_ROOT="$PWD" node /tmp/pr314-check.mjs
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const source = readFileSync(resolve(process.env.PR314_ROOT || process.cwd(), 'e2e/specs/fixed-price.spec.ts'),'utf8');
const markers = [
  "test('DoD: solicitud creada por UI con precio y switch activo",
  "test('DoD: solicitud creada por UI con precio y switch inactivo",
  "test('DoD: solicitud creada por UI sin precio fijo",
  "test('H05.1:",
];
function audit(text) {
  const starts = markers.map(m => text.indexOf(m));
  if(starts.some(i=>i<0)) return [['Secciones conservadas',false]];
  const parts = starts.slice(0,3).map((n,i)=>text.slice(n,starts[i+1]));
  const tests=[];
  parts.forEach((part,i)=>{
    tests.push([`Flujo ${i+1} roles separados`,part.includes('loginAsCourier(0, courierBrowserPage)')&&!part.includes('loginAsCourier(0, page)')]);
    tests.push([`Flujo ${i+1} contexto aislado`,part.includes('newCourierContext(browser, testInfo)')&&part.includes('courierContext.newPage()')]);
    tests.push([`Flujo ${i+1} cierre finally`,/}\s*finally\s*{\s*await courierContext\.close\(\);/.test(part)]);
    if(i<2)tests.push([`Flujo ${i+1} espera éxito antes de DB`,part.indexOf("getByText('¡Pedido tomado con éxito!')")>0&&part.indexOf('getRequestInspectionData(stagingContext, requestId)',part.indexOf("getByText('¡Pedido tomado con éxito!')"))>0]);
  });
  tests.push(['Sin skips/sleeps/soft',!/test\.(?:skip|only|fixme)\s*\(|waitForTimeout\s*\(|expect\.soft\s*\(/.test(text)]);
  tests.push(['Oráculos DB no debilitados',text.includes("expect(matchedInspection.requestStatus).toBe('matched')")&&text.includes("expect(midwayInspection.offers).toHaveLength(1)")]);
  return tests;
}
const before=audit(source);
const mutants=[
 ['M1 roles mezclados',source.replace('loginAsCourier(0, courierBrowserPage)','loginAsCourier(0, page)'),'Flujo 1 roles separados'],
 ['M2 sin espera éxito',source.replace("await expect(courierBrowserPage.getByText('¡Pedido tomado con éxito!')).toBeVisible();",'// removed'),'Flujo 1 espera éxito antes de DB'],
 ['M3 no cierra',source.replace('await courierContext.close();','// removed'),'Flujo 1 cierre finally'],
 ['M4 DB oracle débil',source.replace("expect(matchedInspection.requestStatus).toBe('matched')","expect(matchedInspection.requestStatus).toBe('published')"),'Oráculos DB no debilitados'],
 ['M5 skip placebo',source.replace("test('H05.1:","test.skip('placeholder',()=>{});\n test('H05.1:"),'Sin skips/sleeps/soft'],
];
const outcome=mutants.map(([id,txt,target])=>({id,detector:target,red:audit(txt).find(([name])=>name===target)?.[1]===false}));
console.log('BASE',before.map(([name,pass])=>pass?'GREEN '+name:'RED '+name).join('\n'));
console.log('MUTACIONES',JSON.stringify(outcome));
if(before.some(([,pass])=>!pass)||outcome.some(x=>!x.red))process.exitCode=1;
```

**Ejecución independiente de auditoría:** el detector equivalente fue evaluado desde JavaScript sobre el blob GitHub del SHA `d42035c12df95bb24a3a70ce6d0baaf5157fe003`. Todas las **13** propiedades de base GREEN. Mutaciones de copia EN MEMORIA: reutilizar `page` para courier → detector RED; quitar señal de toma → RED; quitar `close()` → RED; cambiar oráculo `matched` por `published` → RED; inyectar `test.skip` → RED. **No se ejecutó Playwright sobre mutaciones**, por lo que las mutaciones demuestran sensibilidad del detector estático, no una prueba runtime de resistencia al fallo.

## Qué no se hizo

- No se ejecutó `git merge-tree` sobre clon local; GitHub señala `mergeable=true`, y no hay divergencia con develop al SHA inspeccionado.
- No se levantó Supabase/Docker, no se accedió a secretos ni se corrió un workflow manual.
- No se editó ni ejecutó código de producción. Las pruebas runtime son GitHub Actions del SHA indicado.
