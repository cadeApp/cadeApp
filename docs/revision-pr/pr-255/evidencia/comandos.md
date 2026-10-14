# Comandos reproducibles — PR #255

## Ronda 1 — detección de H01

La revisión no tuvo un checkout del repo. La evidencia ejecutable de ronda 1 fue un harness aislado que demostró que `__reactProps$*.onSubmit` puede estar presente antes de que el Fiber cuente como mounted.

Salida:

```text
precommit/current= true
precommit/mounted= false
postcommit/current= true
postcommit/mounted= true
```

## Ronda 2 — batería independiente sobre el fix

Este es el harness completo usado en ronda 2. Copiado a `/tmp/pr255-r2-harness.mjs` corre solo con Node; no requiere el repo.

```bash
cat > /tmp/pr255-r2-harness.mjs <<'EOF'
const PLACEMENT = 2;
const HYDRATING = 4096;
const HOST_ROOT = 3;
const MAX_DEPTH = 10000;

function isObject(value) {
  return typeof value === 'object' && value !== null;
}

function productionPredicate(form) {
  const keys = Object.keys(form);
  const propsKey = keys.find((key) => key.startsWith('__reactProps$'));
  if (!propsKey) return false;
  const props = Reflect.get(form, propsKey);
  if (!isObject(props) || typeof Reflect.get(props, 'onSubmit') !== 'function') return false;

  const fiberKey = keys.find((key) => key.startsWith('__reactFiber$'));
  if (!fiberKey) return false;
  const fiber = Reflect.get(form, fiberKey);
  if (!isObject(fiber)) return false;

  const parent = (node) => {
    const next = Reflect.get(node, 'return');
    return isObject(next) ? next : null;
  };
  const flagsOf = (node) => {
    const value = Reflect.get(node, 'flags');
    return typeof value === 'number' ? value : 0;
  };

  let node = fiber;
  let nearestMounted = fiber;
  let depth = 0;
  const alternate = Reflect.get(fiber, 'alternate');

  if (!isObject(alternate)) {
    let next = node;
    do {
      node = next;
      if ((flagsOf(node) & (PLACEMENT | HYDRATING)) !== 0) {
        nearestMounted = parent(node);
      }
      next = parent(node);
      depth += 1;
    } while (next && depth < MAX_DEPTH);
  } else {
    let next = parent(node);
    while (next && depth < MAX_DEPTH) {
      node = next;
      next = parent(node);
      depth += 1;
    }
  }

  if (depth >= MAX_DEPTH) return false;
  if (Reflect.get(node, 'tag') !== HOST_ROOT) return false;
  return nearestMounted === fiber;
}

function reactReference(fiber) {
  let node = fiber;
  let nearestMounted = fiber;
  if (!fiber.alternate) {
    let nextNode = node;
    do {
      node = nextNode;
      if ((node.flags & (PLACEMENT | HYDRATING)) !== 0) {
        nearestMounted = node.return;
      }
      nextNode = node.return;
    } while (nextNode);
  } else {
    while (node.return) node = node.return;
  }
  return node.tag === HOST_ROOT ? nearestMounted : null;
}

function formFor(fiber, onSubmit = () => {}) {
  return {
    '__reactProps$x': { onSubmit },
    '__reactFiber$x': fiber,
  };
}
const root = () => ({ tag: HOST_ROOT, flags: 0, return: null, alternate: null });

const cases = [];
{
  const r = root();
  const f = { tag: 5, flags: 0, return: r, alternate: null };
  cases.push(['mounted-new', formFor(f), true, reactReference(f) === f]);
}
{
  const r = root();
  const f = { tag: 5, flags: HYDRATING, return: r, alternate: null };
  cases.push(['target-hydrating', formFor(f), false, reactReference(f) === f]);
}
{
  const r = root();
  const p = { tag: 0, flags: HYDRATING, return: r, alternate: null };
  const f = { tag: 5, flags: 0, return: p, alternate: null };
  cases.push(['ancestor-hydrating', formFor(f), false, reactReference(f) === f]);
}
{
  const r = root();
  const f = { tag: 5, flags: PLACEMENT, return: r, alternate: null };
  cases.push(['target-placement', formFor(f), false, reactReference(f) === f]);
}
{
  const detached = { tag: 0, flags: 0, return: null, alternate: null };
  const f = { tag: 5, flags: 0, return: detached, alternate: null };
  cases.push(['detached', formFor(f), false, reactReference(f) === f]);
}
{
  const r = root();
  const alt = {};
  const f = { tag: 5, flags: HYDRATING, return: r, alternate: alt };
  cases.push(['alternate-root', formFor(f), true, reactReference(f) === f]);
}
cases.push(['missing-fiber', { '__reactProps$x': { onSubmit() {} } }, false, null]);
cases.push([
  'bad-onsubmit',
  {
    '__reactProps$x': { onSubmit: 'x' },
    '__reactFiber$x': { tag: 5, flags: 0, return: root(), alternate: null },
  },
  false,
  null,
]);

let ok = true;
for (const [name, form, expected, reference] of cases) {
  const got = productionPredicate(form);
  console.log(
    `${name}: prod=${got} expected=${expected}${reference === null ? '' : ` reactRef=${reference}`}`
  );
  if (got !== expected || (reference !== null && got !== reference)) ok = false;
}

const cyc = { tag: 5, flags: 0, alternate: null };
cyc.return = cyc;
console.log('cycle:', productionPredicate(formFor(cyc)));
if (productionPredicate(formFor(cyc)) !== false) ok = false;

// Mutación propia 1: solo mira flags del target, ignora Hydrating en ancestros.
function mutationIgnoreAncestor(form) {
  const f = form['__reactFiber$x'];
  return (
    !!form['__reactProps$x']?.onSubmit &&
    !(f.flags & (PLACEMENT | HYDRATING)) &&
    f.return?.return?.tag === HOST_ROOT
  );
}

// Mutación propia 2: no exige que la cadena termine en HostRoot.
function mutationIgnoreRoot(form) {
  const f = form['__reactFiber$x'];
  return !!form['__reactProps$x']?.onSubmit && !(f.flags & (PLACEMENT | HYDRATING));
}

const r1 = root();
const p1 = { tag: 0, flags: HYDRATING, return: r1, alternate: null };
const f1 = { tag: 5, flags: 0, return: p1, alternate: null };
console.log('mutation-ignore-ancestor accepts bad=', mutationIgnoreAncestor(formFor(f1)));

const detached = { tag: 0, flags: 0, return: null, alternate: null };
const fd = { tag: 5, flags: 0, return: detached, alternate: null };
console.log('mutation-ignore-root accepts bad=', mutationIgnoreRoot(formFor(fd)));

if (!mutationIgnoreAncestor(formFor(f1)) || !mutationIgnoreRoot(formFor(fd))) ok = false;
process.exit(ok ? 0 : 1);
EOF

node /tmp/pr255-r2-harness.mjs
```

Salida observada:

```text
mounted-new: prod=true expected=true reactRef=true
target-hydrating: prod=false expected=false reactRef=false
ancestor-hydrating: prod=false expected=false reactRef=false
target-placement: prod=false expected=false reactRef=false
detached: prod=false expected=false reactRef=false
alternate-root: prod=true expected=true reactRef=true
missing-fiber: prod=false expected=false
bad-onsubmit: prod=false expected=false
cycle: false
mutation-ignore-ancestor accepts bad= true
mutation-ignore-root accepts bad= true
```

## Ronda 2 — reproducción del RED declarado por el autor

```bash
cat > /tmp/pr255-author-red-repro.mjs <<'EOF'
const HYDRATING = 4096;
const HOST_ROOT = 3;
const root = { tag: HOST_ROOT, flags: 0, return: null, alternate: null };
const fiber = { tag: 5, flags: HYDRATING, return: root, alternate: null };
const form = {
  '__reactProps$test': { onSubmit() {} },
  '__reactFiber$test': fiber,
};

function fixed(f) {
  const props = f['__reactProps$test'];
  if (typeof props?.onSubmit !== 'function') return false;
  const target = f['__reactFiber$test'];
  let node = target;
  let nearest = target;
  let next = node;
  do {
    node = next;
    if ((node.flags & (2 | 4096)) !== 0) nearest = node.return;
    next = node.return;
  } while (next);
  return node.tag === 3 && nearest === target;
}

function authorMutation(f) {
  const props = f['__reactProps$test'];
  if (typeof props?.onSubmit !== 'function') return false;
  return true;
}

console.log(`fixed precommit => ${fixed(form)} (esperado false)`);
console.log(
  `mutation precommit => ${authorMutation(form)} (test debería quedar RED porque esperaba rechazo)`
);

if (fixed(form) !== false || authorMutation(form) !== true) process.exit(1);
EOF

node /tmp/pr255-author-red-repro.mjs
```

Salida observada:

```text
fixed precommit => false (esperado false)
mutation precommit => true (test debería quedar RED porque esperaba rechazo)
```

## CI del SHA verificado `b48cdf8659183ae9060954bf5b2a59dee4a1b7a9`

### Unit — run 37359139352

```text
Test Files 119 passed (119)
Tests 1899 passed (1899)
```

### DB — mismo run

```text
Files=1, Tests=10
Result: PASS
Files=18, Tests=1811
Result: PASS
```

### E2E Preview — run 37359317872

```text
Running 31 tests using 1 worker
login.spec.ts: caso real ✓
login.spec.ts: contrato Fiber ✓
31 passed (6.2m)
Running 3 tests using 1 worker
3 passed (1.1m)
```

No se observó `flaky` ni `retry #` en el resumen.
