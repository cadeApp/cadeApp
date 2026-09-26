# Evidencia — PR #109 / T-116 / Ronda 1

## SHAs
PR head: 9acf2ac6f0f053a4452e56c96077386fcd5aa252
develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
compare: ahead 4 / behind 0

## Commits
dfc786a chore(T-116): start task
6790c92 feat(map): implement Google Maps component and pin selector
2edfbf6 docs(T-116): session log
9acf2ac chore(T-116): sync with develop

dfc786a ya agrega src/ui/map.tsx como stub y fija su API.

## Contract-change
Búsqueda CC-011: única coincidencia = PR #109. No hay CC separado.
D01: Lautaro073 eligió 1-A.

## Google loader
map.tsx:92 acceso directo a NEXT_PUBLIC_GOOGLE_MAPS_API_KEY.
map.tsx:133 isMapAvailable = Boolean(apiKey) && isOnline.
map.tsx:292 APIProvider.
map.tsx:299 onCameraChanged.
No hay onError, useApiLoadingStatus ni APILoadingStatus.FAILED.

Documentación oficial de @vis.gl consultada: APIProvider admite onError y useApiLoadingStatus expone FAILED.

## Cámara
map.test.tsx:127 nombra desplazamiento del mapa.
map.test.tsx:142 ejecuta ArrowUp.
No invoca onCameraChanged.

## Centroides C01
src/features/merchants/queries.ts: ZoneOption = id + name.
select = id, name.
C01 no pasa defaultZoneCenter.

## Lazy-load / bundle
C01 y C03 importan MapSkeleton desde @/ui/map y también dynamic import de @/ui/map.

CI #430:
- merchant/onboarding 145 kB
- merchant/requests/new 163 kB
- courier/feed 179 kB

CI #455:
- merchant/onboarding 165 kB
- merchant/requests/new 163 kB
- courier/feed 179 kB

Compare bdafee8...ef09bb8: sin cambios de onboarding entre bases.

## Cobertura CI #455
Test Files 68 passed.
Tests 764 passed.

src/ui/map.tsx:
- statements 97.26%
- branches 91.37%
- funcs 80%
- lines 97.26%
- uncovered 98, 300-307

## Evidencia visual / axe
Tree del head: sin capturas T-116.
Comentarios PR al iniciar: 0.
map.test.tsx: sin axe.
package.json: sin @axe-core/playwright y sin @playwright/test.

## Barrido
.only 0
.skip 0
sleep 0
any 0
@ts-ignore 0
hex arbitrarios 0

Direct env detectado en src/ui/map.tsx.

CI #455 se consultó puntualmente como evidencia; no se usa su verde como cierre.
