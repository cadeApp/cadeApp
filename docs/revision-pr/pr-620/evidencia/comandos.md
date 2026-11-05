# Evidencia y comandos — PR #620

## Ronda 1

**SHA inspeccionado:** `d8180d88e01088691b75f05a3a3be4d19d2d1b9a`. No había checkout ni pnpm accesibles; las mutaciones R1–R7 de aquella ronda eran propuestas NO EJECUTADAS. Ver informe histórico [ronda-1.md](../revisiones/ronda-1.md) y bitácora sesión 1. Comandos de revisión sugeridos: `pnpm typecheck && pnpm lint && pnpm test`, `git merge-tree --write-tree origin/develop HEAD`.

## Ronda 2 — `9ec83512491515463beabf3627efc886b5068f83`

**Revisión independiente por inspección:** se leyó el commit sobre `a5a5ce8`, la bitácora sesión 2, los seis archivos funcionales y tests, las fichas de `develop` y checks del SHA exacto. Este entorno no puede clonar repo (GitHub no resuelve DNS) ni ejecutar tests reales. No se reportan mutaciones propias como hechas.

**CI GitHub Actions:** run 42112155135, job unit 127542208269. Extracto real del log: `Test Files 193 passed (193)`, `Tests 3617 passed (3617)`. También success: typecheck/lint/build/audit/bundle-budget. `db-tests` pendiente al revisar; `e2e-preview` no confirmado. `approval-policy` falló por «Falta el informe completo de revisar-pr sin bloqueantes», coherente con nuevas observaciones. Los RED R1–R11, incluidos 1/42 de R11, son **afirmaciones de bitácora del autor**, no reproducidas independientemente.

### Contramodelos de estado (NO son tests de aplicación)

Se ejecutaron en Node aislado dos modelos de las mismas condiciones fuente, sin imports del repositorio:
```js
let lastQuery='A', pinFromGeocode=true, coords='pin A';
function onInput(nextQuery) {
  if (pinFromGeocode && nextQuery !== lastQuery) {
    pinFromGeocode=false;
    coords=null;
  }
}
onInput('B'); onInput('A');
const autoSearch=!(false || 'A'===lastQuery);
console.log({coords,lastQuery,autoSearch});
// { coords: null, lastQuery: 'A', autoSearch: false }

let activeCoords='pin A', lastIncoming='pin A';
const value=null, defaultZoneCenter=null;
const next=value??defaultZoneCenter??null;
if(next===null) lastIncoming=null;
else activeCoords=next;
console.log({next,activeCoords,hasMarker:true});
// { next: null, activeCoords: 'pin A', hasMarker: true }
```
Son trazas lógicas, no evidencia runtime ni RED. Para un cierre válido hacen falta pruebas reales en el repositorio.

### Casos de prueba exactos para agregar y ejecutar por el agente

**H07-R1** en `create-request-form.test.tsx`: montar con zona Centro y dirección A; blur; responder `found` en A; `fireEvent.change(input,B)` y verificar coords null; `fireEvent.change(input,A)`; blur. **Esperado:** se emite petición nueva id monotónico, misma query A y se recupera pin tras responder; la R2 actual no la inicia. Repetir **H07-R2** en `onboarding-form.test.tsx` para alta y controlar que pin manual nunca se borre.
**Mutación propia a instrumentar tras fix:** retirar la línea que reinicia `lastGeocodeQueryRef` al invalidar un pin derivado, verificar que H07-R1/R2 fallen por falta de solicitud; restaurar desde buffer, GREEN.

**H08-R1** en `map.test.tsx`: controlar `value=A`, `defaultZoneCenter=null`, `showMarkerWhenEmpty=true`, luego `rerender(value=null)`; **esperado**: marcador visual en `AGUILARES_CENTER`, no A, y cero callbacks `onChange`. Repetir con `showMarkerWhenEmpty=false` (marcador ausente) y con centroide de barrio (marcador en barrio). **H08-R2** opcional de integración `create-request-form.test.tsx`: zona con centroid null, geocode found A, editar dirección, confirmar coords null y posición visual neutral con mock de mapa suficiente (si usa `MapPicker` mock debe permitir verificar la posición y no solo `value`).
**Mutación propia a instrumentar tras fix:** quitar solo el reset de `activeCoords` en la rama `next===null` y exigir que H08-R1 falle por marcador A; restaurar contenido desde memoria, GREEN.

### Comandos finales (ejecutar en worktree limpio tras `git pull`)

```sh
git pull --ff-only origin feat/T-423-map-geocoding
git rev-parse HEAD
pnpm exec vitest run src/ui/map.test.tsx src/features/requests/components/create-request-form.test.tsx src/features/merchants/components/onboarding-form.test.tsx
pnpm typecheck && pnpm lint && pnpm test
git diff --check
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-423-map-geocoding
```

Para demostrar RED, crear primero tests de **comportamiento observable** y ejecutarlos contra el SHA R2 (o mutación equivalente con la misma falla), pegar línea `Tests ... failed`, luego arreglar y pegar `Tests ... passed`, mutar quitar guarda y comprobar rojo otra vez. No alterar assertions/mocks para forzar verde ni tests falsos, ni `.only/.skip`, ni desactivar CI. No modificar `docs/revision-pr/**` desde el agente. No usar Docker/Supabase local ni secretos.

## Ronda 3 — SHA funcional `73590e4e4287b519028c9bb177d8dbc66dee75d8`

Inspección GitHub del diff `aa0fe12e...73590e4`: código y tests de H07/H08 coinciden con D07/D08. **Sin checkout ejecutable (git remoto falla por DNS), por lo que NO se corrieron Vitest ni mutaciones independientes.** Un pequeño modelo JS aislado de las ramas de estado confirma transiciones previstas, pero no sustituye el test React y no se usa para declarar `arreglado-verificado`.

- **RED del autor anterior a arreglos** (de `docs/tasks/log/T-423.md` sesión 3, **no re-ejecutado aquí**): map `1 failed | 80 passed (81)`, requests `1 failed | 43 passed (44)`, merchants `1 failed | 40 passed (41)`.
- **Mutaciones del autor** (**no propias**): quitar reset lastQuery en ambos formularios da 1 failed cada uno; quitar reset activeCoords da 1 failed en map; quitar incrementos epoch da 6 failed. No inventar salida de consola adicional.
- **CI real sobre SHA**: run `42114705941`, `unit` job `127551894663`: `Test Files 193 passed (193)`, `Tests 3624 passed (3624)`; typecheck/lint/audit success.
- **Build real fallido:** job `127551895088` de mismo SHA, `pnpm build` → `next/font` `Montserrat` en `src/app/layout.tsx`, `Retrying 1/3...`, `TypeError: Cannot read properties of null (reading '1')` en loader de Next; `bundle-budget` skipped. No acusar cambios de mapa ni declarar root cause externo demostrado.
- **E2E real pendiente:** los runs `workflow_run` usan base SHA de develop; no atribuirlos al SHA de la PR sin resolver target. Un workflow `success` con job e2e `skipped` no es GREEN: corrida `42114932770`, `resolve-pull-request` success pero `e2e-preview` y `report-preview-status` skipped. `.github/workflows/e2e-preview-target.mjs` línea 85: CI sin `success` = `skip`.
- **Sin test real de mutación de revisor** y sin `git merge-tree` local; el log del agente **declara** merge-tree limpio y verificación de analizador; develop no había avanzado respecto de la base al comparar. `verificado_en_sha` debe permanecer null.

### Gates para cerrar una vez esté realmente verde
```sh
git pull --ff-only origin feat/T-423-map-geocoding
git rev-parse HEAD
git diff --check
pnpm exec vitest run src/ui/map.test.tsx src/features/requests/components/create-request-form.test.tsx src/features/merchants/components/onboarding-form.test.tsx
pnpm typecheck && pnpm lint && pnpm test
pnpm build
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
```
Reproducir las mutaciones H07/H08 **en el worktree del agente si se dispone**: retirar en memoria el reset lastQuery de cada form y el reset visual del MapPicker, correr suite dirigida GREEN sin mutar y RED con una única mutación, restaurar en memoria; guardar script completo y logs reales en bitácora del agente. **No alterar expectativas/mocks, no sumar `.skip`, no desactivar el workflow, no inyectar resultados falsos al font loader para pasar.**
