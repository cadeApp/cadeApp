# Evidencia reproducible — PR #368 / T-354 — Ronda 1

## Hechos verificados por consultas de solo lectura a GitHub
- Pull request `#368`, HEAD de autor `83734650a04cc438ce117772419f2f3a61142083`, 1 archivo modificado: `docs/tasks/log/T-354.md` (+13).
- La bitácora confirma tests RED pendientes y que no hay implementación de copy.
- Comparación con develop: 2 commits delante / 4 detrás en la consulta. Nota: develop es móvil.
- Ficha desde develop: inicialmente no autorizaba `src/features/offers/courier-panel.test.tsx`.
- Luego se registró la decisión explícita (1-A, 2-B, 3-A) en el commit documental `8316ea4f25a5e02b8db1e1c78a0efafb1d96e960`.

**No se corrió ningún comando local de suite ni de mutación** en esta sesión: Git remoto accesible mediante conector de GitHub, pero no hay clon ejecutable con dependencias. No representar estos comandos como resultados obtenidos.

## Cómo reproducir la ausencia de implementación inicial (solo lectura)

```bash
git fetch origin
git diff --name-status 14c28ed3c41cb2bde92705fc018c7dd0df73245b...83734650a04cc438ce117772419f2f3a61142083
git show 83734650a04cc438ce117772419f2f3a61142083:docs/tasks/log/T-354.md
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:src/features/courier-onboarding/copy.ts | grep -F "Selfie de validación"
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:src/features/courier-onboarding/components/status-view.tsx | grep -F "Selfie de seguridad"
```

**Resultado esperado al ejecutar (no ejecutado localmente):** diff solo bitácora y coincidencias de texto viejo.

## Comandos para la próxima ronda, cuando exista implementación (pendientes)

```bash
git fetch origin
git ls-remote origin feat/T-354-unificar-texto-selfie-dni
git diff --name-status origin/develop...origin/feat/T-354-unificar-texto-selfie-dni
git merge-tree --write-tree origin/develop origin/feat/T-354-unificar-texto-selfie-dni
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx src/features/offers/courier-panel.test.tsx src/features/admin/components/applicant-detail-view.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

La próxima revisión debe añadir y **ejecutar** una batería propia de mutaciones RED→GREEN en un worktree temporal limpio sobre el nuevo SHA, guardar aquí el harness completo y comprobar que el control lo detecta. Hoy sería incorrecto inventar una batería «pasada» sobre código que aún no existe. No levantar Docker/Supabase local; si no hay CC servidor, test:db n.a. E2E Preview contra Develop solo si su ejecución está autorizada por el flujo preexistente.


## Ronda 2 — Inspección y mutaciones INDEPENDIENTES (2026-10-15)

Se consultaron 8 archivos de código/test de GitHub, sobre SHA `b94c683756b3f37b3574d6691f95b2557c030416`, y se ejecutaron controles JavaScript puros **en el proceso de consulta conectado a GitHub** (no contra un clon local). Resultado observado: **11/11 reglas de fuente GREEN**; **10/10 mutaciones propias sobre copias in-memory detectadas**. Las dos construcciones prohibidas se confirmaron por lectura directa: `(globalThis as any).React = React` y `describedById!`. La primera comprobación regex se rechecó con igualdad exacta al advertir un escape incorrecto; resultado confirmado.

**Importante:** lo anterior demuestra invariantes *estáticos*, no sustituye los 9 tests Vitest mutados que el autor afirma ni una captura visual. No se ejecutó `pnpm` ni se conectó a Supabase/Vercel desde esta sesión.

### Harness completo para ejecutar en un clon limpio (equivalente a los controles JavaScript ejecutados en memoria)

Copiar el siguiente bloque, entero, a `/tmp/pr368-r2-static.mjs` y ejecutar `node /tmp/pr368-r2-static.mjs` desde la raíz del repositorio en el SHA revisado. No modifica archivos. La traducción a script Node queda reproducible; en esta sesión se comprobó la lógica in-memory sobre los contenidos remotos y **no** se afirma haber ejecutado este archivo concreto en un clon:

```js

// Ronda 2 — ejecutar con node /tmp/pr368-r2-static.mjs desde la raíz de cadeApp.
// NO modifica fuentes: las mutaciones ocurren únicamente sobre copias en memoria.
import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const paths = {
  copy:'src/features/courier-onboarding/copy.ts',
  status:'src/features/courier-onboarding/components/status-view.tsx',
  profile:'src/features/courier-onboarding/components/courier-profile-view.tsx',
  card:'src/features/courier-onboarding/components/document-upload-card.tsx',
  admin:'src/features/admin/copy.ts',
  courierTest:'src/features/courier-onboarding/components.test.tsx',
  adminTest:'src/features/admin/components/applicant-detail-view.test.tsx',
  crossTest:'src/features/offers/courier-panel.test.tsx'
};
const S=Object.fromEntries(Object.entries(paths).map(([k,v])=>[k,fs.readFileSync(path.join(root,v),'utf8')]));
const instruction='Sostené el DNI junto a tu rostro. Ambos deben verse legibles, sin reflejos ni obstrucciones';
const controls=[
['C1-titulo-real',q=>/selfieTitle:\s*'Selfie con el DNI'/.test(q.copy)],
['C2-instruccion',q=>q.copy.includes("'" + instruction + "'")],
['C3-estado',q=>/title:\s*COURIER_ONBOARDING_COPY\.selfieTitle,\s*status:\s*selfieStatus/.test(q.status)],
['C4-perfil',q=>/\{COURIER_ONBOARDING_COPY\.selfieTitle\}/.test(q.profile)],
['C5-admin-detalle',q=>/selfie:\s*'Selfie con el DNI'/.test(q.admin)],
['C6-admin-badge',q=>/selfieBadge:\s*'Selfie con el DNI'/.test(q.admin)],
['C7-file-input',q=>/type="file"\s+aria-label=\{title\}/.test(q.card)],
['C8-multilinea',q=>/status === 'error' \|\| kind === 'selfie'\s*\?\s*'whitespace-normal break-words'/.test(q.card)],
['C9-estado-pending-preservado',q=>/rowOf\(\/Selfie con el DNI\/\)\?\.textContent\)\.toContain\('Pendiente'\)/.test(q.crossTest)],
['C10-descripcion-DOM',q=>q.courierTest.includes('expect(describedNode?.textContent).toBe(instructionText)')],
['C11-admin-DOM',q=>q.adminTest.includes('screen.getByText(/Selfie con el DNI\\s*✓/)')&&q.adminTest.includes("expect(selfieTab?.textContent).toContain('Selfie con el DNI')")]
];
const mutations=[
['M1-titulo','copy',"selfieTitle: 'Selfie con el DNI'","selfieTitle: 'Selfie de validación'",'C1-titulo-real'],
['M2-instruccion','copy',instruction,'Rostro y DNI legibles','C2-instruccion'],
['M3-estado','status','title: COURIER_ONBOARDING_COPY.selfieTitle, status: selfieStatus',"title: 'Selfie de seguridad', status: selfieStatus",'C3-estado'],
['M4-perfil','profile','{COURIER_ONBOARDING_COPY.selfieTitle}','Selfie de identidad','C4-perfil'],
['M5-admin-detalle','admin',"selfie: 'Selfie con el DNI'","selfie: 'Selfie con DNI'",'C5-admin-detalle'],
['M6-admin-badge','admin',"selfieBadge: 'Selfie con el DNI'","selfieBadge: 'Selfie'",'C6-admin-badge'],
['M7-input','card','aria-label={title}','aria-label="Selfie"','C7-file-input'],
['M8-multilinea','card',"? 'whitespace-normal break-words'","? 'truncate'",'C8-multilinea'],
['M9-pending','crossTest',"expect(rowOf(/Selfie con el DNI/)?.textContent).toContain('Pendiente');","expect(rowOf(/Selfie con el DNI/)?.textContent).toBeDefined();",'C9-estado-pending-preservado'],
['M10-descripcion','courierTest','expect(describedNode?.textContent).toBe(instructionText);','expect(describedNode).not.toBeNull();','C10-descripcion-DOM']
];
const failed=[];
for (const [id,fn] of controls){if(!fn(S))failed.push('BASE '+id);}
let detected=0;
for (const [id,key,from,to,expected] of mutations){
  if(!S[key].includes(from)){failed.push('OBJETIVO AUSENTE '+id);continue;}
  const q={...S,[key]:S[key].replace(from,to)};
  const rule=controls.find(x=>x[0]===expected)?.[1];
  if(!rule || rule(q)){failed.push('CONTROL CIEGO '+id);}else{detected++;}
}
const forbidden=[
["any-global",/\(globalThis as any\)\.React = React;/.test(S.adminTest)],
["non-null-DOM",/getElementById\(describedById!\)/.test(S.courierTest)]
];
console.log('Baselines',controls.length-failed.filter(x=>x.startsWith('BASE')).length,'/',controls.length);
console.log('Mutaciones detectadas',detected,'/',mutations.length);
console.log('Prohibiciones actuales',forbidden);
for(const f of failed)console.error(f);
if(failed.length)process.exitCode=1;

```

### Tests originales y validación siguiente (no ejecutados por esta revisión)

```bash
git fetch origin
git merge-tree --write-tree origin/develop origin/feat/T-354-unificar-texto-selfie-dni
pnpm exec vitest run src/features/courier-onboarding/components.test.tsx src/features/offers/courier-panel.test.tsx src/features/admin/components/applicant-detail-view.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
```

### CI leído del mismo SHA

- `unit`: log con `Test Files 130 passed (130)` y `Tests 2172 passed (2172)` (job 116265009597).
- `lint`: `✔ No ESLint warnings or errors` (job 116265009279); su subpaso `format:check` dio warnings y no bloqueó. No representa violación grave de esta PR en sí.
- `typecheck`, `build`, `audit`, `bundle-budget`: success a la consulta; `db-tests`: in_progress, `approval-policy`: failure (falta informe en body); E2E Preview: sin corrida asociada verificada.

### Reproducción pendientísima de autor

Los 9 RED de KiraK72 están únicamente **declarados como sumarios** en bitácora. Falta harness con mutaciones en código real + salidas RED reales de Vitest para reproducirlos sin confiar en el autor. Ronda siguiente deberá ejecutar sus controles originales (GREEN) y mutarlos independientemente (RED), no inventar el resultado. Ver H02.
