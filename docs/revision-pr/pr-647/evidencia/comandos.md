# Evidencia y comandos — PR #647 / T-406, ronda 1

**SHA estudiado:** `abf3f63873f4c8a9a1288d604735c7689708b0de`. Acceso GitHub por conector, sin checkout local. Las lecturas de código descriptas fueron inspección; **no se ejecutaron las pruebas de mutación ni el E2E en esta sesión**.

## H01 — Comprobación estructural reproducible

Desde la raíz de un clon limpio con el commit revisado disponible (`git fetch origin`): el script completo se crea en `/tmp` y se ejecuta desde la raíz del repositorio. No lee secretos ni `.env`.

```bash
cat > /tmp/pr647-h01-inspect.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const sha = 'abf3f63873f4c8a9a1288d604735c7689708b0de';
const show = (path, revision = sha) => execFileSync('git', ['show', revision + ':' + path], { encoding: 'utf8' });
const spec = show('e2e/specs/incidents.spec.ts');
const seed = show('src/server/e2e/staging-seed.ts');
const action = show('src/features/admin/actions.ts');

const scenario = spec.slice(spec.indexOf("test('T-406:"));
const helper = spec.slice(spec.indexOf('async function openAdminPageWithMfa'), spec.indexOf('test.describe('));
const elevate = seed.slice(seed.indexOf('export async function elevateAdminToAal2'), seed.indexOf('export interface SeedRequestInStateOptions'));
const verify = action.slice(action.indexOf('export async function verifyAdminMfaAction'), action.indexOf('export async function viewCourierDocumentAction'));

assert(scenario.includes('await elevateAdminToAal2(adminApi, adminCredentials)'), 'el escenario debe elevar adminApi');
assert(scenario.includes('await openAdminPageWithMfa(page, adminCredentials)'), 'el escenario llama al helper sin reutilizar factor');
assert(elevate.includes('client.auth.mfa.enroll'), 'la elevación enrola el primer factor');
assert(helper.includes('adminClient.auth.mfa.enroll'), 'el helper enrola otro factor');
assert(verify.includes('factors.totp?.[0]'), 'la acción elige el primer factor verificado');

// Caso adversarial modelado, NO ejecución contra el backend:
const factors = [{id: 'F1'}, {id: 'F2'}];
const loginSelects = factors[0];
assert.notEqual(loginSelects.id, 'F2');
console.log('ANÁLISIS CONFIRMADO: dos enrolamientos; el login puede elegir F1 mientras el código pertenece a F2.');
console.log('NOTA: esta comprobación estructural no sustituye un E2E ni una prueba RED.');
NODE
node /tmp/pr647-h01-inspect.mjs
```

**Estado:** no ejecutado por el revisor (sin acceso de clon); la conclusión surge de la inspección manual de las mismas funciones.

### Mutación RED a exigir en la próxima entrega (la batería de aceptación la define el revisor)

Después de implementar la reutilización de factor único, instrumentar **un test real** que afirme que el login con MFA reutiliza el factor preexistente y no crea otro (`listFactors().totp` contiene exactamente el `factorId` esperado). Como mutación local temporal, reinsertar la rama antigua que llama `auth.mfa.enroll({ factorType: 'totp' })` aun cuando se entrega `{ factorId, totpSecret }`: el test debe fallar. Registrar las líneas reales `Tests ...` / Playwright `failed ...` en rojo y verde. Restaurar la mutación en memoria, **no** usar `git checkout` para mutaciones. No crear tests falsos ni alterar expectations para conseguir verde.

### Controles del autor pendientes de contraste

- Bitácora declara RED 28 fallos en develop y GREEN 248; no repetidos por esta revisión.
- Bitácora declara mutación `resolved: ['resolved','dismissed']` → 4 fallos; no repetida.
- CI general `abf3f638` concluyó `success`, pero no confirma el nuevo flujo E2E.

## D01=C — Matriz de pruebas y mutaciones para el siguiente SHA

- `GET /api/live/admin/incidents/open-count` solo entrega `{count}`, con `Cache-Control: no-store`. `getServerSession() === null` => 401, rol no admin o AAL1 => 403, error de base => 500 sin detalles.
- El conteo SQL usa **ambos** estados `open` y `reviewing`, no `resolved` ni `dismissed`; nunca traer filas.
- `useQuery`: inicial desde layout, `refetchInterval=60000`, `refetchIntervalInBackground=false`, `refetchOnWindowFocus='always'`; detener consultas mientras `document.visibilityState='hidden'` y refrescar tras `visible`.
- Mutaciones independientes que deben matar las pruebas: eliminar el control AAL2 (403→200), cambiar filtro `open+reviewing` a solo `open`, quitar el refetch al recuperar foco, quitar pausa oculta y devolver `0` en error. Registrar RED/GREEN por mutación, no solo una suite final verde.
- Confirmar badge accesible en barra expandida/contraída y navegación móvil, con 0, con error y con números positivos. No afirmar E2E nuevo hasta recibir el estado del gate de ese SHA.

## Checklist de cierre (ejecutar tras arreglos, en worktree limpio del SHA de implementación)

```bash
git fetch origin
git status --short
git diff origin/develop -- docs/tasks/T-406.md
git merge-tree --write-tree origin/develop HEAD
pnpm typecheck
pnpm lint
pnpm test
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

`pnpm test:db` solo si la implementación termina tocando `src/server/**` o `supabase/**`; no levantar Docker/Supabase local desde la revisión. `e2e-preview` se verifica por el gate trusted de GitHub, con SHA exacto. **No ejecutar mutaciones contra Supabase remoto ni disparar workflows manualmente.**

---

## Ronda 2 — fuente, SHA y controles independientes (2026-11-06)

**SHA de aplicación:** `4fce771d774ccf5837992e228d46f6de4322f6f1` · base `4ae5404ee14651d00ad0c9286f250ba6c5441c49`.

### Fuentes oficiales leídas por el revisor

- CI general: https://github.com/cadeApp/cadeApp/actions/runs/42302308824 — 7 jobs success, unit `Test Files 198 passed (198)` y `Tests 3735 passed (3735)`.
- Gate E2E: https://github.com/cadeApp/cadeApp/actions/runs/42303370007/job/128186588966 — `actions/checkout` ref exacto `4fce771d...`, `✓ incidents.spec.ts:372` T-406, los 4 tests anteriores T-308 ✓; `120 passed`, `1 flaky`, `2 failed`.
- Reproducción audit: mismo blob GitHub develop/PR `98402507ea8a1c92d9559f562538d9003f25a77f`. `admin-audit-filters.spec.ts:108` obtiene dos elementos; 3/3 fallos. Reabierto #636.
- Reproducción courier: mismo blob develop/PR `b5661e89b37db59ff7447fb7fd8c55dab27b53a1`; `courier-onboarding.spec.ts:1177` sin `Rechazado / requiere corrección`, 3/3. Issue #653. Relación con T-419 es hipótesis, verificar `vehicle_id`.
- `approval-policy` rojo original https://github.com/cadeApp/cadeApp/actions/runs/42302305442 → informe añadido al body por el revisor, check verde https://github.com/cadeApp/cadeApp/actions/runs/42309455413.

### Probes estructurales independientes realizados sobre contenido GitHub, NO runtime

Se evaluaron en una ejecución separada del orquestador sobre el SHA exacto: `H01_factor_enrolled_once`, `H01_same_client_returned`, `H01_no_double_elevate`, `D01_auth_before_query`, `D01_status_head_count`, `D01_polling`, `D01_initial_data`, `D01_badge_sibling_link`: **8/8 análisis estáticos satisfactorios**. Cuatro mutaciones de cadena en memoria (reintroducir elevación, quitar AAL2, habilitar background, deshabilitar foco) se detectaron estructuralmente: **4/4**. Esto **NO** es evidencia RED de Vitest ni Playwright; no se cambió ningún archivo del repositorio.

### Script reproducible en un checkout que contenga el commit de implementación

El script lee el contenido **del SHA declarado** vía `git show`, no del head documental posterior. Se entrega el harness completo, pero **no se ejecutó desde un clon en esta sesión**; los 8 probes equivalentes sí se ejecutaron contra el contenido leído por GitHub.

```bash
cat > /tmp/pr647-round2-probes.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const sha = '4fce771d774ccf5837992e228d46f6de4322f6f1';
const show = (p) => execFileSync('git', ['show', `${sha}:${p}`], { encoding: 'utf8' });
const e = show('e2e/specs/incidents.spec.ts');
const r = show('src/app/api/live/open-incidents/route.ts');
const n = show('src/app/(admin)/admin-nav.tsx');
const q = show('src/features/incidents/queries.ts');
const s = show('src/features/incidents/schemas.ts');
const helper = e.split('async function openAdminPageWithMfa(')[1].split('\n}\n')[0];
const scenario = e.split("test('T-406:")[1];
const count = (v, part) => v.split(part).length - 1;

function verify(spec=e,route=r,nav=n,query=q,schema=s) {
  const h = spec.split('async function openAdminPageWithMfa(')[1].split('\n}\n')[0];
  const t = spec.split("test('T-406:")[1];
  assert.equal(count(h, '.auth.mfa.enroll('), 1, 'H01: solo un enrolamiento');
  assert(t.includes('adminApi.rpc('), 'H01: el RPC usa adminApi');
  assert(!t.includes('elevateAdminToAal2('), 'H01: sin doble elevación');
  assert(h.includes('adminApi: adminClient'), 'H01: se devuelve el cliente AAL2');
  assert(route.includes("session.role !== 'admin' || session.aal !== 'aal2'"), 'D01: requiere admin+AAL2');
  assert(route.indexOf('getServerSession()') < route.indexOf('await getOpenIncidentsCount()'), 'D01: auth antes de consulta');
  assert(query.includes('head: true') && query.includes('INCIDENT_TAB_STATUSES[tab]'), 'D01: conteo canónico');
  assert(schema.includes("'reviewing'"), 'D01: incluye reviewing');
  assert(nav.includes('60_000') && nav.includes('refetchIntervalInBackground: false'), 'D01: polling visible');
  assert(nav.includes("refetchOnWindowFocus: 'always'"), 'D01: refetch al foco');
  assert(nav.includes('initial !== null ? { initialData: initial'), 'D01: cero es dato válido');
  assert(nav.includes('aria-label={ADMIN_COPY.nav.openIncidents(badge)}'), 'D01: texto accesible');
}
verify();
const badVersions = [
  () => verify(e.replace('const { adminPage, adminApi } = await openAdminPageWithMfa(page, adminCredentials);', 'const { adminPage, adminApi } = await openAdminPageWithMfa(page, adminCredentials); await elevateAdminToAal2(adminApi, adminCredentials);')),
  () => verify(e, r.replace("session.aal !== 'aal2'", 'false')),
  () => verify(e, r, n.replace('refetchIntervalInBackground: false', 'refetchIntervalInBackground: true')),
  () => verify(e, r, n.replace("refetchOnWindowFocus: 'always'", 'refetchOnWindowFocus: false')),
];
for (const bad of badVersions) assert.throws(bad, assert.AssertionError, 'mutación estructural debe detectarse');
console.log('OK: H01 y D01, probes estáticos; mutaciones estructurales detectadas 4/4. NO es RED Vitest ni E2E.');
NODE
node /tmp/pr647-round2-probes.mjs
```

### Comandos que quedarán pendientes tras integrar correcciones externas

```bash
git fetch origin
git status --short
git merge-tree --write-tree origin/develop HEAD
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

**No ejecutado localmente en ronda 2** por ausencia de checkout/pnpm; tampoco se leyó `.env*` ni se corrieron servicios remotos. `e2e-preview` solo se considera completo GREEN cuando el gate trusted oficial de la integración corregida lo indique. No exigir un nuevo green por un commit que únicamente toque `docs/revision-pr/pr-647`.
