# Evidencia — PR #108 / CC-010 / Ronda 1

## Preflight

```text
head: e16864d6f3e56a49929e603e4afe5f2e5387c9a3
base: develop@366a2b859be586278bff9245b3f1ce1d1b6533ec
ahead: 13
behind: 0
diff: 10 archivos (+520, -1)
merge-tree contra develop: limpio (198456380f3d070167dd66b22dd1be76f7f7cade), sin conflictos
correlativo CC: CC-010 libre en develop y en todas las ramas remotas
comentarios en PR: 1 (Lautaro073 reportando head y CI de implementación)
carpeta docs/revision-pr/pr-108/ previa: no existía
```

## Checks locales sobre exact-head (`e16864d6f3e56a49929e603e4afe5f2e5387c9a3`)

```bash
pnpm install --frozen-lockfile   # PASS (lockfile sincronizado con package.json)
pnpm typecheck                   # PASS (tsc --noEmit && workflows tsconfig)
pnpm lint                        # PASS (0 errors, 0 warnings)
pnpm vitest run src/ui/ui-system.test.tsx tools/verify-approved-packages.test.ts  # PASS (33/33 tests)
```

## CI de GitHub Actions

Run `36223276953` sobre commit exacto `e16864d6f3e56a49929e603e4afe5f2e5387c9a3`:
- audit: PASS (15s)
- board-sync: PASS (8s)
- build: PASS (1m10s)
- bundle-budget: PASS (7s)
- db-tests: PASS (2m35s, 12 archivos / 1529 tests)
- lint: PASS (29s)
- typecheck: PASS (31s)
- unit: PASS (56s, 55 archivos / 605 tests)
- approval-policy: FAIL (esperado por falta de informe de revisión independiente)

## Batería independiente de mutaciones (9 mutaciones)

Ejecutada sobre el árbol en memoria mediante el script harness:

```text
=== RESUMEN DE MUTACIONES ===
┌─────────┬───────┬──────────────────────────────────────────────────────────────────────────────────────────┬────────┬─────────────┐
│ (index) │ id    │ name                                                                                     │ killed │ detail      │
├─────────┼───────┼──────────────────────────────────────────────────────────────────────────────────────────┼────────┼─────────────┤
│ 0       │ 'M01' │ 'table.tsx omite TableFooter y TableCaption en exports (test ciego a exports de CC-010)' │ false  │ 'CIEGA'     │
│ 1       │ 'M02' │ 'table.tsx cambia text-sm por text-base en className'                                    │ true   │ 'DETECTADA' │
│ 2       │ 'M03' │ 'input-otp.tsx reemplaza {char} por {char ? "*" : ""} en InputOTPSlot'                   │ true   │ 'DETECTADA' │
│ 3       │ 'M04' │ 'input-otp.tsx quita role="separator" de InputOTPSeparator'                              │ true   │ 'DETECTADA' │
│ 4       │ 'M05' │ 'input-otp.tsx quita animate-pulse del caret'                                            │ true   │ 'DETECTADA' │
│ 5       │ 'M06' │ 'verify-approved-packages.test.ts quita input-otp de APPROVED_RUNTIME_PACKAGES'          │ true   │ 'DETECTADA' │
│ 6       │ 'M07' │ 'tabs.tsx quita data-[state=active]:bg-background en TabsTrigger'                        │ false  │ 'CIEGA'     │
│ 7       │ 'M08' │ 'table.tsx vacía TableFooter (renderiza null)'                                           │ false  │ 'CIEGA'     │
│ 8       │ 'M09' │ 'table.tsx vacía TableCaption (renderiza null)'                                          │ false  │ 'CIEGA'     │
└─────────┴───────┴──────────────────────────────────────────────────────────────────────────────────────────┴────────┴─────────────┘
```

## Script completo reproducible de mutaciones (`harness.mjs`)

Copiable a `/tmp` o ejecutable directamente con `node harness.mjs`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const cwd = process.cwd();

const mutations = [
  {
    id: 'M01',
    name: 'table.tsx omite TableFooter y TableCaption en exports (test ciego a exports de CC-010)',
    file: 'src/ui/table.tsx',
    mutate: (content) => content.replace(/\s*TableFooter,?\r?\n/, '\n').replace(/\s*TableCaption,?\r?\n/, '\n'),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M02',
    name: 'table.tsx cambia text-sm por text-base en className',
    file: 'src/ui/table.tsx',
    mutate: (content) => content.replace('text-sm', 'text-base'),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M03',
    name: 'input-otp.tsx reemplaza {char} por {char ? "*" : ""} en InputOTPSlot',
    file: 'src/ui/input-otp.tsx',
    mutate: (content) => content.replace('{char}', '{char ? "*" : ""}'),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M04',
    name: 'input-otp.tsx quita role="separator" de InputOTPSeparator',
    file: 'src/ui/input-otp.tsx',
    mutate: (content) => content.replace('role="separator"', ''),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M05',
    name: 'input-otp.tsx quita animate-pulse del caret',
    file: 'src/ui/input-otp.tsx',
    mutate: (content) => content.replace('animate-pulse', ''),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M06',
    name: 'verify-approved-packages.test.ts quita input-otp de APPROVED_RUNTIME_PACKAGES',
    file: 'tools/verify-approved-packages.test.ts',
    mutate: (content) => content.replace(/'input-otp',\r?\n/, ''),
    testCmd: 'pnpm vitest run tools/verify-approved-packages.test.ts',
  },
  {
    id: 'M07',
    name: 'tabs.tsx quita data-[state=active]:bg-background en TabsTrigger',
    file: 'src/ui/tabs.tsx',
    mutate: (content) => content.replace('data-[state=active]:bg-background', ''),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M08',
    name: 'table.tsx vacía TableFooter (renderiza null)',
    file: 'src/ui/table.tsx',
    mutate: (content) => content.replace(/const TableFooter = [^;]+;/, 'const TableFooter = () => null;'),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  },
  {
    id: 'M09',
    name: 'table.tsx vacía TableCaption (renderiza null)',
    file: 'src/ui/table.tsx',
    mutate: (content) => content.replace(/const TableCaption = [^;]+;/, 'const TableCaption = () => null;'),
    testCmd: 'pnpm vitest run src/ui/ui-system.test.tsx',
  }
];

console.log('=== HARNESS DE MUTACIONES PR-108 (CC-010) ===\n');

// Baseline
try {
  execSync('pnpm vitest run src/ui/ui-system.test.tsx tools/verify-approved-packages.test.ts', {
    cwd,
    stdio: 'ignore',
  });
  console.log('Baseline: PASS (verde)\n');
} catch (e) {
  console.error('Baseline FAILED! No se puede continuar.');
  process.exit(1);
}

const results = [];

for (const m of mutations) {
  const filePath = path.join(cwd, m.file);
  const original = fs.readFileSync(filePath, 'utf8');
  const mutated = m.mutate(original);

  if (mutated === original) {
    console.error(`ERROR: Mutación ${m.id} no modificó el archivo (sin objetivo)`);
    results.push({ id: m.id, name: m.name, killed: false, detail: 'SIN_OBJETIVO' });
    continue;
  }

  fs.writeFileSync(filePath, mutated, 'utf8');

  let failed = false;
  let output = '';
  try {
    output = execSync(m.testCmd, { cwd, encoding: 'utf8', stdio: 'pipe' });
  } catch (err) {
    failed = true;
    output = err.stdout + '\n' + err.stderr;
  } finally {
    fs.writeFileSync(filePath, original, 'utf8');
  }

  const killed = failed;
  console.log(`[${m.id}] ${m.name}`);
  console.log(`  Resultado: ${killed ? 'ROJO (detectada ✅)' : 'VERDE (ciega ❌)'}`);
  results.push({
    id: m.id,
    name: m.name,
    killed,
    detail: killed ? 'DETECTADA' : 'CIEGA',
  });
}

console.log('\n=== RESUMEN DE MUTACIONES ===');
console.table(results);
```


---

# Ronda 2 — cierre de hallazgos

## Identidad

```text
functional head: 127ca22d4933172f871b288659747bdca2dad55a
review round 1 commit: 54a2fe950326eb6cad7d485bd0abe58353037f34
base: 366a2b859be586278bff9245b3f1ce1d1b6533ec
diff post-R1: 2 archivos
```

`compare 54a2fe9...127ca22`:

```text
src/ui/input-otp.tsx       +4 -1
src/ui/ui-system.test.tsx +15 -2
```

## H01

Exact-head:

```tsx
const slot = inputOTPContext.slots[index];
const char = slot?.char;
const hasFakeCaret = slot?.hasFakeCaret;
const isActive = slot?.isActive;
```

No queda `slots[index]!`.

## H02 / H03

El test contractual contiene en exact-head:

```text
TableCaption importado
TableFooter importado
<TableCaption>Postulantes recientes</TableCaption>
<TableFooter>...Total: 1...</TableFooter>
assert caption != null
assert tfoot != null
assert data-[state=active]:bg-background
```

Las mutaciones M07/M08/M09 de Ronda 1 estaban específicamente dirigidas a esas ausencias; las aserciones nuevas apuntan directamente a esas propiedades.

## CI final funcional

Run `36224724348`:

```text
typecheck      PASS
lint           PASS
unit           PASS — 55 files / 605 tests
ui-system      PASS — 31 tests
build          PASS
audit          PASS
bundle-budget  PASS
db-tests       PASS — Files=12, Tests=1529, Result: PASS
database.types.ts generated with no drift
```

Cobertura:

```text
input-otp.tsx | 100 | 100 | 100 | 100
table.tsx     | 100 | 100 | 100 | 100
tabs.tsx      | 100 | 100 | 100 | 100
```

## Nota sobre approval-policy

Sobre el SHA funcional, `approval-policy` seguía rojo porque el body aún no había sido actualizado a la Ronda 2:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
```

No se usó ese rojo como defecto de código. El body se actualiza después de registrar esta Ronda 2 y el check debe re-ejecutarse.


## Incidencia de CI posterior al commit documental

El primer run del commit documental `5ecebdc` tuvo un fallo externo durante `next/font`. El workflow de build usa `pnpm build 2>&1 | tee build-output.txt` sin propagar el exit code de `next build`, por lo que el job `build` quedó verde aunque el artefacto no contenía la tabla de rutas; `bundle-budget` lo detectó con:

```text
No se pudo leer ninguna ruta de la salida de Next.js.
```

En un rerun posterior, `next build` sí compiló y emitió la tabla de rutas, pero `actions/download-artifact` siguió seleccionando por nombre el artefacto fallido de un intento anterior del mismo run. Esto es una limitación operacional del rerun y no un cambio de CC-010.

Para obtener una comprobación limpia se dispara un run nuevo mediante este commit documental, sin modificar el SHA funcional verificado `127ca22` ni código de aplicación.
