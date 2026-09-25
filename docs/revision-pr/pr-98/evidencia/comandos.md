# Comandos reproducibles — PR #98

**SHA revisado:** `09082afba1a054ed634514a06ce467e76780cc58`.

## Limitación de esta sesión

Se intentó preparar un checkout limpio con:

```bash
git clone https://github.com/cadeApp/cadeApp.git /tmp/cadeapp-pr98
```

El entorno respondió:

```text
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/':
Could not resolve host: github.com
```

Por eso no se atribuyen falsos `[VERIFICADO]` a las mutaciones de abajo. Son el arnés completo para correr en un checkout con dependencias. La ejecución independiente que sí se reprodujo fue el job de CI del commit rojo `3d426d7`.

## E0 · Sincronía inicial

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/feat/T-311-legal-consents
git rev-parse origin/develop
git merge-tree --write-tree origin/develop HEAD
git diff --name-only origin/develop...HEAD
```

Esperado antes del arreglo: feature en `09082af`, develop con #99 y conflicto/desvío de ficha.

## E1 · Rojo TDD del autor, reproducido desde CI

Commit: `3d426d7bf4bcfad8ef75b00305a4ef0924f03d70`  
Run: `36109706182`, job `unit`.

Resumen leído del log:

```text
src/features/legal/legal-red.test.ts (6 tests | 6 failed)
- 4 rutas legales inexistentes
- registry legal inexistente
- validador de versión vigente inexistente

Test Files 2 failed | 50 passed (52)
Tests      7 failed | 536 passed (543)
```

El séptimo fallo era `tools/verify-fichas.test.ts`.

## M1–M3 · Eliminar el guard de versión en cada Server Action

Guardar este archivo como `/tmp/pr98-mut-actions.mjs` y ejecutarlo desde la raíz del repo. Restaura siempre el contenido original en `finally`; no usa `git checkout`.

```js
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const cases = [
  {
    id: 'M1-auth',
    file: 'src/features/auth/actions.ts',
    test: 'src/features/auth/actions.test.ts',
    find: /if \(\n\s*!areCurrentLegalVersions\(\[[\s\S]*?\]\)\n\s*\) \{\n\s*return err\('VALIDATION_ERROR'\);\n\s*\}/,
    replace: "if (false) { return err('VALIDATION_ERROR'); }",
  },
  {
    id: 'M2-merchant',
    file: 'src/features/merchants/actions.ts',
    test: 'src/features/merchants/actions.test.ts',
    find: /if \(parsed\.data\.pilotTermsVersion !== normalizedPilotTermsVersion\) \{\n\s*return err\('VALIDATION_ERROR'\);\n\s*\}/,
    replace: "if (false) { return err('VALIDATION_ERROR'); }",
  },
  {
    id: 'M3-courier',
    file: 'src/features/courier-onboarding/actions.ts',
    test: 'src/features/courier-onboarding/actions.test.ts',
    find: /if \(\n\s*!areCurrentLegalVersions\(\[[\s\S]*?\]\)\n\s*\) \{\n\s*return err\('VALIDATION_ERROR'\);\n\s*\}/,
    replace: "if (false) { return err('VALIDATION_ERROR'); }",
  },
];

for (const c of cases) {
  const original = fs.readFileSync(c.file, 'utf8');
  if (!c.find.test(original)) throw new Error(c.id + ': mutación sin objetivo');
  const mutated = original.replace(c.find, c.replace);
  if (mutated === original) throw new Error(c.id + ': no cambió nada');

  try {
    fs.writeFileSync(c.file, mutated);
    const r = spawnSync('pnpm', ['vitest', 'run', c.test], { encoding: 'utf8' });
    const summary = (r.stdout + '\n' + r.stderr)
      .split('\n')
      .filter((l) => /Test Files|Tests\s/.test(l))
      .join('\n');
    console.log('\n' + c.id + ' exit=' + r.status + '\n' + summary);
  } finally {
    fs.writeFileSync(c.file, original);
  }
}

const status = spawnSync('git', ['status', '--short'], { encoding: 'utf8' });
console.log('\ngit status --short:\n' + status.stdout);
```

**Criterio:** en el SHA corregido M1, M2 y M3 deben terminar con exit != 0. En `09082af` la revisión espera que pasen o no tengan un caso específico; ejecutar antes de cerrar H05.

## P1 · Cuenta creada si falla consents

Agregar temporalmente —mediante el mismo patrón de escritura/restauración— un caso en `src/features/auth/actions.test.ts` que:
1. mockee `signUp` exitoso;
2. haga fallar `adminClient.from('consents').insert`;
3. exponga `adminClient.auth.admin.deleteUser` como spy;
4. espere `INTERNAL_ERROR`;
5. espere `deleteUser('usr-...')`.

En `09082af` debe fallar la expectativa 5 porque `registerAction` retorna en `actions.ts:126-128` sin compensación.

Después del arreglo, el mismo caso queda verde.

## P2 · Labels accesibles

Casos permanentes recomendados:

```ts
expect(screen.getByRole('checkbox', { name: /términos.*privacidad/i })).toBeInTheDocument();
expect(screen.getByRole('checkbox', { name: /términos del piloto/i })).toBeInTheDocument();
```

Y axe sobre ambos formularios.

## Fuentes normativas verificadas por la revisión

- Ley 25.326: https://www.argentina.gob.ar/normativa/nacional/64790/texto
- Ley 25.506: https://www.argentina.gob.ar/normativa/nacional/70749/texto
- Ley 24.240: https://www.argentina.gob.ar/normativa/nacional/638/actualizacion
- Disposición 377/2026: https://www.argentina.gob.ar/normativa/nacional/disposici%C3%B3n-377-2026-423801/texto
- Ley 27.802: https://www.argentina.gob.ar/normativa/nacional/norma-423680/texto
- AAIP transferencias: https://www.argentina.gob.ar/transferencias-internacionales
- ARCA RG 5866/2026: https://www.argentina.gob.ar/normativa/nacional/norma-427092/texto
- ARCA RG 5893/2026: https://www.argentina.gob.ar/normativa/nacional/norma-429369/texto

## Batería final

Solo cuando no queden bloqueantes estáticos:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
node docs/revision-pr/analizar.mjs verificacion
git merge-tree --write-tree origin/develop HEAD
git status --short
```

No se levanta Supabase ni Docker local.
