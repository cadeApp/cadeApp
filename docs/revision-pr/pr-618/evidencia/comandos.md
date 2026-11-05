# Evidencia reproducible — PR #618 (CC-045 / T-423)

## Entorno y alcance

El entorno de la revisión no puede resolver `github.com` desde el terminal (clon no disponible); para leer se usó la conexión GitHub y las rutas de cada SHA. **No se corrieron unitarias ni build localmente**, ni se tocó Supabase/Docker. Se inspeccionó el log CI `unit` del SHA original `d35138b`, con un solo rojo atribuible al primer DoD T-423 (`tools/verify-fichas.test.ts`): **Test Files 1 failed | 192 passed; Tests 1 failed | 3567 passed**. Fuente: https://github.com/cadeApp/cadeApp/actions/runs/42105360511/job/127518630248

`typecheck`, `lint` y `build` del SHA original completaron en verde; `approval-policy` falló porque faltaba el bloque de informe del PR. Las pruebas de `src/ui/map.tsx` aún no existen para Geocoding, dado que este CC no incluye código.

## Controles documentales independientes con mutaciones

Sobre el SHA corregido `03420fedbbeaa2e34ebc2e5128117dd25eb84729`, se ejecutaron cinco predicados contra contenidos leídos del repositorio vía GitHub. Resultado: **5 verdes sobre la documentación corregida y 5 rojos con sustitución temporal en memoria**; ninguna mutación tocó la rama. El control es deliberadamente documental: no pretende sustituir tests de `MapPicker`.

Script **completo** para reproducir desde la raíz de un clon que tenga T-423 (copiar todo el contenido entre `NODE` al archivo /tmp; no se requiere dependencia adicional):

```bash
cat > /tmp/cc045-review-check.mjs <<'NODE'
import { readFileSync } from 'node:fs';

const cc = readFileSync('docs/contracts/CC-045.md', 'utf8');
const task = readFileSync('docs/tasks/T-423.md', 'utf8');
const plan = readFileSync('docs/implementation-plan.md', 'utf8');

const tests = [
  {
    name: 'Primer DoD de T-423 coincide con la fila de plan',
    check: (c, t, p) => {
      const line = p.split('\n').find((s) => s.startsWith('| T-423 |'));
      return t.match(/^- \[[ x]\] (.*)$/m)?.[1]?.trim() === line?.split('|').map((s) => s.trim())[6];
    },
    mutate: (c, t, p) => [c, t.replace(/^- \[[ x]\] (.*)$/m, '- [ ] Sin los tests del plan.'), p],
  },
  {
    name: 'Bounds de Google son south/north/west/east',
    check: (c) => c.includes('bounds: { south: AGUILARES_BOUNDS.minLat, north: AGUILARES_BOUNDS.maxLat, west: AGUILARES_BOUNDS.minLng, east: AGUILARES_BOUNDS.maxLng }'),
    mutate: (c, t, p) => [c.replace('bounds: { south: AGUILARES_BOUNDS.minLat, north: AGUILARES_BOUNDS.maxLat, west: AGUILARES_BOUNDS.minLng, east: AGUILARES_BOUNDS.maxLng }', 'bounds: AGUILARES_BOUNDS'), t, p],
  },
  {
    name: 'Se distingue geocoding RANGE_INTERPOLATED',
    check: (c) => c.includes('APPROXIMATE, GEOMETRIC_CENTER o RANGE_INTERPOLATED'),
    mutate: (c, t, p) => [c.replace('APPROXIMATE, GEOMETRIC_CENTER o RANGE_INTERPOLATED', 'APPROXIMATE o GEOMETRIC_CENTER'), t, p],
  },
  {
    name: 'Se invalida búsqueda frente a selección manual pendiente',
    check: (c) => c.includes('si durante la espera hubo click, drag, flechas de teclado, selección por GPS o cambio de coordenadas externo'),
    mutate: (c, t, p) => [c.replace('si durante la espera hubo click, drag, flechas de teclado, selección por GPS o cambio de coordenadas externo', 'si llega la respuesta de un id viejo'), t, p],
  },
  {
    name: 'Rollout condicionado al issue de privacidad #619',
    check: (c, t) => c.includes('issue #619') && t.includes('issue #619'),
    mutate: (c, t, p) => [c.replace('issue #619', 'ticket'), t.replace('issue #619', 'ticket'), p],
  },
];
for (const { name, check, mutate } of tests) {
  if (check(cc, task, plan) !== true) throw Error(`FAIL base: ${name}`);
  const mutated = mutate(cc, task, plan);
  if (mutated.every((s, i) => s === [cc, task, plan][i])) throw Error(`FAIL mutación vacía: ${name}`);
  if (check(...mutated) !== false) throw Error(`FAIL no detecta mutación: ${name}`);
  console.log(`GREEN base / RED mutado: ${name}`);
}
NODE
node /tmp/cc045-review-check.mjs
```

La salida esperada es cinco líneas `GREEN base / RED mutado: ...`. En esta revisión se ejecutó lógica equivalente contra las tres fuentes de GitHub en el SHA señalado, con las cinco parejas `true/false` constatadas. El comando anterior queda como verificación adicional en el checkout para no afirmar que se ejecutó un clon inexistente.

## Pruebas futuras (no ejecutadas en este CC)

```bash
pnpm exec vitest run tools/verify-fichas.test.ts
pnpm typecheck && pnpm lint && pnpm test
# Al implementar T-423:
pnpm exec vitest run src/ui/map.test.tsx
# E2E con mock de Google (sin llamadas reales):
pnpm exec playwright test e2e/specs/map-geocoding.spec.ts
```

Mutaciones para T-423: forzar geocoder a devolver `RANGE_INTERPOLATED` como exacto; quitar `selectionVersion` y completar promesa después de arrastrar; pasar `AGUILARES_BOUNDS` sin adaptar; rechazar Promise con `ZERO_RESULTS`; hacer que el fallback sin mapa no emita estado. Cada mutación debe poner **rojo el test real** y no cambiar mocks/expectations para fabricar verde.
