# Informe de revisión — PR #248 / T-336 — Ronda 3 final

**SHA funcional final:** `76d174027202db06c3e06c7da6f8b53b7b98e2d4`  
**Base:** `develop@59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Fecha:** 2026-10-04  
**Resultado:** **SIN BLOQUEANTES**

## PR248-H02 — cerrado

**Estado:** `arreglado-verificado`

La corrección de Ronda 3 extiende el auditor de navegación root para seguir productores indirectos simples sin tocar código productivo.

### Cobertura incorporada

El scanner ahora resuelve:

- variables locales literales:
  `const target = '/'; router.push(target)`;
- `let` / `var` equivalentes;
- cadenas simples de variables;
- helper arrow conciso que devuelve `/`;
- helper con bloque y `return '/'`;
- function declaration que devuelve `/`;
- navegación indirecta mediante:
  - `router.push`;
  - `router.replace`;
  - `redirect`;
  - `redirectTo`;
  - `href`.

Los destinos distintos de root, por ejemplo `/login`, no son marcados como violación.

### Tests discriminantes

La suite agrega controles reales sobre `scanRootNavigationOccurrences`:

- variable root + `router.push` → violación;
- variable root + `router.replace` → violación;
- helper root + `router.push` → violación;
- function helper root + `redirect` → violación;
- variable/helper `/login` → sin violación.

### Mutación RED real

La bitácora registra una sonda temporal en un archivo productivo auditado:

```ts
const __t336Probe = '/';
if (false as boolean) {
  router.push(__t336Probe);
}
```

El test de integridad quedó RED mostrando exactamente la ocurrencia no autorizada. La sonda fue restaurada y no forma parte del diff final.

### Verificación independiente

La revisión inspeccionó el código exact-head y comprobó que la corrección no toca producto: desde R2 solo cambian:

- `src/app/route-integrity.test.ts`;
- `docs/tasks/log/T-336.md`.

CI exact-head run `37184391888` terminó GREEN:

- Test Files: **118 passed (118)**;
- Tests: **1879 passed (1879)**;
- DB probe: **10 tests PASS**;
- DB suite: **1811 tests PASS**;
- lint/typecheck/build/bundle: GREEN;
- `/courier/feed = 159 kB`;
- `/courier/profile = 178 kB`.

H02 queda cerrado.

---

## Estado de hallazgos

- PR248-H01 → arreglado-verificado
- PR248-H02 → arreglado-verificado
- PR248-H03 → arreglado-verificado
- PR248-H04 → arreglado-verificado

## Preview

No se exige un nuevo Preview por Ronda 3 porque el único cambio funcional de esta ronda es un **test estático**. El runtime de producto es el mismo ya validado en R2 sobre `f09b0088...`.

Vercel intentó desplegar el SHA final y volvió a responder con la cuota diaria externa; no es un defecto de la PR.

## QA aparte

El flaky T-306 de R2 permanece registrado en #249 y no se atribuye a T-336.

## Resultado final

**0 bloqueantes. PR #248 lista para merge.**
