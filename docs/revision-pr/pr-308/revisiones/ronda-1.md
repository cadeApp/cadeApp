# Informe independiente PR #308 · T-350 · Ronda 1

**2026-10-08. SHA del autor verificado:** `823d5cc05ec7debf93c47de66df06469c0e43b0c`. **Destino:** develop. **Dictamen:** CON BLOQUEANTES (1). No apruebo ni mergeo.

## Alcance y contratos

Leí la ficha original `docs/tasks/T-350.md` de develop y la comparé con la rama. Siete archivos cambiados, todos de la lista permitida: tres componentes de viaje, dos tests, ficha y bitácora. No se añadieron dependencias, E2E temporales, cambios de tokens globales, SQL ni parches DOM.

Las únicas modificaciones de producción son:
- `src/features/trips/components/trip-courier-view.tsx:112`: «Cobrás al entregar» recibe `text-primary-dark`.
- `src/features/trips/components/trip-merchant-view.tsx:88`: texto pendiente «Retirado» recibe `text-primary-dark` sin tocar la condición existente.
- `src/features/trips/components/trip-route-map.tsx:271`: «Ruta directa sin desvíos» recibe `text-primary-dark`.

Las tres pruebas nuevas exigen la clase correcta y prohíben la regresión a `text-primary`: `components.test.tsx:366-387` (R07/C06) y `route-map.test.tsx:406-412` (mapa). La ficha únicamente marca requisitos cumplidos, sin ampliarlos.

## Verificación independiente de la evidencia RED/GREEN

La [PR temporal #307](https://github.com/cadeApp/cadeApp/pull/307) está cerrada **sin merge**, como exige T-350. Comparé los SHA de blobs: los cinco archivos de producción/tests de T-350 en el HEAD final de #307 (`39e83875`) son **idénticos** a los de #308. Los E2E provisionales, el spec T-309 y el paquete axe quedan exclusivamente en #307.

Descargué los logs reales de GitHub Actions:

| Run `e2e-preview` de #307 | Resultado |
|---|---|
| `37752295736` | GREEN R07, C06 y `DoD: axe AA en viaje` (T-309) |
| `37755123346` | RED C06: falta heading «Repartidor asignado» con rol equivocado; RED mapa: `route-map-fallback` = 1 cuando se espera 0 |
| `37757764311` | GREEN final R07, C06 y T-309 viaje |

Los tres tests objetivo son reales: usan `AxeBuilder` con seis tags WCAG, `violations=[]`, `passes>0`, roles reales, ausencia de fallback, dos pines y el contenedor `.gm-style`. El spec de T-309 no se tocó. El defecto `aria-hidden-focus` original provenía del `alertdialog` degradado del SDK de Maps; la evidencia GREEN usa un Map ID válido en Preview y no altera el DOM de Google.

**No declarar GREEN del job completo:** los runs finales tuvieron 39 tests PASS y 8 FAIL, correspondientes a otros flujos (5 `main-flow`, 2 `notifications`, 1 axe onboarding T-351). El resultado GREEN aquí es por **test de T-350** y está comprobado en logs. Los E2E corrieron en #307, no directamente sobre el HEAD de #308; la identidad de cinco blobs permite atribuir el cambio bajo prueba, no todo el árbol.

## PR308-H01 — BLOQUEANTE alto — se perdió historial de la bitácora

**Archivo:** `docs/tasks/log/T-350.md:6`. El contrato mergeado en develop contenía dos sesiones completas: `## 2026-10-08 — alta de tarea` y `## 2026-10-08 — ronda 1 de revisión de la ficha: PR305-H01, H02 y H03 (Lautaro073, agente)`. El autor **eliminó ambas** en el diff y las reemplazó por sesiones nuevas de implementación. La instrucción de la bitácora pide «una entrada por sesión, la más nueva al final»; sustituir el archivo borra decisiones previas, trazabilidad del diseño de T-350 y evidencia histórica de la revisión de su ficha.

**Corrección cerrada:** recuperar **íntegras y sin reescribir** las dos entradas originales de `origin/develop:docs/tasks/log/T-350.md`; después conservar íntegramente las nuevas sesiones del PR en orden, anexando un último registro de esta corrección. No modificar fichas, código ni tests para este hallazgo. No duplicar encabezado ni apartados. El test de preservación independiente exige ambas cabeceras: la versión de develop PASS; el HEAD revisado FAIL; un fixture sintético que conserva original + nuevas sesiones PASS, y eliminar cualquiera de las dos secciones vuelve a FAIL (2/2 mutaciones detectadas). **El fixture no es una ejecución real sobre un arreglo todavía inexistente.**

## Checks y operación

Para `823d5cc`, GitHub Actions: `unit`, `typecheck`, `lint`, `build`, `audit`, `db-tests`, `bundle-budget` **success**. Logs: 123 archivos Vitest y **1945/1945** tests, 75 workflows PASS, 6 ADR PASS, `db-tests` **1854 PASS + 10 PASS**. No ejecuté tests localmente ni modifiqué archivos del autor.

Bloqueos externos a H01:
- **Vercel=failure**, descripción exacta `Deployment rate limited — retry in 24 hours`, no falla del build. Debe haber un deployment/check correcto para el HEAD final antes de mergear si Vercel es check requerido.
- **approval-policy=failure** por no existir todavía un informe independiente **SIN BLOQUEANTES** en el body. No se debe inventar ni forzar mientras H01 esté abierto.
- La rama está **2 commits detrás de develop**, que integró T-351 (#306) y T-314 (#298, E2E mapas). GitHub hoy dice mergeable=true, pero corresponde sincronizar con merge **normal** de develop, conservar todo y revalidar.
- **Comprobación manual para Lautaro073:** el Map ID fue demostrado solo en Preview. `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` es opcional en `src/lib/env.public.ts`; `TripRouteMap` emplea `AdvancedMarker`. Verificar que el despliegue de **Production** esté configurado y muestre los pines correctamente. No se consultaron secretos ni se cambia configuración desde esta revisión.

**Dictamen:** CON BLOQUEANTES (1 del diff, H01). Los checks operativos también deben quedar aptos. No hay decisión técnica nueva sobre el mapa: se respeta la decisión de solucionar el error de Google por configuración oficial, no por manipulación del DOM. No se aprueba ni mergea.
