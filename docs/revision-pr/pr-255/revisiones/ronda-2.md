# Informe de revisión — PR #255 / T-337 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/255  
**Head SHA revisado:** `b48cdf8659183ae9060954bf5b2a59dee4a1b7a9`  
**Base:** `develop` @ `1cd3da01b3af9619e4a19107ba5e8354a18c2159`  
**Fecha:** 2026-10-05

## Resultado

**SIN BLOQUEANTES. PR255-H01: arreglado y verificado independientemente.**

No apareció ninguna 🔵 decisión nueva. Se mantuvo la decisión A de Lautaro073: solución 100 % E2E, sin tocar `src/**`.

## Qué cambió desde ronda 1

Desde el commit de revisión `519ed6f`, el autor tocó únicamente los cuatro archivos autorizados:

- `e2e/helpers/hydration.ts`
- `e2e/specs/login.spec.ts`
- `docs/tasks/T-337.md`
- `docs/tasks/log/T-337.md`

No tocó `docs/revision-pr/**`, `src/**`, `e2e/pages/login.page.ts`, workflows, configuración de Playwright ni dependencias.

La ficha solo corrige la definición de «señal de hidratación»; no amplía archivos permitidos, dependencias ni alcance.

## PR255-H01 — ✅ arreglado-verificado

### Arreglo inspeccionado

`waitForFormHydration` ahora exige las dos señales:

1. `__reactProps$*.onSubmit` existe y es función;
2. `__reactFiber$*` pasa un criterio equivalente a `getNearestMountedFiber(fiber) === fiber` de React 18.3.1:
   - sin `alternate`, `Placement | Hydrating` en target o ancestros impide considerarlo montado;
   - con `alternate`, la cadena debe llegar a `HostRoot`;
   - un árbol que no termina en `HostRoot` se rechaza;
   - una cadena anormalmente cíclica se corta defensivamente.

No se agregó marcador de test a producción.

### Prueba del autor contrastada

El test nuevo no reemplaza el E2E real: conserva el caso que retiene chunks y suma un contrato sintético donde:

- `onSubmit` ya existe;
- el Fiber target sigue con `Hydrating = 4096`;
- el helper debe rechazar;
- al pasar `flags` a 0 debe resolver.

La mutación declarada por el autor —retornar `true` después de detectar `onSubmit`, ignorando Fiber— fue reproducida en un harness independiente: el estado pre-commit pasa indebidamente con la mutación y es rechazado por el fix.

### Batería independiente de ronda 2

Se ejecutó `/tmp/pr255-r2-harness.mjs` contra la lógica exacta del SHA revisado y una función de referencia de `getNearestMountedFiber`.

Casos:

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
```

Mutaciones propias, distintas de la del autor:

```text
mutation-ignore-ancestor accepts bad= true
mutation-ignore-root accepts bad= true
```

Esas dos mutaciones muestran que la batería independiente sí distingue un helper incompleto que solo revisa el target o que no exige HostRoot.

Reproducción semántica del RED del autor:

```text
fixed precommit => false (esperado false)
mutation precommit => true (test debería quedar RED porque esperaba rechazo)
```

## CI del SHA revisado

Se inspeccionaron los logs, no solo el color del check.

### CI run 37359139352

- typecheck: ✅
- lint: ✅ — `No ESLint warnings or errors`; el paso informativo de Prettier sigue reportando deuda preexistente y no bloquea.
- unit: ✅ — **119 test files, 1899 tests passed**.
- build: ✅
- bundle-budget: ✅
- audit: ✅
- db-tests: ✅ — tras rate limits transitorios al bajar imágenes:
  - `Files=1, Tests=10` → `Result: PASS`
  - `Files=18, Tests=1811` → `Result: PASS`

### e2e-preview run 37359317872

```text
Running 31 tests using 1 worker
login.spec.ts caso real ... ✓
login.spec.ts contrato Fiber ... ✓
31 passed (6.2m)

Running 3 tests using 1 worker
3 passed (1.1m)
```

Sin `flaky` ni `retry #` en el resumen.

El page object `e2e/pages/login.page.ts` no cambió desde las tres corridas previas exigidas por el DoD; el SHA actual además tiene un gate automático completo verde con el helper reforzado.

## Alcance y coordinación

- develop sigue en `1cd3da0`; la rama está 10 commits adelante y 0 detrás.
- GitHub reporta la PR mergeable.
- No hay cambios de contrato, migraciones, dependencias ni workflows.
- El único thread de CodeRabbit quedó resuelto/outdated después del arreglo.
- El autor no escribió la carpeta de revisión después de ronda 1.

## Mejora no bloqueante

`e2e/pages/login.page.ts` conserva `expect(this.passwordInput).toHaveValue(password)`. Un fallo del matcher podría incluir el valor esperado en la salida. Es una credencial E2E efímera y la mejora fue deliberadamente dejada fuera de esta ronda para no cambiar el page object después de la evidencia requerida. No es bloqueante para T-337.

## Checklist final

- [x] PR255-H01 corregido.
- [x] RED del defecto reproducido independientemente a nivel de contrato.
- [x] Batería propia con casos no usados por el autor.
- [x] Test real de chunks conservado.
- [x] Test de contrato Fiber agregado.
- [x] Ficha corregida sin ampliar alcance.
- [x] Bitácora al día.
- [x] CI del SHA revisado inspeccionado por logs.
- [x] E2E automático verde, sin flaky/retry.
- [x] Rama al día y mergeable.
- [x] 0 bloqueantes nuevos.

## Conclusión

T-337 cumple su DoD. La PR está lista para merge.
