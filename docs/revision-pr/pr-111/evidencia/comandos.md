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
