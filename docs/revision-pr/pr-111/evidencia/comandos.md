# Evidencia — PR #111 / CC-011 / Ronda 1

head: c18406839c5773fdb3bcd25ce5730ec817df6eba
develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
compare: ahead 2 / behind 0

## CI #457
unit: failure
typecheck: success
lint: success
build: success
db-tests: success
audit: success
bundle-budget: success

Coverage:
map-skeleton.tsx 100/100/100/100
map.tsx 90.02 statements / 68.42 branches / 91.66 funcs / 90.02 lines
threshold branches src/ui = 80%

## Cámara
map.tsx line 357: defaultCenter={activeCoords}.
Context7 @vis.gl docs: defaultCenter/defaultZoom are uncontrolled initial values only; center is controlled and follows external state.

## Tests
23 tests de map.test.tsx pasan.
No existe test de API key vacía en CC-011.
No existe rerender value/defaultZoneCenter que observe center del GoogleMap.

## UI rules
map.tsx line 356: inline style width/height.
rule 60: inline styles prohibited.
@vis.gl docs: Map default style already applies width:100% and height:100%.

map.tsx line 270: <label> sin htmlFor.
rule 60: labels asociados.

## Barrido
.only 0
.skip 0
sleep 0
any 0
@ts-ignore 0
process.env NEXT_PUBLIC direct 0
hex arbitrary 0

---

# Evidencia — Ronda 2

head: 36306c36150cb99c376ac4ebbc0bce1b061e512c
develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
compare: ahead 3 / behind 0

## CI #458

```text
event: pull_request
head: 36306c36150cb99c376ac4ebbc0bce1b061e512c
base: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
conclusion: success

lint           success
unit           success
db-tests       success
build          success
audit          success
typecheck      success
bundle-budget  success
```

## Unit / coverage

```text
67 files / 768 tests
map.tsx 99.45 statements / 90.21 branches / 100 funcs / 99.45 lines
```

## Build

```text
/merchant/onboarding 9.87 kB / 145 kB
/merchant/requests/new 135 B / 163 kB
```

## Source

map.tsx:
- center={activeCoords}
- no defaultCenter
- no style prop
- publicEnv para Google key/map id
- React.useId + role=region + aria-labelledby/aria-label

## Mutación H01

Los tests de zona/value/GPS afirman capturedMapProps.center. Volver de center a defaultCenter deja center undefined y rompe los tres controles.

## Barrido

0 .only/.skip, sleeps, @ts-ignore, process.env NEXT_PUBLIC direct, inline styles en código.

No se detectaron hallazgos nuevos.
