# PR #109 · T-116 — Ronda 1 independiente

- SHA revisado: 9acf2ac6f0f053a4452e56c96077386fcd5aa252
- develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
- rama: feat/T-116-componente-mapa
- resultado: CON BLOQUEANTES (9)
- decisiones pendientes: ninguna
- D01: 1-A

## Preflight

- PR en Draft, autor P2.
- Sin comentarios ni threads al iniciar.
- 9 archivos modificados, dentro del scope general de la ficha.
- Rama behind 0.
- No existe docs/revision-pr/pr-109 escrito por el autor.
- No existe CC-011 separado.
- La ficha oficial se leyó desde develop.

## D01 — resuelta: 1-A

La ficha exige contract-change separado antes de modificar src/ui/map.tsx, package.json o pnpm-lock.yaml. Lautaro073 eligió 1-A: crear CC-011 separado, mergearlo primero y recién después retomar T-116.

## H01 — contrato compartido implementado antes del CC

El commit rojo dfc786a ya creó src/ui/map.tsx y fijó su API pública. 6790c92 agregó la implementación y la dependencia.

Corrección:
1. Pausar #109.
2. Crear CC-011 desde develop.
3. Revisar y mergear CC-011.
4. Volver a #109 y mergear origin/develop sin rebase ni force.
5. Resolver shared files a favor del CC mergeado.

## H02 — no hay fallback real cuando Google falla con key válida

map.tsx modela disponibilidad solo como Boolean(apiKey) && isOnline. APIProvider no usa onError ni se observa APILoadingStatus.FAILED.

Los tests llamados “Google caído” solo eliminan la key o ponen offline.

Control requerido: con key válida, forzar fallo del loader y exigir fallback textual operativo. Esta corrección pertenece a CC-011.

## H03 — lazy boundary rota

C01 y C03 importan MapSkeleton estáticamente desde @/ui/map y, a la vez, cargan MapPicker con dynamic import del mismo módulo.

La regla D15 exige que mapas no estén en bundles iniciales.

Evidencia:
- CI #430: /merchant/onboarding = 145 kB.
- CI #455: /merchant/onboarding = 165 kB.
- Entre ambas bases no hubo cambios de onboarding.

El límite <=180 kB no reemplaza la obligación de lazy-load.

## H04 — C01 no usa centroide del barrio como fallback

Merchant ZoneOption contiene solo id/name y getActiveZones selecciona solo id,name. MerchantOnboardingForm no pasa defaultZoneCenter.

La especificación C01 exige usar el centroide de la zona elegida si mapa/GPS no están disponibles.

## H05 — integración pin -> payload no protegida

Los tests nuevos verifican render/campos/toggle, pero no demuestran que un cambio de pin actualice lat/lng y llegue a la action.

Mutación que hoy sobrevive: convertir onChange del MapPicker en no-op.

Debe existir un test que fije coordenadas, envíe el formulario y afirme payload exacto para C01 y C03.

## H06 — el camino de cámara real está ciego

El test “actualiza las coordenadas al desplazar el centro del mapa” hace ArrowUp sobre map-container. Eso prueba D-pad/teclado, no GoogleMap.onCameraChanged.

En CC-011, mockear GoogleMap, disparar onCameraChanged con detail.center y afirmar coordenadas exactas. Eliminar el handler debe poner rojo.

## H07 — evidencia declarada pero no reproducible

Faltan capturas reales T-116 y evidencia axe/AA.

La ficha exige C01/C03 a 390 y 360 en:
- mapa disponible;
- Google caído;
- offline.

El body también declara 100% branches, pero CI #455 reporta para map.tsx:
- statements 97.26%
- branches 91.37%
- functions 80%

Corregir body/bitácora y adjuntar evidencia real.

## H08 — env pública fuera de la frontera canónica

Regla 25 define src/lib/env.public.ts como frontera de NEXT_PUBLIC_* y esa key ya existe allí.

map.tsx usa process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY directamente.

CC-011 debe consumir la frontera existente.

## H09 — controles duplicados

MapPicker siempre dibuja dirección manual y “Usar mi ubicación”.

C01 ya tiene su input de dirección.
C03 ya tiene dropoffAddress y un botón “Usar mi ubicación”; al abrir el mapa aparecen duplicados.

CC-011 debe definir un selector componible y T-116 debe dejar una sola instancia visible/accesible por control.

## Controles que sí pasan

- scope general correcto;
- rama al día;
- validación server-side de coordenadas ya existe;
- targets Button icon = 48x48;
- 0 .only/.skip, sleeps, any, @ts-ignore y hex arbitrarios en el diff;
- courier feed no importa el mapa actualmente.

## CI

CI #455 terminó verde y usa base ef09bb8ec9fa2335aa6e9e7ae11165301841a61d. Se consultó puntualmente para bundle, cobertura y base; no se usa el verde para cerrar bloqueantes.

## Dictamen

CON 9 BLOQUEANTES.

No aprobar ni mergear #109. Primero CC-011; luego retomar T-116.
