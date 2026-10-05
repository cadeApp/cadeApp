# Informe de revisión — PR #248 / T-336 — Ronda 2

**SHA funcional:** `f09b0088c44f33f767a2912901b956f1a65986ca`  
**SHA revisado:** `89bc392f096ebb1da6f79d5407d7612c15e68cea`  
**Base:** `develop@59d9d1783a936c9c7d5331cc5b2c07b4ed7d05b3`  
**Fecha:** 2026-10-04  
**Resultado:** **CON BLOQUEANTE RESIDUAL (1)**

## PR248-H01 — cerrado

**Estado:** `arreglado-verificado`

`guards.ts` ya no usa `getRoleDefaultPath('admin')` en los fallbacks auditados de aliases ni en rutas cross-role. Todos delegan a `getSessionHomePath(session)`.

La suite agrega 22 casos paramétricos que cubren admin AAL1/AAL2 sobre:
- merchant;
- courier;
- requests;
- feed;
- offers;
- profile;
- onboarding y variantes.

El test histórico PR60-H02 fue reconciliado con el contrato nuevo sin perder su invariante: admin no entra a rutas ajenas, no cicla en MFA y vuelve al home real.

La bitácora documenta una mutación real reintroduciendo el fallback viejo y 3 fallos RED.

CI exact-head ejecutó la suite completa: 118 archivos / 1875 tests GREEN.

H01 queda cerrado.

---

## PR248-H03 — cerrado

**Estado:** `arreglado-verificado`

Se eliminaron los tests que construían:
- un string roto y luego comprobaban el mismo string;
- un `mutatedGuard` local que devolvía `/`.

Los tests permanentes ahora ejercen:
- `evaluateRouteGuard` real;
- ErrorView/NotFoundView reales;
- el auditor real de navegación.

Las mutaciones temporales siguen registradas en bitácora como evidencia RED/GREEN.

H03 queda cerrado.

---

## PR248-H04 — cerrado

**Estado:** `arreglado-verificado`

La bitácora registra ejecución real sobre el Preview de `f09b0088c44f33f767a2912901b956f1a65986ca`:

- viewport 360 × 640;
- scrollWidth = clientWidth = 360;
- overflow horizontal = 0;
- botón «Ir al inicio» = 328 × 48 px;
- anónimo → `/login`;
- merchant completo/incompleto → dashboard/onboarding;
- courier completo/incompleto → feed/onboarding;
- admin AAL1 → MFA hacia applicants;
- admin AAL2 → applicants.

La revisión además hizo una comprobación independiente sobre el deployment con fetch autenticado de Vercel:
- el 404 real responde con la vista «Página no encontrada»;
- el botón visible «Ir al inicio» renderiza `href="/login"`.

El E2E exact-head también quedó GREEN sobre `f09b0088c44f33f767a2912901b956f1a65986ca`.

H04 queda cerrado.

---

## PR248-H02 — único bloqueante residual

**Estado:** `abierto`  
**Categoría:** test-coverage / P08-control-no-cubre-lo-que-dice

La corrección mejoró mucho el scanner:
- detecta `href="/"`;
- `router.push('/')`;
- `router.replace('/')`;
- `redirect('/')`;
- `redirectTo: '/'`;
- `logoHref = '/'`;
- regex frescas por escaneo;
- allowlist por tipo y conteo máximo.

Pero sigue cubriendo **solo literales directos en el punto de navegación**.

Ejemplos que pasan sin ser detectados:

```ts
const target = '/';
router.push(target);
```

```ts
const home = () => '/';
router.replace(home());
```

El repo ya tiene un auditor preexistente que sigue productores indirectos para verificar rutas existentes. T-336 prometió un control que detecte nuevos hardcodes genéricos a `/`; un hardcode almacenado en variable/helper sigue siendo esa misma clase.

### Arreglo esperado

Extender el control de H02 para seguir al menos los productores indirectos simples que el auditor del archivo ya sabe resolver:

1. variable local literal:
   `const target = '/'; router.push(target)`;
2. helper local de retorno literal:
   `const goHome = () => '/'; router.replace(goHome())` o equivalente;
3. si existe `redirectTo` indirecto desde variable local literal, cubrirlo también.

No hace falta construir un parser nuevo ni perseguir flujo arbitrario entre módulos. El alcance mínimo es reutilizar la lógica indirecta ya existente en `route-integrity.test.ts`.

### Tests discriminantes

Agregar fuentes sintéticas que llamen al helper real del scanner:

- variable local `'/'` + `router.push(variable)` → violación;
- helper local que devuelve `'/'` + navegación → violación;
- variable/helper que devuelve `/login` → no violación de root.

Mutación real:
- introducir temporalmente una navegación indirecta root en un archivo de producción auditado;
- el control debe quedar RED;
- restaurar.

---

## CI / flaky ajeno

CI del SHA funcional:
- 118 test files;
- 1875 tests;
- DB 10/10 + 1811/1811;
- build/lint/typecheck/bundle GREEN.

E2E:
- Chromium 20/20;
- global-settings tuvo un timeout al salir de `/login` en T-306, pasó en retry;
- issue #249 abierto para seguimiento;
- no se atribuye a T-336.

## Resultado

H01/H03/H04 cerrados.  
H02 bloquea el merge.  
No hay decisiones 🔵 pendientes.
