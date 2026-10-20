# Evidencia y comandos — PR #448, ronda 1

**Commit base del autor:** `bbb5689612badb5103f64f8122814ccc124f7595`. **Fecha:** 2026-10-20.
**Entorno:** acceso GitHub mediante conector autenticado. `git ls-remote` desde el contenedor falló con `Could not resolve host: github.com`; sin clon de código, pnpm, base local ni E2E. Los resultados siguientes son **controles estáticos de texto**, jamás tests funcionales o pgTAP.

## Evidencia observada

- `get_pr_info(#448)`: 8 archivos, 801 inserciones; HEAD `bbb5689`, base `54bbdcd`, Draft, sin comentarios humanos.
- `compare_commits(develop, docs/T-379-qa-fichas)`: `ahead_by=1`, `behind_by=11`, status `diverged`; archivos del PR únicamente los 8 documentales.
- `get_pr_info(#440)`: `state=open`, `merged=false`; T-379 la declara mergeada (H04).
- Lectura directa del commit: `T-379.md:28-36` contempla estados accepted matched/in_transit/delivered, no accepted cancelled/null; `T-382.md:33-35` pone como confirmación `PUSH_STORAGE_KEY`; `CC-034.md:41` difiere de `:52`; `T-381.md:77-80` carece de test de navegación interna.
- Código de base: `src/features/notifications/push/subscription.ts` escribe `cadeapp_push_enabled=true` sin identificar la cuenta tras POST exitoso; `src/app/api/push/subscriptions/route.ts` soporta POST/DELETE, no verificación por usuario; `src/features/offers/queries.ts` obtiene la relación de solicitud, con `null` posible bajo RLS.

Comprobación programática en memoria sobre los cuatro documentos recuperados por el conector:

```text
RED | H01 accepted+cancelled definido
RED | H01 accepted+null definido
RED | H02 endpoint de verificacion autenticada
RED | H02 prueba entre cuentas
RED | H03 union prevStatus incluye aprobado
RED | H04 T378 no declarada mergeada
RED | H05 regreso SPA/cliente probado
```

**Sin verde afirmado:** los requisitos corregidos todavía no están en la rama revisada.

## Harness completo reproducible (Node sin dependencias)

El bloque delimitado por `HARNESS_START` y `HARNESS_END` es un programa completo. Se extrae como `/tmp/pr448-static.mjs` y se ejecuta desde cualquier lugar pasando el directorio raíz del clon. Comprueba el **contrato documental**, no sustituye las pruebas de producto. Una vez corregido el documento y estando el control en verde, usar las mutaciones propias para comprobar que no son tautológicas.

<!-- HARNESS_START -->
~~~javascript
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const docs = {
  t379: read('docs/tasks/T-379.md'),
  t381: read('docs/tasks/T-381.md'),
  t382: read('docs/tasks/T-382.md'),
  cc034: read('docs/contracts/CC-034.md'),
};

// Mutaciones en memoria: nunca editan el árbol de trabajo.
// Ejecutarlas solamente cuando el control normal ya sea GREEN.
const mutation = process.env.REVIEW_MUTATION || '';
if (mutation === 'H01') {
  docs.t379 = docs.t379.replace(/accepted[^\n]*solicitud[^\n]*cancelled[^\n]*Otras/i, 'accepted con solicitud cancelled: SIN DESTINO');
}
if (mutation === 'H02') {
  docs.t382 = docs.t382.replaceAll('/api/push/subscriptions/status', '/api/push/subscriptions/disabled');
}
if (mutation === 'H03') {
  docs.cc034 = docs.cc034.replace('"previousStatus": "suspended|rejected|approved"', '"previousStatus": "suspended|rejected"');
}
if (mutation === 'H04') {
  docs.t379 = docs.t379.replace(/Dependencias \(mergeadas en develop\):([^\n]*)/, 'Dependencias (mergeadas en develop):$1, T-378');
}
if (mutation === 'H05') {
  docs.t381 = docs.t381.replaceAll('navegación interna', 'visibilidad');
}

const checks = [
  ['H01-A estado cancelled', /accepted[^\n]*solicitud[^\n]*cancelled[^\n]*Otras/i.test(docs.t379)],
  ['H01-B estado null', /accepted[^\n]*(?:solicitud|estado)[^\n]*null[^\n]*Otras/i.test(docs.t379)],
  ['H02-A consulta backend', docs.t382.includes('/api/push/subscriptions/status')],
  ['H02-B caso multiusuario', /cuenta A[^\n]*cuenta B/i.test(docs.t382)],
  ['H03 retorno idempotente', docs.cc034.includes('"previousStatus": "suspended|rejected|approved"')],
  ['H04 T-378 pendiente', !/Dependencias \(mergeadas en develop\):[^\n]*T-378/.test(docs.t379) && /Bloqueada por[^\n]*T-378/i.test(docs.t379)],
  ['H05 navegador misma pestaña', /navegación interna/i.test(docs.t381)],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log((ok ? 'GREEN' : 'RED') + ' ' + name);
console.log('RESULT: ' + (checks.length - failed.length) + '/' + checks.length);
if (mutation) {
  if (failed.length === 0) {
    console.error('CONTROL DEFECTUOSO: mutacion ' + mutation + ' no produjo rojo');
    process.exitCode = 2;
  } else {
    console.log('RED esperado ante mutacion de ' + mutation);
  }
} else if (failed.length) {
  process.exitCode = 1;
}
~~~
<!-- HARNESS_END -->

Para extraer y correr desde la raíz de un clon limpio:

~~~bash
awk '/^<!-- HARNESS_START -->/{p=1;next}/^<!-- HARNESS_END -->/{p=0}p' docs/revision-pr/pr-448/evidencia/comandos.md | sed '1d;$d' > /tmp/pr448-static.mjs
node /tmp/pr448-static.mjs "$PWD"
# Luego del arreglo y una vez GREEN:
for id in H01 H02 H03 H04 H05; do
  REVIEW_MUTATION="$id" node /tmp/pr448-static.mjs "$PWD" || exit 1
done
~~~

**Limitación:** la detección de frase es un instrumento limitado a documentos. Un GREEN solo significa que las condiciones del texto están cubiertas. Las pruebas de código y de carrera deberán validarse por las PR de implementación separadas (sin falsos mocks ni expectativas adulteradas).

## Verificaciones finales al contar con un clon actualizado

~~~bash
git fetch origin
git ls-remote origin refs/heads/docs/T-379-qa-fichas
git diff origin/develop...origin/docs/T-379-qa-fichas --stat
git diff --name-only origin/develop...origin/docs/T-379-qa-fichas
git merge-tree --write-tree origin/develop origin/docs/T-379-qa-fichas
pnpm vitest run tools/verify-fichas.test.ts
node docs/revision-pr/analizar.mjs verificacion
git status --short
~~~

Leer `docs/tasks/T-379.md` y su fila en `docs/implementation-plan.md` para cotejar dependencias; comprobar que solo las 8 rutas documentales y `docs/revision-pr/pr-448/**` difieran del base. **No se corrieron estos comandos desde el contenedor de revisión** (sin acceso git al remoto). No usar sus nombres como evidencia de éxito. No hacer push a `develop` ni ejecutar Supabase/Docker.

## Corrección propia del revisor y comprobación independiente — Ronda 2 (2026-10-20)

**Fe de erratas:** la versión de este harness publicada en el commit `978963e6` tenía una mutación H02 inválida: `status_REMOVED` conserva el prefijo `/api/push/subscriptions/status`, por lo que `includes()` daba GREEN. El autor detectó el error y **no adulteró el control**. Lo corrijo **yo**, responsable del instrumento, sustituyendo la ruta por `/api/push/subscriptions/disabled`, que no contiene el literal buscado. El informe de ronda 1 permanece inalterado como histórico.

**Revisión sobre el SHA del autor** `b47f2c6d436f199719624d872faeec22f3cdf515` **y sobre el merge commit** `e06cb606651f0c94e4ae00eca12758eb9b2b8b53` (árbol ya reconciliado con `develop@b35b0aef`): se ejecutó independientemente la misma matriz de 7 aserciones estáticas leyendo los cuatro documentos desde GitHub, incluyendo su requisito de pertenencia a `auth.uid()`. Resultado sobre **ambos** SHA: `7/7 GREEN`. En `e06cb606651f0c94e4ae00eca12758eb9b2b8b53`: mutaciones H01/H02/H03/H04/H05 cada una produce `6/7 RED` (solo cae el control objetivo); el control sin mutar vuelve a GREEN. No se editó ningún archivo de producto para realizar las mutaciones.

| Corrida sobre `e06cb606` | Resultado | Aserción roja |
|---|---|---|
| Sin mutación | 7/7 GREEN | ninguna |
| `REVIEW_MUTATION=H01` | 6/7 RED | accepted + cancelled |
| `REVIEW_MUTATION=H02` | 6/7 RED | ruta de verificación backend |
| `REVIEW_MUTATION=H03` | 6/7 RED | union previousStatus |
| `REVIEW_MUTATION=H04` | 6/7 RED | prerequisito T-378 |
| `REVIEW_MUTATION=H05` | 6/7 RED | navegación SPA |

El **harness completo** es el bloque `HARNESS_START` de arriba, ahora corregido. Los comandos de extracción y ejecución ya están en esta misma evidencia. Ningún `pnpm test`, DB ni E2E se ejecutó en el entorno revisor (sin DNS hacia GitHub); la bitácora del autor registra `verify-fichas 7/7` y se diferencia de la evidencia independiente.

**Conflicto de merge resuelto por revisión:** `develop` incorporó T-376/T-377 en `docs/implementation-plan.md` y la PR había agregado T-379..T-383 sobre una base anterior. GitHub devolvía `mergeable_state=dirty`. Se creó un merge commit con **dos padres**, la rama `b47f2c6d436f199719624d872faeec22f3cdf515` y `develop@b35b0aef`, reconstruyendo el árbol desde `develop` y preservando los otros 13 archivos exactos de la PR. Solo se concatenaron las filas T-376/T-377 y T-379..T-383 en el plan. Resultado de GitHub: `mergeable=true`, `behind_by=0`, sin código de aplicación fuera del diff.

**Comprobación pendiente antes de mergear:** consultar resultados del CI asociados al HEAD final posterior al commit documental; `approval-policy` necesita la sección literal de `Informe de revisión de agy` en el cuerpo de la PR. Un comentario no reemplaza esa sección. No se dispara manualmente workflow ni se exige verde extra solo por el informe.
