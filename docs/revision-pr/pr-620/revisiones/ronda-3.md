# Informe revisar-pr — T-423 / PR #620 — Ronda 3 — 2026-11-05

**SHA funcional revisado:** `73590e4e4287b519028c9bb177d8dbc66dee75d8`. **Base:** `develop` en `7809c3991767bd1770b1e5d3d1f945ac38c34463`. Padre: commit documental de R2 `aa0fe12e1e4e5748d39db3eea411be0d47637af0`.

**Resultado: SIN NUEVOS BLOQUEANTES FUNCIONALES POR INSPECCIÓN. NO APTO PARA MERGE TODAVÍA: BUILD FAILED Y E2E DEL SHA SIN GREEN REAL.**
No aprobado ni mergeado; PR seguía Draft. La revisión **no ejecutó** vitest, mutaciones propias, ni Playwright en un checkout de ese SHA (red DNS de GitHub ausente en el contenedor). La evidencia R3 RED→GREEN y mutaciones aportadas por el autor se contrastan con implementación/tests nuevos y el resultado CI unitario, pero **no** se elevan a `arreglado-verificado`.

## Comparación exacta
`aa0fe12e...73590e4`: un único commit funcional, 7 rutas: bitácora y seis archivos de código/tests de H07 y H08. Ninguna modificación a `docs/revision-pr/**` por el agente. No se cambian contratos, migraciones, dependencias, workflows, fichas o plan en este intervalo; D04 de R1 sigue aceptada. Se releen la ficha `docs/tasks/T-423.md` y el contrato `CC-045` desde `develop`; `develop` conservaba la base indicada al comparar.

### PR620-H07 — ARREGLADO SIN VERIFICACIÓN PROPIA
- `src/features/requests/components/create-request-form.tsx` ~L154–162 y `src/features/merchants/components/onboarding-form.tsx` ~L156–165: la rama que borra el pin derivado al editar la consulta ahora reinicia `lastGeocodeQueryRef.current = ''`. Secuencia A→B→A vuelve a disparar en blur; al pin manual no lo borra.
- Tests nuevos en ambos formularios: buscan A, `found(A)`, B borra coords, retorno a A y nuevo `id` monotónico; además caso pin manual A→B→A sin petición. No hay debilitamiento de aserciones detectado en el parche.
- La bitácora **declara** RED antes del arreglo: requests `1 failed | 43 passed (44)`; onboarding `1 failed | 40 passed (41)`; GREEN `44/44` y `41/41`; mutación del reset luego roja. No se reproduce independientemente desde este revisor. **Estado:** `arreglado-sin-verificar`, `verificado_en_sha=null`.

### PR620-H08 — ARREGLADO SIN VERIFICACIÓN PROPIA
- `src/ui/map.tsx` ~L362–375: en `value=null` y sin centroide, si se borró una selección externa existente (`wasCleared`), reinicia `activeCoords` a `AGUILARES_CENTER` y solicita sincronización de cámara, **sin llamar a `onChange`**. Con barrio presente prevalece su centro por el camino ya existente; `showMarkerWhenEmpty=false` oculta marcador.
- Tres tests nuevos para marcador con centro nulo, centro disponible y `showMarkerWhenEmpty=false`. La bitácora **declara** RED anterior `map.test.tsx: 1 failed | 80 passed (81)`, GREEN `81/81` y mutación del reset roja. No se reproduce independientemente. **Estado:** `arreglado-sin-verificar`.

### H01–H06
No se modificó código funcional de H01–H06 respecto a R2. Las salvaguardas de null externo/epoch, desmontaje, cancelación, query editada, timeout, vacío y `fulfillOnZeroResults` persisten por inspección. Estado de los seis: `arreglado-sin-verificar` (no inventar `verificado_en_sha`).

## CI / DoD — gate real incumplido
**Job unit de SHA exacto:** `42114705941 / 127551894663` muestra en logs `Test Files 193 passed (193)` y `Tests 3624 passed (3624)`, y scripts secundarios de Node verdes. Typecheck, lint y audit green.
**BUILD FALLÓ:** `42114705941 / 127551895088` en `pnpm build` → `next build`, `src/app/layout.tsx` → `next/font/google` `Montserrat`, después de varios `Retrying 1/3...`, termina con `TypeError: Cannot read properties of null (reading '1')` en Next.js `dist/compiled/@next/font/dist/google/loader.js:122:78`. **Hecho:** build no pasa. **Inferencia, no prueba:** es probablemente fallo externo/intermitente de obtención o parseo de fuente, puesto que no hubo cambio de `src/app/layout.tsx` ni de dependencias en R3 y builds anteriores pasaron. No atribuirlo a H07–H08 ni afirmarlo definitivamente sin reintento/diagnóstico.
**E2E no cumplido:** `e2e-preview-target.mjs` devuelve `skip` cuando el CI fuente no termina con `conclusion=success`; comprobada la lógica. En una corrida workflow_run, `resolve-pull-request` success y jobs `e2e-preview`/`report-preview-status` `skipped` **NO son E2E GREEN**, aunque GitHub etiquete el workflow completo `success`. Para DoD se exige `e2e-preview` y commit status del SHA del PR exitosos, además de resultado Playwright real. `bundle-budget` skipped por build. `db-tests` en curso al corte.

## Decisión técnica delegada D09 — recuperación sostenible del build
- **Opción A (elegida):** tratar una caída aislada de `next/font/google` como fallo de gate a investigar y validar con un nuevo **CI automático normal** (por ejemplo, el disparado por el commit documental de revisión), y comprobar el log del job `build` y E2E reales; no hacer cambios de código hasta observar si se reproduce. Beneficio: no contaminar T-423 con corrección ajena y mantiene el guard de producción. Riesgo: si el proveedor falla recurrentemente, vuelve a atascar builds.
- **Opción B:** migrar Montserrat a `next/font/local` con fuentes autoalojadas/versionadas; elimina dependencia de red en build y es mejor solución a largo plazo si la falla es repetida. Costes: nuevos assets/licencias, bundle/peso, métricas visuales, posibles regresiones tipográficas; requiere issue/ficha aparte y pruebas de build con red bloqueada.
- **Alternativa C:** inyectar respuestas falsas a Next Fonts, saltarse `build` o modificar workflow para verde. Menor esfuerzo aparente, pero elimina prueba de artefacto real, puede ocultar fallas y desobedece la regla de tests. **Descartada**.
- **Recomendación D09:** A en este incidente único, B como tarea de estabilidad separada si se confirma repetición. **No se acepta C.** Sólo cambiaría de opinión si otro CI del mismo código falla por el mismo import y se reproduce con proveedor disponible/ausente. Comparar SHA, logs de proveedor y fallo exacto; nunca declarar verde un build saltado.
- **No exigir otro CI verde exclusivamente por el commit de bitácora/revisión:** el gate relevante para merge es CI y E2E **efectivamente ejecutados** sobre un SHA funcional equivalente; el commit documental automático puede aportar validación de infraestructura si el código no varió.

## Cierre
**Código:** sin nuevas incidencias de geocoding detectadas por inspección. **Proceso:** bloqueado para merge hasta `build`, `bundle-budget`, `db-tests` y E2E real en verde, junto con verificación independiente de los arreglos si se puede ejecutar. **Privacidad:** issue #619 antes del rollout real, no atribuible al commit.
