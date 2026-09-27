# PR #111 · CC-011 — Ronda 2 independiente

- SHA revisado: 36306c36150cb99c376ac4ebbc0bce1b061e512c
- develop: ef09bb8ec9fa2335aa6e9e7ae11165301841a61d
- resultado: SIN BLOQUEANTES
- decisiones pendientes: ninguna
- compare: ahead 3 / behind 0
- CI: #458 success

## H01 — CERRADO Y VERIFICADO

Source actual:

```tsx
<GoogleMap
  center={activeCoords}
  defaultZoom={15}
  ...
/>
```

Se verificaron tres propiedades:
- defaultZoneCenter A -> B actualiza capturedMapProps.center a B;
- value A -> B actualiza center a B;
- GPS exitoso actualiza onChange/onLocationFound y center a GPS.

La mutación center -> defaultCenter invalida esos tres controles porque el mock ya no recibe center.

## H02 — CERRADO Y VERIFICADO

CI #458:

```text
unit           success
typecheck      success
lint           success
build          success
db-tests       success
audit          success
bundle-budget  success
```

Suite:

```text
67 Test Files passed
768 Tests passed
```

Coverage de src/ui/map.tsx:

```text
statements  99.45%
branches    90.21%
functions  100%
lines       99.45%
```

Supera el threshold de branches >=80% sin bajar umbral ni excluir archivo.

## H03 — CERRADO Y VERIFICADO

No queda style={{...}} en src/ui/map.tsx. GoogleMap utiliza el sizing por defecto del SDK dentro del contenedor Tailwind.

El test renderizado verifica además que el mock de GoogleMap no reciba prop style.

## H04 — CERRADO Y VERIFICADO

MapPicker usa React.useId().

Con label:
- renderiza texto con id;
- map-container tiene role=region;
- aria-labelledby referencia el id;
- test consulta getByRole('region', {name:'Ubicación del local'}).

Sin label:
- usa aria-label={ariaLabel};
- existe test de nombre accesible custom y default.

## Performance / lazy boundary

Build #458:

```text
/merchant/onboarding  9.87 kB  145 kB
/merchant/requests/new 135 B   163 kB
```

El onboarding volvió a 145 kB, eliminando el +20 kB observado cuando MapSkeleton entraba desde el módulo pesado.

## Barrido final

Sobre contrato/source/tests:

```text
.only/.skip                  0
setTimeout/sleep             0
@ts-ignore                   0
process.env NEXT_PUBLIC_*    0
inline style en código       0
defaultCenter en map.tsx     0
center={activeCoords}        1
```

Las coincidencias de @vis.gl están únicamente donde corresponde: map.tsx, sus tests, contrato y package/lock.

## Dictamen

SIN BLOQUEANTES.

CC-011 está técnicamente lista para merge. No se retoma T-116 hasta que #111 esté mergeada en develop.
