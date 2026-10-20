# Ronda 2 — PR #453 / T-377

**Fecha:** 2026-10-20 · **SHA revisado:** `1aa545786a55bd100e4f810c95222e600b55228d` · **base de la PR:** `develop` @ `03dec5b074e634d6f3895c282e58f7d7e6eb4456`.

## Resultado

**SIN BLOQUEANTES NUEVOS POR INSPECCIÓN; H01–H03 ARREGLADOS SIN VERIFICACIÓN RUNTIME INDEPENDIENTE.**

Se conserva `arreglado-sin-verificar` para los tres en `hallazgos.jsonl`, con `verificado_en_sha: null`: ejecutó los tests GitHub Actions y declaró mutaciones el **autor**, pero este revisor no corrió mutaciones con su propio clon. No se atribuye verificación ejecutada a posteriori.

## Alcance y coherencia

- El diff contra `253fee23692be3e43c22927d87e055c9f15d6d9b` modificó **exactamente 5 archivos**: `src/features/trips/components/trip-route-map.tsx`, `src/features/trips/route-map.test.tsx`, `e2e/specs/map-privacy.spec.ts`, `docs/tasks/T-377.md` y `docs/tasks/log/T-377.md`. Todos permitidos por ficha.
- La ficha leída desde `develop` seguía exigiendo `useMapsLibrary('routes')`; en rama, **solo se reemplazó la decisión «Proveedor y llamada exacta»** por `google.maps.importLibrary('routes')` con rechazo capturado y se extendió «Sin cálculos repetidos» con timeout de 10 s sin reintentos. D1-B/D2-B autorizaron ambos cambios. No se amplió el resto del DoD.
- La PR está abierta como Draft, sin conflicto informado (`mergeable: true`). No se ejecutó `git merge-tree` local.
- Se inspeccionó `route-points.ts`: mantiene validación de **todos** los pines y el orden de entregas por `position`, excluyendo mapa parcial (T-363); la vista de viaje se usa post-match. Distancia del servidor y enlaces siguen sin alteraciones en el diff.

## Resultado H01

**`src/features/trips/components/trip-route-map.tsx:~510`**

Corregido por inspección: en el pie C06 `!isMapAvailable ? 'Mapa no disponible' : streetRouteStatus === 'street' ? 'Recorrido orientativo por calles' : 'Línea recta orientativa'`, `text-primary-dark` intacto. Unit `PR453-H01` comprueba retiro, entrega y entrega intermedia sin pin, SDK FAILED, offline y sin key, incluyendo ausencia de `Polyline`.

**Estado:** arreglado-sin-verificar. No hay reproducción independiente RED/GREEN.

## Resultado H02

**`src/features/trips/components/trip-route-map.tsx:~133-207`**

Corregido por inspección: `StreetRouteLoader` usa `google.maps.importLibrary('routes')` mediante `importRoutesLibrary()`, y `.then(onFulfilled, onRejected)` captura rechazo. Biblioteca que no responde termina en fallback tras 10 s; en la resolución se revisan `active` y `settled` antes de llamar a `computeRoutes`. Limpieza al desmontar o cambiar secuencia.

La prueba unitaria `PR453-H02` comprueba el rechazo, y el E2E de `map-privacy.spec.ts` agrega `routes: 'reject-import'`: rechaza **la biblioteca**, comprueba recta y estado de Maps, enlace y registro vacío de `unhandledrejection` instalado antes de navegar. La prueba sigue pasando por el código real del componente y el mock de `google.maps.importLibrary`, no por un `useMapsLibrary` simulado. No se introdujo dependencia.

**Estado:** arreglado-sin-verificar. No hay reproducción independiente RED/GREEN ni evento real de Google Cloud observado; E2E con mock en CI.

## Resultado H03

**`src/features/trips/components/trip-route-map.tsx:~120-207`**

Corregido por inspección: timers separados de biblioteca y `computeRoutes`, ambos de 10 s. `finish` aplica máximo una vez (`active && !settled`), limpia ambos timers e invalida resultados tardíos. Se preserva la clave por secuencia y no se agregan reintentos.

Los unit tests `PR453-H03` simulan promesa pendiente a 9999/10000 ms, resolución y rechazo tardíos, y comprueban fallback visible. Los tests originales preservan respuesta tardía por cambio de puntos y desmontaje.

**Estado:** arreglado-sin-verificar. No hay reproducción independiente RED/GREEN.

## CI cotejado con logs

- **CI:** https://github.com/cadeApp/cadeApp/actions/runs/39392342174 — success para unit, typecheck, lint, build, audit, db-tests y bundle-budget. El job `unit` del *merge sintético de CI* (HEAD `641c928`, incorpora `1aa545786a55bd100e4f810c95222e600b55228d`) reportó **149 archivos / 2927 tests PASS**, porque el workflow se ejecutó con base más reciente que la PR inicial. El autor reportó `pnpm test` local con **148 archivos / 2914 tests PASS** sobre su rama: no confundir ambos números ni atribuirlos al mismo árbol.
- **E2E:** https://github.com/cadeApp/cadeApp/actions/runs/39392466688 — hizo `git checkout --force 1aa545786a55bd100e4f810c95222e600b55228d` y el escenario `map-privacy.spec.ts` «tras matched» (que ahora incluye `reject-import`) pasó; resumen **91 pruebas Chromium + 6 global-settings PASS**.
- El log del autor reporta RED antes del arreglo **5 failed / 53 passed**, GREEN **58/58**; mutaciones H01 `1 failed`, H02 `1 failed`, H03 sin timer `2 failed`, carga tardía sin guarda `1 failed`, sin settled `3 failed`. Tras cada mutación indica 58/58. **Es evidencia del autor, no reejecución de la revisión.**
- No se ejecutó `pnpm` ni Docker local: no hay un clon de cadeApp accesible en este entorno (la red del contenedor no resuelve GitHub).

## NO TOCAR

- `buildStreetRouteRequest`: `origin`, `destination`, `intermediates` ordenados, `DRIVING`, `fields: ['path']`, `optimizeWaypointOrder: false`, máximo 10 intermedias.
- `extractStreetRoutePath`: al menos 2 puntos finitos y `fitBounds` que incluye geometría de calles.
- Privacidad antes del match, fallbacks T-363, enlace Google Maps, insignia de distancia y ninguna escritura en base de datos.

## Estado para cierre

No se encontraron defectos funcionales nuevos por inspección. **Antes de firmar «arreglado-verificado»** se necesitan controles y mutaciones **ejecutados por la revisión** sobre el SHA del código, con sus líneas reales de salida. La batería independiente propuesta está en `evidencia/comandos.md`; se conserva estado `arreglado-sin-verificar` hasta ejecutarla. **No se aprueba ni mergea** en este paso.

La carpeta documental se agregó en commits posteriores al SHA de código; un cambio exclusivamente documental no requiere otro CI verde, según decisión vigente de Lautaro073.
