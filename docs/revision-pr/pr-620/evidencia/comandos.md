# Evidencia y comandos — revisión PR #620

**SHA inspeccionado:** `d8180d88e01088691b75f05a3a3be4d19d2d1b9a`. No hay clon ni `pnpm` accesible sobre ese código desde esta sesión. **Las pruebas/mutaciones que siguen son instrucciones no ejecutadas**, no evidencia RED/GREEN fabricada.

1. `map.tsx`: `if(next===null)...return` sin epoch; Geocoder `.then(onOutcome)` sin cleanup; falta resultado para whitespace; no plazo cuando `useMapsLibrary` retorna null.
2. `create-request-form.tsx`: `geocodeRequest` permanece al ocultar/remontar y tras callback; cambios en texto o barrio no invalidan consulta.
3. `onboarding-form.tsx`: cambio de dirección/barrio y «Quitar ubicación» no cancelan query.
4. `map.test.tsx`: test vacío exige `onGeocodeResult` nunca invocado. CC-045 exige terminar el pedido.
5. Bitácora M1–M11 RED y 72/35/36 verdes: declaraciones del autor, **no verificadas por esta revisión**.

## Comandos seguros a ejecutar en el clon del agente

```sh
git pull --ff-only origin feat/T-423-map-geocoding
git rev-parse HEAD
git diff --check
pnpm exec vitest run src/ui/map.test.tsx src/features/requests/components/create-request-form.test.tsx src/features/merchants/components/onboarding-form.test.tsx
pnpm typecheck && pnpm lint && pnpm test
node docs/revision-pr/analizar.mjs verificacion
git merge-tree --write-tree origin/develop HEAD
```

**Batería independiente de reproducción:** añadir estos test-cases funcionales primero, correrlos RED contra comportamiento actual y GREEN después del arreglo:
- **R1:** MapPicker `value=A` + geocode pendiente; rerender `value=null` (y otro caso `defaultZoneCenter=A`), resolve B ⇒ no callback, no pin repuesto.
- **R2:** MapPicker con Promise en curso, unmount, resolve ⇒ ni onChange ni onGeocodeResult.
- **R3:** DropCard consulta A→found, pin manual B, ocultar y reabrir ⇒ el MapPicker nuevo no recibe request usada ni provoca nuevo Geocoder.
- **R3b:** DropCard consulta A, ocultar, GPS B, resolver A ⇒ B prevalece.
- **R4:** requests y onboarding: blur A, editar dirección y barrio a B antes del resolve A ⇒ A no actualiza pin; publicar no enlaza B con pin A.
- **R5:** biblioteca de geocoding no llega, o Promise no resuelve; con temporizadores falsos, timeout ⇒ `unavailable` exactamente una vez, se habilita reintento.
- **R6:** `geocodeRequest={id:3,query:'   '}` ⇒ no geocoder, callback `not_found` una vez, incluso sin API key.
- **R7 (mejora):** `ZERO_RESULTS` con `fulfillOnZeroResults:true` y `results:[]`, muestra `not_found`.

**Mutaciones independientes después del fix:** eliminar una por vez la invalidación A→null, el cleanup de unmount, la cancelación al ocultar, la comparación de query actual, el timeout y el callback de query vacía. En cada caso correr el test dirigido y verificar RED real; restaurar el contenido original desde buffer en memoria, nunca `git checkout` para mutaciones. Guardar línea `Tests ... failed`, luego `Tests ... passed`. No fabricar tests, cambiar expectations para verde, desactivar checks ni usar mocks que esquiven producción. El autor solo escribe resultados en bitácora; el revisor verifica en ronda nueva.

CI run `42108336850` sobre d8180d88: typecheck/lint/unit/build/bundle-budget success al consultar, db-tests en curso. `e2e-preview` no verificado. Sin nuevas mutaciones SQL; no usar Docker/Supabase remoto, Vercel ni secretos. Falta correr `node docs/revision-pr/analizar.mjs verificacion` desde clon accesible antes de cerrar.
