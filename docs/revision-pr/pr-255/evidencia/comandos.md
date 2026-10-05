# Comandos reproducibles — PR #255

La revisión no tuvo un checkout del repo. La evidencia propia ejecutable es un harness aislado que reproduce exactamente la diferencia entre el predicado actual y el estado mounted que React 18 usa para eventos.

## H01 · `onSubmit` presente antes del commit

Fuentes contrastadas:

- React 18.3.1 `ReactDOMHostConfig.js`: `hydrateInstance()` llama `precacheFiberNode` y `updateFiberProps` y deja el TODO de diferirlo a commit.
- React 18.3.1 `ReactFiberTreeReflection.js`: `getNearestMountedFiber` considera `Placement | Hydrating` una inserción/hidratación en progreso.
- React 18.3.1 `ReactDOMEventListener.js`: un target cuyo nearest mounted no es él mismo no se despacha como target React.

### Harness completo

```bash
cat > /tmp/t337-hydration-harness.mjs <<'EOF'
const Placement = 0b10;
const Hydrating = 0b1000000000000; // 4096
const HostRoot = 3;

function currentPredicate(form) {
  const propsKey = Object.keys(form).find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) return false;
  const props = Reflect.get(form, propsKey);
  return typeof props === 'object' && props !== null &&
    typeof Reflect.get(props, 'onSubmit') === 'function';
}

function mountedPredicate(form) {
  if (!currentPredicate(form)) return false;
  const fiberKey = Object.keys(form).find((key) => key.startsWith('__reactFiber$'));
  if (!fiberKey) return false;

  let fiber = Reflect.get(form, fiberKey);
  if (!fiber || typeof fiber !== 'object') return false;
  const target = fiber;

  if (!fiber.alternate) {
    let nearestMounted = target;
    let node = target;
    while (node) {
      if ((Number(node.flags ?? 0) & (Placement | Hydrating)) !== 0) {
        nearestMounted = node.return ?? null;
      }
      if (!node.return) {
        return node.tag === HostRoot && nearestMounted === target;
      }
      node = node.return;
    }
    return false;
  }

  while (fiber.return) fiber = fiber.return;
  return fiber.tag === HostRoot;
}

function makeForm(targetFlags) {
  const root = { tag: HostRoot, flags: 0, return: null, alternate: null };
  const fiber = { tag: 5, flags: targetFlags, return: root, alternate: null };
  return {
    '__reactProps$test': { onSubmit() {} },
    '__reactFiber$test': fiber,
  };
}

const preCommit = makeForm(Hydrating);
const postCommit = makeForm(0);

console.log('precommit/current=', currentPredicate(preCommit));
console.log('precommit/mounted=', mountedPredicate(preCommit));
console.log('postcommit/current=', currentPredicate(postCommit));
console.log('postcommit/mounted=', mountedPredicate(postCommit));

if (currentPredicate(preCommit) !== true) {
  throw new Error('El predicado actual debería aceptar el falso positivo pre-commit');
}
if (mountedPredicate(preCommit) !== false) {
  throw new Error('La señal reforzada debe rechazar Hydrating');
}
if (mountedPredicate(postCommit) !== true) {
  throw new Error('La señal reforzada debe aceptar post-commit');
}
EOF

node /tmp/t337-hydration-harness.mjs
```

Salida observada:

```text
precommit/current= true
precommit/mounted= false
postcommit/current= true
postcommit/mounted= true
```

Interpretación: el control actual da verde en el estado artificial que representa un Fiber todavía `Hydrating`; una comprobación de mounted lo rechaza.

## Evidencia del autor contrastada en CI

Run `37340563455`, job `111893334117`:

```text
[chromium] login.spec.ts ... ✓
30 passed (6.5m)
[global-settings] ...
3 passed (1.1m)
```

Run posterior `37349900307`, job `111897908759`:

```text
[chromium] login.spec.ts ... ✓
30 passed (7.0m)
3 passed (1.2m)
```

Esto demuestra estabilidad observada del flujo actual, no invalida H01 porque el gate no fuerza el intervalo props-before-commit.

## Mutación que debe correr el autor para cerrar H01

Una vez agregado el caso de contrato en `e2e/specs/login.spec.ts`:

1. GREEN base: helper exige `onSubmit` **y** Fiber mounted.
2. MUTACIÓN RED: hacer que el helper retorne `true` apenas existe `onSubmit`, ignorando `__reactFiber$*` y `Hydrating/Placement`.
3. El nuevo caso debe fallar porque el estado con `flags = Hydrating` sería aceptado.
4. Restaurar el helper y obtener verde.
5. Correr también el spec real sin adulterarlo:

```bash
PLAYWRIGHT_TEST_BASE_URL=http://localhost:3000 \
pnpm exec playwright test e2e/specs/login.spec.ts --project=chromium --repeat-each=5 --workers=1
```

No crear tests que solo busquen strings del source ni cambiar expectativas para conseguir verde.
