# Ronda 6 — PR #87 (T-118) — Revisión independiente final

- **SHA de implementación revisado:** `feb3c7fc47c50c961505be95fd07cf2635787649`
- **develop:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-25
- **Desde R5:** 2 commits después de `a2d20a4`; sólo `docs/tasks/log/T-118.md`, `src/app/route-integrity.test.ts` y `src/ui/ui-system.test.tsx`; `docs/revision-pr/pr-87/**` intacto.
- **GitHub:** PR mergeable.
- **Decisiones pendientes:** 0.
- **Resultado:** **SIN BLOQUEANTES**.

## Informe formato revisar-pr

~~~text
Informe revisar-pr — T-118 — 2026-09-25 — generado por revisión independiente
Resultado: SIN BLOQUEANTES
Checks locales: no ejecutables en este runtime · CI exact-head: typecheck ✅ · lint ✅ · test:coverage ✅ (47/47 archivos, 497/497 tests) · test:db ✅ · build ✅ · bundle-budget ✅ (advisory) · approval-policy ✅
BLOQUEANTES:
- ninguno
MEJORAS:
- CI/Prettier: format:check es advisory y reporta 89 archivos pendientes de formato; no bloquea por política actual.
- CI/Audit: pnpm audit reporta 2 vulnerabilidades moderadas; la PR no agrega dependencias y el job es advisory hasta contracts-v1.
- CI/Bundle: varias rutas T-118 superan el presupuesto advisory de 180 kB (merchant/dashboard e history 299 kB; courier onboarding/profile 273 kB; courier feed/offers 201 kB; merchant/plan 197 kB). Conviene tratarlas en una tarea de performance separada; T-118 no fija ese presupuesto como DoD bloqueante.
No revisado / dudas para Lautaro073:
- ninguna.
~~~

## Cierre de PR87-H09

El residual de R5 quedó cubierto.

El scanner de `src/app/route-integrity.test.ts` ahora:
- extrae `href: '/...'` / template literals en objetos de navegación;
- resuelve helpers usados como `href={helper(...)}` y valida su `return '/...'` / template;
- sigue `router.push/replace(variable)`;
- para `.redirectTo` indirecto valida el productor de la Server Action;
- mantiene el resolutor general de filesystem, incluido `[id]`.

Mutaciones presentes:
- nav item extra `href: '/ghost'` → rojo;
- helper huérfano / helper que retorna `/ghost` → rojo;
- `targetUrl = '/ghost'; router.push(targetUrl)` → rojo;
- variable de router sin productor verificable → rojo;
- templates directos `/ghost/${id}` → rojo.

CI del SHA exacto confirma:

~~~text
src/app/route-integrity.test.ts (50 tests) ✅
Test Files 47 passed (47)
Tests 497 passed (497)
~~~

H09 pasa a `arreglado-verificado` en `feb3c7fc47c50c961505be95fd07cf2635787649`.

## CI exact-head

### CI — run 36097343224

Todos los jobs finalizaron `success`:

~~~text
lint          ✅
build         ✅
db-tests      ✅
typecheck     ✅
unit          ✅
audit         ✅ (advisory: 2 moderate)
bundle-budget ✅ (advisory)
~~~

Detalles:
- build: compilación exitosa y 33/33 páginas estáticas;
- db-tests: RLS/RPC `All tests successful. Result: PASS` + tipos locales;
- unit: 47 archivos / 497 tests, coverage job verde;
- workflows: 21/21;
- ADR: 6/6;
- lint: ESLint sin warnings/errores.

### approval-policy — run 36097341915

`approval-policy` terminó `success` sobre el mismo head `feb3c7fc47c50c961505be95fd07cf2635787649`.

Log:

~~~text
Informe de revisar-pr completo y sin bloqueantes.
~~~

## Advertencias advisory observadas

No se convierten en bloqueantes de T-118 porque el repositorio las define explícitamente como advisory y la ficha no las incorpora como umbral de aceptación:

- `format:check`: 89 archivos pendientes de Prettier.
- `pnpm audit`: 2 vulnerabilidades, severidad `moderate`.
- bundle budget de 180 kB: hay rutas canónicas por encima del umbral; el propio control está diseñado para reportar sin fallar.

No hay dependencias nuevas en esta PR.

## Conclusión

Los 20 hallazgos H01–H20 y las 4 regresiones R01–R04 quedaron corregidos y verificados; A01/A02 siguen aceptados por decisión explícita de P1. No quedan decisiones ni bloqueantes abiertos.
