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
