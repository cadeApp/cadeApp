# PR #111 · CC-011 — Ronda 1 independiente

- SHA revisado: c18406839c5773fdb3bcd25ce5730ec817df6eba
- develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
- rama: cc/CC-011-map-contract
- resultado: CON BLOQUEANTES (4)
- decisiones pendientes: ninguna

## Preflight

- PR separada creada como exigía D01=1-A.
- Rama ahead 2 / behind 0.
- Scope correcto: contrato, map.tsx, map-skeleton.tsx, tests y dependencia.
- Sin comentarios/threads previos.
- No se detectó autoedición de docs/revision-pr.

## Lo que sí quedó bien

- CC-011 formaliza el contrato compartido.
- publicEnv reemplaza el acceso directo a process.env.
- MapSkeleton quedó desacoplado del SDK.
- Google FAILED/onError tiene fallback real y tests.
- onCameraChanged real está capturado por el mock y probado.
- MapPicker ya no renderiza dirección textual ni GPS por defecto, evitando duplicación con C01/C03.
- targets D-pad >=48px.
- lint, typecheck, build, audit, db-tests y bundle-budget están verdes.

## H01 — cámara externa/GPS no se sincroniza visualmente

GoogleMap recibe defaultCenter={activeCoords}.

La documentación oficial de @vis.gl define defaultCenter como estado inicial no controlado: se aplica solo al primer render. El prop center es el controlado.

Eso rompe escenarios que CC-011 necesita soportar:
- el padre cambia defaultZoneCenter al cambiar de barrio;
- el padre cambia value;
- showLocationButton obtiene GPS y setActiveCoords cambia.

En esos casos el badge React puede cambiar, pero la cámara del mapa no está obligada a recentrarse.

Corrección exacta:
- pasar center={activeCoords} al GoogleMap, manteniendo defaultZoom=15, o mecanismo equivalente realmente controlado;
- el mock debe capturar center;
- test A: render con zona A, rerender con zona B, esperar center=B;
- test B: showLocationButton + GPS, esperar center=coords GPS;
- mutación: volver a defaultCenter debe dejar ambos tests rojos.

## H02 — CI rojo por branch coverage

CI #457:
- src/ui/map.test.tsx: 23/23 tests verdes;
- suite total: 67 files / 759 tests verdes;
- coverage map.tsx: 90.02% statements, 68.42% branches, 91.66% funcs;
- threshold src/ui branches: 80%; job unit falla.

No bajes el threshold.

Agregar tests conductuales que cubran ramas del contrato, como mínimo:
1. API key vacía -> map-no-key-banner + fallback, sin GoogleMap.
2. defaultZoneCenter sin value -> center inicial correcto y rerender de otra zona.
3. navigator.geolocation ausente -> onLocationError + alerta.
4. error code=1 -> mensaje de permiso denegado.
5. disabled -> cámara/teclado/D-pad no producen onChange donde corresponda.
6. H01: GPS y prop externo recentran cámara.

El objetivo es >=80% branches por comportamiento real, no agregar tests tautológicos.

## H03 — style inline prohibido

map.tsx usa style={{ width:'100%', height:'100%' }} en GoogleMap.

Regla 60 prohíbe estilos inline. La documentación de @vis.gl indica que Map ya usa por defecto width/height 100%, así que la corrección más simple es eliminar ese prop.

No agregues excepción de ESLint ni cambies la regla.

## H04 — label sin asociación

El contrato expone label, pero renderiza un <label> sin htmlFor y el mapa es un div focusable.

Corrección recomendada:
- generar id con React.useId;
- renderizar texto visual con id;
- dar al contenedor focusable un rol nombrable y aria-labelledby cuando label existe;
- cuando no hay label, conservar aria-label={ariaLabel};
- agregar test que compruebe el nombre accesible del target.

No hace falta crear un input oculto ni fingir asociación htmlFor con un div.

## CI

CI #457:
- unit ❌ coverage
- typecheck ✅
- lint ✅
- build ✅
- db-tests ✅
- audit ✅
- bundle-budget ✅

## Dictamen

CON 4 BLOQUEANTES.

No mergear CC-011 todavía. T-116 / #109 sigue bloqueada hasta que CC-011 quede sin bloqueantes y se mergee.
