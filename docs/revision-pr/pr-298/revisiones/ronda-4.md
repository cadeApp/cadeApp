# Informe revisar-pr — PR #298 / T-314 — Ronda 4

**Fecha:** 2026-10-08  
**SHA revisado:** `0b5479059927d1f3ebdf56a85a0182ad31c1b6b1`  
**Resultado:** **CON BLOQUEANTES (2: H07, H05)**. No aprobar ni mergear.

## Alcance y nueva evidencia

Se revisaron el diff completo posterior a la Ronda 3 (3 commits) y la ficha de T-314 de `develop`. Solo se modificaron `e2e/specs/map-privacy.spec.ts` y `docs/tasks/log/T-314.md`; agy no alteró `docs/revision-pr/**`. La comparación completa de la PR contiene 9 archivos, todos permitidos. GitHub reporta `mergeable: true`, 10 commits por delante y 6 por detrás de `develop`; no se realizó `git merge-tree` local por indisponibilidad del clon.

### CI sobre el SHA exacto

- Run `37725958413` — **CI success**: unit, typecheck, lint, build, db-tests, audit y bundle-budget.
- Run `37726083350`, job `113144546299` — **e2e-preview failure: 47 passed, 2 failed**, en los casos de `MapPicker`.
- **T-314 por caso**: privacidad GREEN, alta comercio **RED**, solicitud **RED**, post-matched GREEN, graceful GREEN, cero llamadas Google GREEN.

## H07 — El mock no implementa `Marker.setDraggable` — BLOQUEANTE (alto; diagnóstico de causa raíz)

**Archivo:** `e2e/specs/map-privacy.spec.ts:232-238`  
**Detección:** logs y trazas del trusted run exacto + probe aislado sobre el constructor del stub.

Las dos pantallas que quedan rojas no muestran `map-picker`; el snapshot real muestra, respectivamente, `No pudimos cargar el alta del comercio` y `No pudimos preparar el formulario de envío`, en el boundary de error de Next.js. Las trazas del browser contienen:

```text
TypeError: t.setDraggable is not a function
at ... @vis.gl/react-google-maps ... /chunks/...js:5:10187
```

El SDK simulado que está en el **spec** implementa `function Marker(opts)` con solo `setPosition`, `getPosition`, `setMap` y `addListener`. **No implementa `setDraggable`**, requerido por el componente de producción `MapPicker` cuando usa `Marker` clásico en lugar de `AdvancedMarker` (sin mapId). Esta es la causa concreta que faltaba en la revisión R3; la compatibilidad de AdvancedMarker/Settings ahora funciona para el recorrido postmatched.

En las trazas se ve además un error **secundario de cleanup**:

```text
TypeError: Cannot read properties of undefined (reading 'filter')
at Object.remove (...script Google Maps mock...)
```

Los `remove()` de `Map.addListener` y `AdvancedMarkerElement.addListener` asumen que `this._listeners[name]` existe; el cleanup puede haber borrado el registro.

**Arreglo mínimo solo en spec:**
1. Completar el constructor `Marker`: `setDraggable/getDraggable`, `setMap/getMap`, `setTitle`, `setVisible`, `setOptions`, `setPosition/getPosition`, `addListener` con almacenamiento de handlers. Implementar de verdad los métodos que `@vis.gl/react-google-maps` invoca, no simular un elemento con `data-testid`.
2. Volver **idempotente y null-safe** `remove()` en `Map` y `AdvancedMarkerElement`: `(this._listeners[name] ?? []).filter(...)`. No ocultar excepciones del caso feliz ni producir un falso estado verde.
3. El caso 6 `0 llamadas a Google` estaba GREEN **a pesar del crash del mapa**; conservar `interceptedUrls > 0` y `unexpectedGoogleUrls=[]`, pero agregar la expectativa independiente de que `[data-testid="map-picker"]` esté visible y que no haya boundary de error. Un mock puede interceptar tráfico y seguir sin ser funcional.

**RED/GREEN propio (ejecutado):** se extrajo el constructor `Marker` de la fuente archivada en la traza exacta. Un harness Node aislado, guardado íntegro en `evidencia/comandos.md`, devolvió:

```text
BASELINE Marker.setDraggable: RED
MUTACIÓN sin Marker.setDraggable: RED
exit=1
```

No se lo cuenta como mutation proof completa porque **el control base sigue rojo**. Después de arreglar, el mismo harness debe devolver `BASELINE GREEN / MUTANTE RED`. El E2E integrado real debe terminar GREEN sobre el nuevo SHA.

## H05 — Evidence / DoD pendiente — BLOQUEANTE de cierre (medio)

**Archivo:** `docs/tasks/log/T-314.md` + PR body.

El autor corrigió la ambigüedad de `pnpm test`: los 2 fallos locales corresponden a un worktree T-339 no versionado; CI sobre árbol limpio sí pasa. La casilla del DoD E2E ya se dejó [ ] y no se inventó GREEN local ante el fail-closed; estas dos mejoras se reconocen.

**Pero** la última bitácora termina antes del trusted run actual `37726083350` y el E2E está rojo. Agregar la sesión con ese resultado (47/2), corrección del Marker, comando y SHA nuevos; solo marcar DoD E2E [x] tras haber inspeccionado un trusted `e2e-preview` GREEN del mismo SHA. Las antiguas afirmaciones no reproducidas de mutaciones no son validación independiente.

## H01 / H02 / H03 / H04 / H06 — Sin nuevo bloqueante propio, pero sin certificar mutaciones

- **H01**: cambio a `page.route + route.fetch + response.text` y aserciones DOM+red/RSC; caso privacidad pasó en CI del SHA.
- **H02**: `heading.locator('xpath=../..')` y `deliveryGps count=1` corrigen la colisión previa por inspección; el caso no alcanza el GPS porque MapPicker crashea. Se conserva como arreglado-sin-verificar.
- **H03**: el postmatch pasó en trusted E2E con markers y URL canónica.
- **H04**: mock intercepta >0 y no presenta unexpected; pasó en trusted, pero se requiere la comprobación adicional de UI saludable descrita en H07.
- **H06**: casos relevantes navegan autenticados como merchant o en contexto separado; el problema de sesión previo fue corregido.

No se afirma que la mutación original de H01/H02/H03 fue reproducida independientemente. `arreglado-sin-verificar` es intencional hasta contar con prueba RED/GREEN válida.

## Acciones de R5

- [ ] H07 constructor Marker con métodos reales + listeners robustos.
- [ ] El E2E de las 2 pantallas completa su flujo: 500 nudge, alerta fuera de rango, regreso y GPS; no basta con que renderice MapPicker.
- [ ] El mock test 6 exige mapa visible, no solo contador.
- [ ] Evidencia de CI E2E **49 passed / 0 failed**, o nuevo resultado real (puede cambiar el total).
- [ ] H05 bitácora actualizada según run final sin claims ficticios.
- [ ] Checks CI normales success del SHA.
- [ ] No modificar producción, secretos, environments, workflow, fixture ni config.

**Sin decisiones humanas pendientes.** No requiere que Lautaro cambie API keys: el SDK simulado es responsable del TypeError observado.
