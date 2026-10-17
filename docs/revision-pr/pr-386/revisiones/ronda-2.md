# Revisión independiente — PR #386 / T-363 — Ronda 2

**Fecha:** 2026-10-16 · **SHA efectivamente revisado:** `99e3b2ab097326625da4d58f59718976eb643c96` · **R1:** `20671da`, **commit de revisión anterior:** `1907161`.
**Resultado: SIN BLOQUEANTES DE CÓDIGO NUEVOS (H01/H02 arreglados-verificados), PERO NO APTO PARA MERGE**: CI `build` FAIL y pendiente la secuencia #385 → sincronización de `develop`.
**Decisiones:** se mantienen 1-C y 2-A; ninguna nueva.

## Sincronización, integridad y alcance

- PR abierta, HEAD remoto coincide con `99e3b2a` antes de crear la R2. El autor agregó solo dos commits `d3fca32` (código) y `99e3b2a` (bitácora), ambos posteriores al informe R1; sin rebase detectado.
- Diff desde `1907161`: 5 archivos: `src/features/trips/route-points.ts`, `src/features/trips/components/trip-route-map.tsx`, `src/features/trips/route-map.test.tsx`, `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-363.md`. Respetan lista exacta del prompt y ficha T-363 leída desde `develop`.
- Ningún archivo de `docs/revision-pr/pr-386/**` fue tocado por el agente; la carpeta R1 permanece intacta. No hay reviews ni decisiones nuevas.
- `develop` sigue en `01054b1`; ficha igual a la de R1. PR #385 sigue abierta; GitHub informa `mergeable=true` para #386 en la base actual, pero `git merge-tree` local no disponible sin clon. La integración futura de #385 deberá resolverse primero sin perder las fichas/bitácora de T-363.

## Estado de H01 — ARREGLADO-VERIFICADO

**Código:** `src/features/trips/route-points.ts:17–38,122–173`; `trip-route-map.tsx:367–460`.

- El constructor de recorrido ordena copia de drops por `position` y compone paradas sin saltos; `buildNavigationLegs` limita a 3 waypoints y 2048 caracteres de **URL serializada**; encadena legs con el último stop anterior = origen siguiente. En dirección excesiva reduce tramo hasta dos paradas y si tampoco cabe, `url: null`; UI presenta indicaciones manuales íntegras sin enlaces truncados.
- Los tests cubren 1/4/5/8 drops, intermedia sin coordenadas, dirección unicode larga, orden desordenado, navegación manual, UI R07/C06. La E2E real del HEAD muestra 5 entregas y 2 enlaces con continuidad completa.
- **Batería independiente del revisor:** baseline GREEN y cuatro mutaciones RED tomadas sobre funciones reales del SHA (límite 3→4; omisión de stop fronterizo; quitar límite de longitud; producir URL inválida en lugar de tramo manual). No se reutilizó el script M1–M11 del agente. EVIDENCIA/COMANDOS registra harness completo. No se tocó working tree.

## Estado de H02 — ARREGLADO-VERIFICADO

**Código:** `src/features/trips/components/trip-route-map.tsx:25–71,182–209,283–313`.

- `computeRouteBounds` cubre todos los puntos y añade extensión de 0,002° para puntos coincidentes; `RouteBoundsFitter` toma `useMap()` y llama a `fitBounds(bounds, 32)` bajo `React.useEffect`; la cámara inicia en `defaultCenter`, sin pisar el ajuste desde un center controlado.
- Tests positivos ejercitan extremos -27.48/-27.38, 5 drops, rerender, puntos coincidentes y SDK offline/fallido. E2E post-match con el SDK de Google simulado confirma que se llamó al ajuste con los límites esperados de cinco drops.
- **Batería independiente:** GREEN original de `computeRouteBounds` y `RouteBoundsFitter` (mapa presente/ausente), RED con cinco mutaciones (norte máximo→mínimo, extensión mínima→0, omitir llamada a `fitBounds`, invertir norte/sur, eliminar padding). El mock de E2E registra la llamada, no simula físicamente el movimiento de la cámara: esa limitación queda explícita y no se presenta como prueba visual con SDK real.

## D01 — vigente, sin decisión nueva

Lautaro073 aceptó 2-A: enlaces de Google Maps solo como navegación **externa y voluntaria** en vista del actor autorizado post-match. No autoriza difusión prematch, URLs internas, logs, analítica ni notificaciones. La bitácora registra la excepción; sin cambios a `AGENTS.md`.

## Checks y evidencia

- **CI run [38967624235](https://github.com/cadeApp/cadeApp/actions/runs/38967624235) sobre HEAD exacto `99e3b2a`:**
  - unit **135 suites, 2450 tests PASS**; typecheck, lint, audit PASS; db-tests PASS (`Files=26, Tests=2341, Result: PASS`).
  - **build FAIL**. Stack real: `src/app/layout.tsx` → `next/font`, `TypeError: Cannot read properties of null (reading '1')` dentro del loader de Google Fonts en Next 15.5.26. Ese archivo y la configuración de fuentes **no cambiaron** en la PR. La causa no está demostrada; no atribuirla a T-363 ni etiquetarla como fallo de código por inspección. **bundle-budget SKIPPED** por fallar build.
  - `approval-policy FAIL` por informe/validación requerida; el comentario de revisión no es aprobación.
- **E2E Preview [38967749373](https://github.com/cadeApp/cadeApp/actions/runs/38967749373)**: comprobé en el **log del job 117198417323** el checkout exacto `99e3b2a`, **81 chromium PASS** (incluido test PR386-H01/H02 de cinco entregas, 13,7 s) y **3 global-settings PASS**. Aunque el workflow `repository_dispatch` figure con head_sha de develop, el job hizo checkout del SHA correcto. No inventar fallo ni decir que E2E no corrió.
- **Test independiente del revisor**: ejecución en memoria de secciones de las funciones TS exactas traídas del SHA mediante conector GitHub; sin clonar ni escribir en la rama. Los guards, tipos de TS y hooks externos se sustituyeron por harness mínimo, preservando cuerpos productivos. 3 controles GREEN y 9 mutaciones RED. **No es `pnpm test` ni mutaciones Vitest completas.** Ver [evidencia](../evidencia/comandos.md).
- El autor declara 4 mutaciones adicionales y GREEN 38/38 en bitácora; se contrastaron con el diff/CI, pero no fueron reproducidas literalmente en el mismo script ni se presentan como nuestras.
- No se ejecutó `pnpm build` local ni Docker/Supabase. Revisión del log CI reemplaza verificación de la base local, conforme las reglas de proyecto.

## Puerta de integración / acciones

1. **CI build rojo = bloqueo de merge** aunque H01/H02 estén corregidos. No modificar `src/app/layout.tsx`, fuentes, Next, caché ni workflows desde esta tarea. El commit documental de esta R2 dispara CI normal: revisar su resultado y el loader de fuentes. Si vuelve a fallar, abrir issue técnico separado con enlace a jobs, stack y secuencia mínima reproducible; no maquillar checks ni renombrar tests.
2. **PR #385 abierta:** resolver revert documental de manera separada, con autorización explícita de Lautaro073; después fusionar `origin/develop` a esta rama con merge, nunca rebase/force/amend. Verificar que gana la ficha T-363 ampliada y bitácora de la rama; ejecutar `tools/verify-fichas.test.ts` y comprobar merge-tree. No fusionar #386 antes de eso.
3. Revalidar checks técnicos y E2E contra el SHA final posterior a la sincronización de develop. Si no hay cambios sustantivos ni nuevas fallas, la revisión puede declararse lista para el merge sin otra ronda de corrección de H01/H02.

## Comprobación de límites de alcance y honestidad

Ninguna prueba nueva falsa detectada por inspección: las aserciones de `urlStops` verifican secuencia completa, los spies de `fitBounds` verifican llamada positiva y la E2E usa RPC real con actores autenticados. No se tocó configuración CI. El árbol local no se pudo crear por DNS de GitHub en el contenedor de revisión; los límites se documentan y `verificado_en_sha` solo aplica a la verificación acotada ejecutada sobre los cuerpos del SHA.
