# Informe de revisión — PR #295 / T-338 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/295  
**HEAD revisado:** `6a35d87fb1c02bcdbe7956ca4c37dc47581a6c3a`  
**Base:** `develop` @ `a773c05cc488a1fc60bfb36512cdca35d12d1271`  
**Fecha:** 2026-10-07

## Resultado

**CON BLOQUEANTES (6).**

La rama está sincronizada con el `develop` actual: el base SHA del PR coincide con el HEAD de `develop` y GitHub la reporta mergeable. Los 9 archivos funcionales modificados están dentro de «Archivos permitidos» de T-338. No hay cambios en la ficha T-338, contratos, auth, middleware, dependencias ni workflows.

La PR está todavía en su fase RED inicial: la propia bitácora declara que falta la implementación productiva. Esta ronda revisa además si los controles RED que ya se escribieron pueden proteger el DoD antes de que el agente complete el código.

No se inspeccionó CI: según el procedimiento de revisión, mientras hay bloqueantes la ronda es estática + evidencia propia. Tampoco se levantó Supabase ni Docker.

## PR295-H01 — La PR sigue en fase RED y no contiene la implementación productiva del DoD

**Severidad:** alta · **categoría:** correctness · **patrón:** P15-entregable-declarado-pero-no-ejecutable.

El diff cambia tests y agrega stubs, pero no modifica los archivos productivos que materializan el objetivo:

- `src/app/manifest.ts` sigue con `start_url: '/'`;
- `public/sw.js` sigue en `cadeapp-shell-v1`, precachea `/`, usa `/` como fallback offline y como URL por defecto del click;
- `src/app/page.tsx`, login, register y legal siguen sin los guards/componentes standalone;
- `src/features/notifications/install/is-ios.ts` sigue duplicando su propia detección;
- `is-standalone.ts` devuelve siempre `false`;
- `standalone-redirect.tsx` devuelve siempre los children;
- `standalone-back-link.tsx` ignora `standaloneMode`.

Esto coincide con la bitácora, que todavía enumera toda esa implementación en «Falta». Por lo tanto el PR no es mergeable por funcionalidad aunque sea correcto abrirlo Draft desde el primer push.

**Corrección:** completar el código productivo solo después de endurecer los controles de H02–H06.

## PR295-H02 — Los tests de navegación prueban helpers aislados, no las cuatro páginas que deben integrarlos

**Severidad:** alta · **categoría:** test-coverage · **patrón:** P08-control-no-cubre-lo-que-dice.

`standalone-navigation.test.tsx` importa únicamente:

- `./is-standalone`;
- `./standalone-back-link`;
- `./standalone-redirect`.

No importa ni renderiza `HomePage`, `LoginPage`, `RegisterPage` ni `LegalIndexPage`.

Así, una implementación que haga perfectos los dos helpers pero **no los conecte a ninguna página** puede dejar esta suite verde. La rama actual demuestra que las páginas pueden permanecer intactas sin que el archivo de test tenga ninguna dependencia estructural con ellas.

El DoD pide comportamiento de las páginas, no solo de helpers reutilizables. Es el mismo patrón recurrente P08: el control mide un proxy barato del invariante.

**Corrección:** conservar tests unitarios de helpers, pero sumar integración real con las cuatro páginas (o una prueba de wiring equivalente que importe esos módulos y falle si se restaura el `Link href="/"` original o si se quita el guard de Home).

**Mutaciones RED exigidas:** una por integración: quitar `StandaloneRedirect` de Home; volver login a `Link href="/"`; volver register a `Link href="/"`; volver legal a `Link href="/"`. Cada mutación debe poner rojo su caso específico.

## PR295-H03 — La bitácora atribuye el RED a páginas que el test no importa ni renderiza

**Severidad:** alta · **categoría:** test-coverage · **patrón:** P03-comentario-contradice-codigo.

La bitácora dice que `standalone-navigation.test.tsx` tuvo cuatro fallos:

- “HomePage no redirige a /login”;
- “LoginPage no oculta volver”;
- “RegisterPage y LegalIndexPage no cambian destino”.

Pero el archivo no importa esas páginas: los cuatro fallos corresponden a los stubs `StandaloneRedirect` y `StandaloneBackLink`.

No se puede usar esa salida como evidencia de que las páginas quedaron cubiertas. Es el patrón de AG-70: el rojo debe copiar lo que realmente falló, no lo que se esperaba que el test representara.

**Corrección:** una vez que H02 agregue integración real, repetir RED y registrar en una **entrada nueva** de bitácora los nombres/salidas reales. No reescribir la entrada histórica.

## PR295-H04 — Ningún control obliga a `is-ios.ts` a reutilizar `isStandalone()`

**Severidad:** media · **categoría:** test-coverage · **patrón:** P08-control-no-cubre-lo-que-dice.

La ficha exige explícitamente extraer `isStandalone()` y reutilizarlo desde `is-ios.ts`. El PR agrega tests del helper nuevo, pero `is-ios.ts` no cambia y el test preexistente de `isIosSafariNonStandalone` solo verifica comportamiento manipulando `navigator.standalone`.

Por eso se puede implementar `isStandalone()` y dejar la duplicación vieja dentro de `is-ios.ts`: ambos conjuntos de tests pueden quedar verdes y el requisito de reutilización seguir incumplido.

**Corrección:** hacer que `is-ios.ts` importe y use `isStandalone()`, y agregar un test que mockee el helper de modo que el resultado de `isIosSafariNonStandalone` dependa de él. La mutación RED es volver a la lógica duplicada anterior: el test debe fallar.

## PR295-H05 — El test offline acepta texto plano aunque la ficha exige HTML mínimo inline

**Severidad:** media · **categoría:** test-coverage · **patrón:** P08-control-no-cubre-lo-que-dice.

La decisión de T-338 pide que la reserva sin conexión sea una respuesta propia «Sin conexión» **HTML mínimo inline**.

El test nuevo solo afirma:

- status `503`;
- body contiene «Sin conexión»;
- body no contiene «cadeApp Shell»;
- no se consulta `cache.match('/')`.

Si la implementación elimina el fallback al cache pero devuelve exactamente `new Response('Sin conexión', { status: 503 })`, el control queda verde aunque la respuesta siga siendo texto plano.

**Corrección:** exigir al menos `Content-Type: text/html; charset=utf-8` y estructura HTML mínima en el body.

**Mutación RED:** reemplazar temporalmente el HTML por texto plano «Sin conexión»; el test debe ponerse rojo.

## PR295-H06 — El E2E verifica solo el estado final y no detecta un flash visible de la landing

**Severidad:** media · **categoría:** test-coverage · **patrón:** P08-control-no-cubre-lo-que-dice.

El caso standalone hace:

1. `page.goto('/')`;
2. espera que la URL termine en `/login`;
3. recién entonces afirma que el heading de la landing no está visible.

Una implementación que renderice la landing, espere a `useEffect` y luego haga `router.replace('/login')` puede mostrarla durante un frame y aun así satisfacer ese test. El objetivo central de la ficha es que en standalone la landing **no se muestre nunca**, y las notas piden evitar ese destello sin romper SSR/hidratación.

**Corrección:** el componente productivo debe ocultar/redirigir antes del paint visible (sin side effects durante render), y el E2E debe incorporar una sonda de visibilidad durante la transición, no solo después del redirect.

**Mutación RED:** cambiar temporalmente el guard por una variante que renderice children y redirija en `useEffect`; el E2E reforzado debe detectar que la landing fue visible.

## Puntos correctos de la fase RED

- `manifest.test.ts` fija `start_url === '/login'`, `id === '/'` y `display === 'standalone'`.
- `sw.test.ts` ya intenta proteger tres regresiones importantes: `/` fuera del precache, versión de cache y fallback del notification click.
- `is-standalone.test.ts` enumera Android/desktop, iOS y navegador común.
- El E2E usa `addInitScript` para emular `matchMedia('(display-mode: standalone)')`, que es la vía correcta para el Preview.
- El diff funcional está totalmente dentro del alcance de la ficha.
- No aparecen dependencias nuevas ni cambios de contratos.

## Pendiente manual obligatorio

La ficha pide verificar en un **Android real** la PWA instalada antes y después del cambio y anotarlo en la bitácora. Esta revisión no puede certificar ese paso desde GitHub; debe quedar completado por una persona antes del cierre final de T-338.

## Cierre

No hay decisiones 🔵 en esta ronda.

Primero hay que endurecer los controles H02–H06; después implementar H01 y demostrar RED→GREEN sin crear tests falsos, no adulterar expectativas para que pasen y sin tocar `docs/revision-pr/**`.

La revisión independiente no aprobó ni mergeó la PR.
