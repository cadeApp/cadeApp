# Evidencia y comandos reproducibles — PR #438 / T-377

SHA de la ficha examinada: `e6e6769109dfef5926dea90dc44bd1100c9163ab`. Revisión **solo documental**.

## Inspección efectivamente realizada vía GitHub

- Comparación `develop...docs/T-377-trip-street-route`: 2 archivos (+93/-0), 1 commit de ventaja y 0 detrás, sin cambio de aplicación ni SQL.
- `docs/tasks/T-377.md` no existe en `develop`; aparece únicamente en esta PR.
- `src/features/trips/route-points.ts`: `canDrawMap: missing.length === 0`.
- `src/features/trips/components/trip-route-map.tsx`: si `!plan.canDrawMap`, no monta `<GoogleMap>` ni `<Polyline>`.
- `src/features/trips/route-map.test.tsx`: caso `sin coordenadas` y `multi-drop con una entrega sin pin` esperan ausencia de línea parcial.
- Documentación Google: https://developers.google.com/maps/documentation/javascript/reference/route ; https://developers.google.com/maps/documentation/javascript/usage-and-billing ; https://developers.google.com/maps/billing-and-pricing/pricing .

## Guard documental (RED actual, no prueba de runtime)

La ejecución sobre el contenido remoto del SHA revisado devolvió exactamente:

~~~text
FAIL H01/T-363 explicit no partial
FAIL H02/path response field mask
FAIL H02/preserve ordered stops
FAIL H03/sku and intermediate cost boundary
FAIL H03/no unconditional free pilot promise
~~~

**Reproducir en un clon después de `git pull`**, desde la raíz. El script es autocontenido: copiar el bloque a `/tmp/pr438-doc-guard.mjs` y ejecutarlo con `node /tmp/pr438-doc-guard.mjs`. No modifica archivos, no crea mocks y no sustituye un test de implementación. No se afirma que el script se ejecutó localmente en el entorno de revisión.

~~~bash
cat > /tmp/pr438-doc-guard.mjs <<'NODE'
import { readFileSync } from 'node:fs';
const t = readFileSync('docs/tasks/T-377.md', 'utf8');
const checks = [
  ['H01/T-363 explicit no partial',
    /si falta al menos una coordenada[\s\S]{0,250}no se dibuja (?:mapa ni línea parcial|ningún recorrido parcial)/i.test(t)],
  ['H02/path response field mask', /fields:\s*\[\s*['"]path['"]\s*\]/.test(t)],
  ['H02/preserve ordered stops', /optimizeWaypointOrder:\s*false/.test(t)],
  ['H03/sku and intermediate cost boundary',
    /Essentials/.test(t) && /10 (?:puntos|waypoints|paradas) intermedios/i.test(t)],
  ['H03/no unconditional free pilot promise',
    !/con el cupo gratuito de Google alcanza para el piloto/i.test(t)],
];
for (const [name, ok] of checks) console.log((ok ? 'PASS' : 'FAIL') + ' ' + name);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
NODE
node /tmp/pr438-doc-guard.mjs
~~~

**Alcance del guard:** únicamente detecta la presencia explícita de los contratos documentados. Una pasada GREEN no demuestra que la implementación futura funcione; requiere revisión humana de semántica y pruebas de runtime en la PR posterior. No cambiar el script o debilitar regex para fabricar GREEN: corregir la ficha y luego volver a ejecutar.

## Comprobaciones apropiadas para esta PR documental

~~~bash
git fetch origin
git diff --check origin/develop...HEAD
git diff --name-only origin/develop...HEAD
pnpm vitest run tools/verify-fichas.test.ts
node docs/revision-pr/analizar.mjs verificacion
~~~

La PR original declaró `verify-fichas` 7/7 y `diff --check` limpio; esta revisión **no** los ejecutó localmente. Los últimos dos comandos se destinan a verificación posterior del informe y estructura. No ejecutar `pnpm test:db`, `e2e-preview` manual, levantar Supabase, usar credenciales ni exigir CI GREEN nuevo solo por cambios del informe.


## Ronda 2 — guard reproducido contra contenido remoto del nuevo SHA

**HEAD revisado:** `1a24494cdc9c2fac0e85fe550f040849a57b2fa4`. Referencia vieja para contraste: `e6e6769109dfef5926dea90dc44bd1100c9163ab`.

El script completo y copiable sigue intacto en la sección de ronda 1, supra. El revisor recuperó por GitHub ambas versiones de `docs/tasks/T-377.md` y aplicó **sin modificar las expresiones** los cinco predicados JS del harness al texto de cada SHA. Salida:

~~~text
SHA e6e6769109dfef5926dea90dc44bd1100c9163ab
FAIL H01/T-363 explicit no partial
FAIL H02/path response field mask
FAIL H02/preserve ordered stops
FAIL H03/sku and intermediate cost boundary
FAIL H03/no unconditional free pilot promise

SHA 1a24494cdc9c2fac0e85fe550f040849a57b2fa4
PASS H01/T-363 explicit no partial
PASS H02/path response field mask
PASS H02/preserve ordered stops
PASS H03/sku and intermediate cost boundary
PASS H03/no unconditional free pilot promise
~~~

**Chequeo semántico independiente adicional, no textual tautológico**: 15/15 PASS al leer contenido remoto: 3 fallbacks excluyentes; componente bajo provider, último destino, orden de intermedios, recálculo, distancia servidor, máximo 10 intermedios y texto C06; costo no garantizado; 3 elementos correspondientes del cuerpo de la PR; y preservación de la ronda previa en `hallazgos.jsonl`.

GitHub compare entre `ace07ff` y `1a24494`: solo `docs/tasks/T-377.md`, +36/-11. GitHub compare del PR completo: todos los archivos son documentales. GitHub confirmó `mergeable=true`. El autor declaró `verify-fichas` 7/7 y `diff --check` limpio, **no ejecutados por el revisor**. CI general en curso y e2e-preview pendiente al observarse; fuera del alcance requerido de esta PR de ficha.

**Reproducibilidad local:** utilizar el bloque de `/tmp/pr438-doc-guard.mjs` arriba con `git show e6e6769:docs/tasks/T-377.md > docs/tasks/T-377.md` en un **directorio temporal separado** para RED, luego con contenido del SHA `1a24494` para GREEN. **No modificar la working tree del autor ni escribir encima de su ficha**. Alternativamente ejecutar el guard en worktrees efímeros limpios para cada SHA. Nunca fabricar un test para producir GREEN. Esta ronda ejecutó los predicados sobre texto devuelto por la API, no el `node` local.
