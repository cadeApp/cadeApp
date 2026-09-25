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


---

# Ronda 2 — SHA c5c7371

## R2-E1 · Restos de gate de abogado

```bash
rg -n "abogado|abogada" docs/implementation-plan.md docs/tasks/T-311.md
```

T-312 no debe conservar `abogado OK`.

## R2-P1 · Fallo de rollback

Caso requerido:

```ts
deleteUser.mockResolvedValue({
  data: { user: null },
  error: new Error('delete failed'),
});
```

Y, preferentemente:

```ts
deleteUser.mockRejectedValue(new Error('network failure'));
```

El test tiene que demostrar estado seguro, no solo `INTERNAL_ERROR`.

## R2-P2 · Matriz de obligatoriedad

```text
register required: email,password,role,acceptTerms,acceptedTermsVersion,acceptedPrivacyVersion
register optional: displayName,phone

merchant required: businessName,phone,defaultPickupAddress,acceptPilotTerms,pilotTermsVersion
merchant optional: defaultPickupZoneId,lat/lng,notes

courier required: dni,vehicleType,dni_front,dni_back,selfie,avatar,consents+versions
courier conditional: vehiclePlate solo moto/car
courier optional: license,insurance

request required: pickup/dropoff zone+address, recipientName, recipientPhone,
                  recipientConsentDeclared, packageType, recipientPaymentMethod, needsChange
request optional/conditional: coordinates, notes, cashChangeAmount
```

## R2-E3 · Visual

Necesario: 390×844 y 360×800, `/legal` + documento largo, axe AA en superficies tocadas.

## R2-E4 · Body PR

Debe reflejar H08 pendiente, eliminar autorrevisión “SIN BLOQUEANTES” y cifras/rutas obsoletas.


---

# Ronda 3 — SHA c47aee4

## R3-E1 · Scope excepcional T-312

Decisión P1 D04=A: solo se acepta el diff que reemplaza `abogado OK` en `docs/tasks/T-312.md`.

## R3-P1 · Falla total de compensaciones H06

El código actual no inspecciona los resultados de:

```ts
await Promise.allSettled([
  adminClient.from('profiles').delete().eq('id', userId),
  adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' }),
]);
```

Probe conceptual antes de CC-007:
- `deleteUser` falla;
- delete profile falla;
- ban falla;
- demostrar que registerAction solo devuelve INTERNAL_ERROR y no existe evidencia de un guard compartido que impida usar esa identidad.

No agregar otra compensación best-effort en T-311: resolver el invariante mediante CC-007.

## R3-E2 · H12

```bash
rg -n "\bas any\b|:\s*any\b" src/features/legal/legal-red.test.ts
```

Debe dar cero al retomar T-311.

El test de deriva debe importar/ejecutar schemas reales, no limitarse a regex sobre el copy.

## R3-E3 · Visual pendiente

Después de CC-007:
- 390×844: /legal + documento largo;
- 360×800: /legal + documento largo;
- axe AA: legal + registro + merchant + courier afectados.
