# Evidencia y comandos reproducibles — PR #584, Ronda 1

**SHA auditado:** 2337c2a71f3bdfaa12aa782ca2269546926444a1.
**Método real:** lectura de archivos por GitHub y mutaciones independientes en memoria (sin tocar la rama). NO se ejecutó Playwright ni CI en esta sesión.

## Inventario de controles y observación

- AdminNav: header en lg:hidden; aside en lg:flex, lg:w-64; layout main en flex-1: cuatro controles estructurales GREEN.
- Mutaciones independientes: lg:hidden→md:hidden, lg:flex→md:flex, lg:w-64→lg:w-48, flex-1→flex-none: cuatro controles respectivos RED.
- Spec E2E: width: 390 presente; 1023, 1024 y 1280 ausentes.
- Este resultado demuestra únicamente la sensibilidad de los controles estructurales a cambios de clase, NO la sensibilidad del E2E. No se presenta como E2E RED→GREEN.

## Harness completo independiente (Node; trabaja solo en memoria)

Se puede copiar el bloque desde el directorio raíz del repo, a un archivo en /tmp. Usa solo Node y no modifica ningún archivo:

    cat > /tmp/pr584-r1-estructura.mjs <<'NODE'
    import fs from 'node:fs';
    import path from 'node:path';
    const root = process.env.REPO_PATH || process.cwd();
    const nav = fs.readFileSync(path.join(root, 'src/app/(admin)/admin-nav.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(root, 'src/app/(admin)/layout.tsx'), 'utf8');
    const spec = fs.readFileSync(path.join(root, 'e2e/specs/admin-nav-mobile.spec.ts'), 'utf8');
    function check(n, l) {
      const aside = n.match(/<aside className="([^"]+)"/)?.[1] || '';
      const header = n.match(/<header className="([^"]+)"/)?.[1] || '';
      const main = l.match(/<main className="([^"]+)"/)?.[1] || '';
      const has = (s, cls) => s.split(/\s+/).includes(cls);
      return {
        headerLG: has(header, 'lg:hidden'),
        sidebarLG: has(aside, 'lg:flex'),
        sidebarWidth: has(aside, 'lg:w-64'),
        mainFlex: has(main, 'flex-1')
      };
    }
    const baseline = check(nav, layout);
    if (!Object.values(baseline).every(Boolean)) throw new Error('Control sin mutar NO está verde');
    console.log('CONTROL GREEN 4/4');
    const mutants = [
      ['header desde md', 'lg:hidden', 'md:hidden', 'nav', 'headerLG'],
      ['sidebar desde md', 'lg:flex', 'md:flex', 'nav', 'sidebarLG'],
      ['sidebar angosta', 'lg:w-64', 'lg:w-48', 'nav', 'sidebarWidth'],
      ['main sin flex', 'flex-1', 'flex-none', 'layout', 'mainFlex']
    ];
    let red = 0;
    for (const [label, from, to, target, property] of mutants) {
      const source = target === 'nav' ? nav : layout;
      if (!source.includes(from)) throw new Error('Sin objetivo: ' + label);
      const changed = source.replace(from, to);
      const result = check(target === 'nav' ? changed : nav, target === 'layout' ? changed : layout);
      if (result[property] === false && Object.keys(result).every(k => k === property || result[k])) {
        red++;
        console.log('RED confirmado: ' + label);
      } else throw new Error('Mutante no detectado: ' + label);
    }
    if (red !== mutants.length) throw new Error('Mutación incompleta');
    console.log('MUTANTES RED ' + red + '/' + mutants.length);
    console.log('VIEWPORTS mencionados en spec:', JSON.stringify({
      390: spec.includes('width: 390'),
      1023: spec.includes('1023'),
      1024: spec.includes('1024'),
      1280: spec.includes('1280')
    }));
    NODE
    node /tmp/pr584-r1-estructura.mjs

Salida equivalente comprobada de manera independiente contra el SHA auditado:

    CONTROL GREEN 4/4
    RED confirmado: header desde md
    RED confirmado: sidebar desde md
    RED confirmado: sidebar angosta
    RED confirmado: main sin flex
    MUTANTES RED 4/4
    VIEWPORTS mencionados en spec: {"390":true,"1023":false,"1024":false,"1280":false}

El último chequeo de texto es una señal de inventario, NO una aserción funcional. No alcanza con agregar las cadenas de los números en comentarios o expectativas falsas.

## E2E real que debe acompañar el arreglo H01 (aún NO ejecutado por revisión)

Con entorno autorizado de aplicación contra Supabase Develop, las variables de proceso y el servidor del Preview configurados sin leer/escribir secretos:

    pnpm exec playwright test e2e/specs/admin-nav-mobile.spec.ts --project=chromium --workers=1 --retries=0

El nuevo test tiene que validar 1023, 1024 y 1280 con aserciones reales sobre DOM visible, enlaces, nombre y Salir y getBoundingClientRect del main. En especial a 1023 px debe haber Menú y NO sidebar; a 1024 px, sidebar y NO Menú; ancho del main 768 px; a 1280 px ancho del main 1024 px. La tolerancia de píxeles admite ±1 por redondeo.

Para probar RED de lg:hidden→md:hidden se requiere **build local del código mutado** (aplicación servida desde loopback y test apuntando a ella), no reutilizar PLAYWRIGHT_TEST_BASE_URL de un Preview Vercel sin mutar. El autor debe guardar el texto de fuente en memoria, mutarlo temporalmente, ejecutar en local, registrar fallo por expectativa, restaurar en finally y volver a ejecutar GREEN. No poner el mutante en la rama compartida, no crear test falso, no adulterar aserciones, no usar mocks que eviten la UI de producción. No se ejecutan comandos contra Supabase remoto administrativo ni se levanta Docker o Supabase local.

## Validaciones pendientes cuando el cambio esté pusheado

    git fetch origin
    git ls-remote origin refs/heads/feat/T-402-admin-shell
    git diff origin/develop...origin/feat/T-402-admin-shell --stat
    pnpm typecheck > /tmp/pr584-typecheck.log 2>&1
    pnpm lint > /tmp/pr584-lint.log 2>&1
    pnpm test > /tmp/pr584-test.log 2>&1
    pnpm exec playwright test e2e/specs/admin-nav-mobile.spec.ts --project=chromium --workers=1 --retries=0 > /tmp/pr584-e2e.log 2>&1
    node docs/revision-pr/analizar.mjs verificacion

Los comandos se ejecutan sobre worktree limpio del SHA que se quiere verificar. Los resultados locales, CI y E2E que aún no se hayan corrido no se anotan como verdes. En ronda 2 debe leerse el log del CI oficial del SHA de código, no solo el icono de estado.


---

# Ronda 2 — SHA 43c4f0d8b54f0a9bff18a6fef4af04460d73a325

Se verificó por GitHub que el autor solo modificó spec E2E (+59) y bitácora (+28). En lectura de source, las 7 rutas de SECTIONS coinciden con ADMIN_NAV_TABS, 12/12 controles estructurales correctos y 5/5 mutantes de **guardas textuales** detectados. Este control no sustituye a una ejecución real de Playwright.

## Harness completo (sin escribir el repo)

Copiar desde la raíz del worktree del SHA a un script temporal; el programa usa Node integrado y no lee .env:

    cat >/tmp/pr584-r2.mjs <<'NODE'
    import {readFileSync} from 'node:fs';
    import {join} from 'node:path';
    const root=process.env.REPO_PATH || process.cwd();
    const read=p=>readFileSync(join(root,p),'utf8');
    const s=read('e2e/specs/admin-nav-mobile.spec.ts');
    const n=read('src/app/(admin)/admin-nav.tsx');
    const l=read('src/app/(admin)/layout.tsx');
    const c=read('src/features/admin/constants.ts');
    const sections=[...s.matchAll(/\{ label: '([^']+)', path: '([^']+)' \}/g)].map(x=>x[2]);
    const routes=[...c.matchAll(/href: '(\/admin\/[^']+)'/g)].map(x=>x[1]);
    if(sections.length!==7 || JSON.stringify(sections)!==JSON.stringify(routes)) throw Error('rutas incompletas');
    function guards(t) {
      return {
        mobile:t.includes('viewport: { width: 390, height: 844 }') && t.includes('for (const section of SECTIONS)'),
        widths:t.includes('for (const width of [1023, 1024, 1280])'),
        breakpoint:t.includes('if (width < 1024)'),
        bounds:t.includes("page.locator('main').boundingBox()") && t.includes('expectNear(main.x, 0') && t.includes('expectNear(main.width, width'),
        desktopBounds:t.includes('expectNear(main.x, SIDEBAR_WIDTH') && t.includes('expectNear(main.width, width - SIDEBAR_WIDTH'),
        headerVisible:t.includes('admin.menuButton') && t.includes('toBeVisible();'),
        sidebarHidden:t.includes('admin.sidebarNav') && t.includes('toBeHidden();'),
        sidebarVisible:t.includes('admin.sidebarNav') && t.includes('toBeVisible();'),
        sevenLinks:t.includes('toHaveCount(SECTIONS.length)') && t.includes('toHaveText(section.label)'),
        href:t.includes("toHaveAttribute('href', section.path)"),
        icons:t.includes('svg[aria-hidden="true"]'),
        operator:t.includes('getByText(operatorName, { exact: true })') && t.includes("getByRole('button', { name: 'Salir' })")
      };
    }
    const checks=guards(s);
    if(!Object.values(checks).every(Boolean) || !(n.includes('lg:hidden') && n.includes('lg:flex') && n.includes('lg:w-64') && l.includes('min-w-0 flex-1'))) throw Error('CONTROL ROJO');
    console.log('CONTROL GREEN 12/12; rutas 7/7');
    const mutations=[
      ['umbral','if (width < 1024)','if (width < 768)','breakpoint'],
      ['ancho main','expectNear(main.width, width - SIDEBAR_WIDTH','expectNear(main.width, width + SIDEBAR_WIDTH','desktopBounds'],
      ['icono','svg[aria-hidden="true"]','svg','icons'],
      ['href',"toHaveAttribute('href', section.path)","toHaveAttribute('target', section.path)",'href'],
      ['rutas','for (const width of [1023, 1024, 1280])','for (const width of [390])','widths']
    ];
    let red=0;
    for(const [name,before,after,key] of mutations){
      if(!s.includes(before)) throw Error('SIN OBJETIVO '+name);
      if(guards(s.replace(before,after))[key]) throw Error('MUTANTE SOBREVIVIÓ '+name);
      console.log('GUARDA RED '+name);red++;
    }
    console.log('MUTANTES ESTÁTICOS RED '+red+'/'+mutations.length);
    NODE
    node /tmp/pr584-r2.mjs

Aserciones efectivamente vistas por lectura: 390; 1023,1024,1280; \`toBeVisible\` y \`toBeHidden\` en roles correctos, geometry, siete href, iconos, operador y Salir. Mutantes del guard: umbral 1024→768, ancho, ícono, href, anchos de prueba. **Esta batería es distinta de la del autor, pero deliberadamente no reclama verificación E2E.**

## RED declarados por el autor: no reproducidos por el revisor

Bitácora: control Preview 1 passed; (1) \`lg:hidden→md:hidden\` hace fallar Menú a 1023; (2) \`lg:flex→md:flex\` hace visible la barra a 1023; (3) \`lg:w-64→lg:w-48\` desplaza \`main.x\` 256→192; (4) \`flex-1→flex-none\` da \`main.width=1896.9\` frente a 768. Son modificaciones CSS inyectadas en DOM, no un TSX mutado compilado. El script temporal exacto no quedó guardado. No se inventan logs de ejecución.

## Pendiente cuando H02 quede adjunto

    git fetch origin
    git ls-remote origin feat/T-402-admin-shell
    node docs/revision-pr/analizar.mjs verificacion
    pnpm typecheck > /tmp/pr584-typecheck.log 2>&1
    pnpm lint > /tmp/pr584-lint.log 2>&1
    pnpm test > /tmp/pr584-test.log 2>&1
    pnpm exec playwright test e2e/specs/admin-nav-mobile.spec.ts --project=chromium --workers=1 --retries=0 > /tmp/pr584-e2e.log 2>&1

Usar worktree limpio, entorno autorizado Develop y jamás claves en logs. CI/e2e se coteja con SHA de código, no se requiere repetirlo por este commit documental.


---

# Ronda 3 — evidencia de capturas, CI exact-SHA y conflicto

## Verificación independiente y fuentes

- SHA inspeccionado de capturas: `c4eba54c8e3d0b1936b5de9d0ca12dfab91c2c34`; carpeta `docs/tasks/log/T-402-capturas/` con 15 archivos.
- Los 15 PNG se inspeccionaron visualmente desde GitHub (7 escritorio 1280×800, 8 móvil 390×844). No se observó información personal real ni valores DNI/hash. La ficha confirma que las capturas son datos de E2E; inspección propia corrobora apariencia.
- Comparación de commits `4a265745..c4eba54c`: solo 15 PNG, `docs/tasks/T-402.md` y `docs/tasks/log/T-402.md`.
- CI [41742808125](https://github.com/cadeApp/cadeApp/actions/runs/41742808125): jobs typecheck/lint/unit/build/audit/db-tests/bundle-budget success. Unit [job 126288272508](https://github.com/cadeApp/cadeApp/actions/runs/41742808125/job/126288272508): 189 Test Files, 3459 Tests passed. DB [job 126288272114](https://github.com/cadeApp/cadeApp/actions/runs/41742808125/job/126288272114): Files=40, Tests=3252, Result PASS, comparación db types.
- Gate E2E [41742929749, job 126288767541](https://github.com/cadeApp/cadeApp/actions/runs/41742929749/job/126288767541): workflow repository_dispatch tiene `head_sha=2ed5ef`, pero job hace `git fetch` + checkout exacto de **4a265745**; `admin-nav-mobile.spec.ts:72` y `:109` pasaron sin retries; summary chromium 113 passed, 1 flaky admin-trips (dos fallos, éxito en retry #2); global-settings 6 passed.
- QA [issue #585](https://github.com/cadeApp/cadeApp/issues/585): primer fallo de admin-trips `getByText('Entrega 1 entregada')` resuelve a dos nodos (strict mode); retry #1 timeout esperando `filter=all`; retry #2 verde. No atribuir a cambios T-402.
- Bundle advisory: /admin/applicants =263 kB tanto en base `2ed5ef` como en `4a265745`; /admin/trips=157; /admin/incidents=174; /merchant/dashboard=292; /courier/feed=263. Delta observado 0 kB.
- Integración: [GitHub PR #584](https://api.github.com/repos/cadeApp/cadeApp/pulls/584) devuelve `mergeable_state=dirty` en `c4eba54c`; develop avanzó a `ceec11ef`. El diff de develop añade cambios T-401 a `src/features/admin/{copy,queries,queries.test}.ts`. No se ejecutó git merge-tree en contenedor.

## Harness completo para comprobar en un worktree limpio las 15 capturas (no lee .env)

Crear archivo temporal en /tmp y ejecutarlo desde la raíz del repositorio, usando la biblioteca estándar Python; el script no escribe en el repo:

```bash
cat >/tmp/pr584-r3-png.py <<'PY'
from pathlib import Path
import struct
root = Path.cwd() / "docs/tasks/log/T-402-capturas"
sections = ("announcements", "applicants", "audit", "incidents", "merchants", "settings", "trips")
expected = {f"t402-1280-{part}.png": (1280, 800) for part in sections}
expected.update({f"t402-390-{part}.png": (390, 844) for part in sections})
expected["t402-390-menu-abierto.png"] = (390, 844)
present = {f.name for f in root.glob("*.png")}
assert present == set(expected), f"Faltantes: {set(expected)-present}; extras: {present-set(expected)}"
for name, dim in expected.items():
    data = (root / name).read_bytes()
    assert data[:8] == b"\x89PNG\r\n\x1a\n", f"Firma PNG inválida: {name}"
    width, height = struct.unpack(">II", data[16:24])
    assert (width, height) == dim, f"Dimensiones inesperadas: {name} {(width, height)}"
    assert len(data) > 100, f"Imagen vacía: {name}"
print("PNG 15/15, dimensiones 7×1280×800 y 8×390×844, OK")
PY
python3 /tmp/pr584-r3-png.py
```

**Ejecución equivalente de verificación:** los bytes PNG se consultaron a través de GitHub, se inspeccionó la cabecera IHDR de cada imagen y se abrió cada PNG para revisión visual. El harness de Python anterior es reproducible para inspección local; no se lo presenta como una ejecución Python hecha en este entorno.

## Comandos de integración solicitados al agy

```bash
git fetch origin
git checkout feat/T-402-admin-shell
git pull --ff-only origin feat/T-402-admin-shell
git merge origin/develop    # merge, NUNCA rebase
# Resolver solo conflictos; conservar T-401 y T-402
pnpm exec vitest run src/features/admin/queries.test.ts src/app/\(admin\)/admin-nav.test.tsx
pnpm typecheck > /tmp/t402-typecheck.log 2>&1
pnpm lint > /tmp/t402-lint.log 2>&1
pnpm test > /tmp/t402-test.log 2>&1
pnpm exec vitest run tools/verify-fichas.test.ts > /tmp/t402-fichas.log 2>&1
git merge-tree --write-tree origin/develop HEAD
git status --short
# Una vez verificada la integración y sin archivos indebidos:
git push origin feat/T-402-admin-shell
git ls-remote origin refs/heads/feat/T-402-admin-shell
```

Los E2E Preview/CI deben ejecutarse por la infraestructura normal al nuevo SHA después del merge; no disparar workflows manualmente ni usar credenciales remotas privadas. Mantener los logs largos en /tmp y reportar solo sumarios.


---

# Ronda 4 — merge T-401 + T-402: revisión independiente

**SHA de código:** `e15734e5ed48ad275083ff6d6224fe44d3465513`.  
**Merge commit:** `8ef49640645af3e51619e957e2fba0b42b5ea3b3` con padres `29c8a61b` (T-402) y `ceec11ef` (develop con T-401).

## Verificado por el revisor

- GitHub API: base develop `ceec11ef`; PR mergeable=true, 10 commits ahead / 0 behind. El último commit del autor posterior al merge solo agrega la bitácora.
- Barrido de consultas, pruebas, copy, nav y E2E en el SHA real: **14/14** guardas GREEN, **8/8** mutantes independientes estáticos RED por el atributo esperado. No ejecutar consultas remotas. No se atribuyen estos resultados a Vitest.
- CI de SHA exacto [run 41754008650](https://github.com/cadeApp/cadeApp/actions/runs/41754008650): `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` success. `unit` (job 126326131930): `Test Files 189 passed`, `Tests 3467 passed`. `db-tests` pendiente al redactar. Vercel deployment success y `e2e-preview=pending` [run 41754128185](https://github.com/cadeApp/cadeApp/actions/runs/41754128185).
- El autor declara 3 casos E2E locales en Preview del SHA de merge: no se contabilizan como independientes. El gate anterior de E2E se verificó en ronda 3 sobre `4a265745`, pero no acredita el merge.

## Harness reproducible, propio, mutaciones en memoria (Node integrado)

Desde un worktree limpio de `e15734e5` ejecutar lo siguiente. El script no modifica archivos ni requiere .env ni pnpm:

~~~bash
cat >/tmp/pr584-r4-integration.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.env.REPO_PATH || process.cwd();
const read = p => readFileSync(join(root,p),'utf8');
const q = read('src/features/admin/queries.ts');
const qt = read('src/features/admin/queries.test.ts');
const c = read('src/features/admin/copy.ts');
const nav = read('src/app/(admin)/admin-nav.tsx');
const e2e = read('e2e/specs/admin-nav-mobile.spec.ts');

function guards(q,qt,c,nav,e2e) {
  return {
    t401BooleanTwice: (q.match(/hasDni:\s*Boolean\(c\.dni_hmac\)/g)||[]).length===2,
    t401NoDniHash: !q.includes('dniHash')&&!c.includes('dniHash'),
    t401MerchantFallback: q.includes('merchantDisplayName(row.business_name)')&&q.includes('signupIncomplete: !row.business_name.trim()'),
    t401CreditHeader: q.includes('businessName: merchantDisplayName(data.business_name)'),
    t401UnitTests: qt.includes("describe('T-401: el hash del DNI no viaja al cliente'")&&qt.includes("not.toHaveProperty('dniHash')")&&qt.includes('expect(JSON.stringify(items)).not.toContain('),
    t401MerchantTests: qt.includes("describe('T-401: comercio con el alta sin completar'")&&qt.includes('getAdminMerchantHeader(MERCHANT_A)')&&qt.includes('signupIncomplete'),
    t402Session: q.includes('export async function getAdminOperatorName()')&&q.includes('await supabase.auth.getUser()')&&q.includes(".select('display_name')")&&q.includes(".eq('id', user.id)"),
    t402Fallback: q.includes('data?.display_name?.trim() || ADMIN_COPY.audit.unnamedOperator'),
    t402Tests: qt.includes("describe('T-402: getAdminOperatorName")&&qt.includes('createAdminClient).not.toHaveBeenCalled()')&&qt.includes("resolves.toBe('Operador sin nombre')"),
    t402Copy: c.includes("menuButton: 'Menú'")&&c.includes("menuTitle: 'Secciones del panel'"),
    t402Viewport: e2e.includes('[1023, 1024, 1280]')&&e2e.includes('width: 390'),
    t402Nav: nav.includes('lg:hidden')&&nav.includes('lg:flex')&&nav.includes('lg:w-64'),
    bothImports: qt.includes('getAdminOperatorName,')&&qt.includes('getAdminMerchantHeader,'),
    noConflictMarkers: !(/^(<<<<<<<|=======|>>>>>>>)/m).test(q+'\n'+qt+'\n'+c)
  };
}
const original = guards(q,qt,c,nav,e2e);
if (!Object.values(original).every(Boolean)) throw Error('CONTROL RED: '+JSON.stringify(original));
console.log('CONTROL GREEN 14/14');
const mutationList = [
  ['hasDni boolean alterado','q','hasDni: Boolean(c.dni_hmac)','hasDni: true','t401BooleanTwice'],
  ['hash DNI expuesto','q','hasDni: Boolean(c.dni_hmac)','dniHash: c.dni_hmac','t401NoDniHash'],
  ['fallback crédito suprimido','q','merchantDisplayName(data.business_name)','data.business_name','t401CreditHeader'],
  ['getUser sustituido','q','await supabase.auth.getUser()','await supabase.auth.getSession()','t402Session'],
  ['fallback operador eliminado','q',"data?.display_name?.trim() || ADMIN_COPY.audit.unnamedOperator","data?.display_name?.trim() || ''",'t402Fallback'],
  ['suite privacidad T-401 suprimida','qt',"describe('T-401: el hash del DNI no viaja al cliente'","describe('T-XXX: el hash del DNI no viaja al cliente'",'t401UnitTests'],
  ['suite operador T-402 suprimida','qt',"describe('T-402: getAdminOperatorName","describe('T-XXX: getAdminOperatorName",'t402Tests'],
  ['label Menú removida','c',"menuButton: 'Menú'","menuButton: ''",'t402Copy']
];
for(const [name,file,from,to,key] of mutationList) {
  const source={q,qt,c,nav,e2e},old=source[file];
  source[file]=old.replace(from,to);
  if (source[file]===old) throw Error('SIN OBJETIVO: '+name);
  if (guards(source.q,source.qt,source.c,source.nav,source.e2e)[key]) throw Error('MUTANTE SOBREVIVIÓ: '+name);
  console.log('GUARDA RED: '+name);
}
console.log('8/8 GUARDAS MUTADAS RED (estático, no Vitest)');
NODE
node /tmp/pr584-r4-integration.mjs
~~~

**Resultado realmente observado en JS con contenido fuente obtenido de GitHub para el SHA exacto:** control 14/14 GREEN, 8/8 mutaciones de guardas de texto RED; sin objetivo 0. **Estos son controles estructurales propios, no RED runtime de Vitest ni compilación mutada.**

## Verificaciones finales de integración y gate

~~~bash
git fetch origin
git ls-remote origin refs/heads/feat/T-402-admin-shell
git merge-tree --write-tree origin/develop e15734e5ed48ad275083ff6d6224fe44d3465513
pnpm exec vitest run src/features/admin/queries.test.ts "src/app/(admin)/admin-nav.test.tsx"
pnpm typecheck
pnpm lint
pnpm test
~~~

**No ejecutados desde un clon de este runtime**, son comandos reproducibles. Los jobs de CI oficiales deben verificarse por SHA: [CI 41754008650](https://github.com/cadeApp/cadeApp/actions/runs/41754008650), [E2E 41754128185](https://github.com/cadeApp/cadeApp/actions/runs/41754128185). No se exige un nuevo CI verde únicamente por el commit documental del revisor. Verificar **approval-policy** después de editar el cuerpo, sin dispararlo manualmente.
