# Ronda 4 — PR #178 / CC-014

**Fecha:** 2026-10-01  
**SHA funcional:** `3f80a276fb936de6c06ed81030fe6ccedbad4242`  
**Base develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`  
**Resultado:** **APTO PARA MERGE — SIN BLOQUEANTES**

## Alcance

Desde el commit documental R3 `0c4d82d`, el autor modificó únicamente:

- `docs/contracts/CC-014.md`
- `src/ui/map.tsx`
- `src/ui/map.test.tsx`

No tocó `docs/revision-pr/pr-178/**`.

La rama está 7 commits ahead / 0 behind de `develop`, PR mergeable y no draft.

## PR178-H01 — arreglado-verificado

### Implementación

La corrección final separa coordenada y orden de cámara:

```ts
const [cameraTarget, setCameraTarget] = React.useState(fallbackCenter);
const [cameraSyncVersion, setCameraSyncVersion] = React.useState(0);

const requestCameraSync = React.useCallback((coords) => {
  setCameraTarget(coords);
  setCameraSyncVersion((version) => version + 1);
}, []);
```

`MapCameraSynchronizer` ya no deduplica por lat/lng; ejecuta `panTo` cuando cambia `syncVersion`.

`lastIncomingCoordsRef` evita tratar objetos nuevos con las mismas coordenadas como órdenes externas nuevas.

El effect de props:
- ignora rerenders equivalentes;
- identifica eco controlado por `sameCoordinates(next, activeCoordsRef.current)`;
- sincroniza selección;
- llama `requestCameraSync(next)` solo ante input externo genuino.

Drag/click no llaman `requestCameraSync`; GPS y teclado sí.

### Cobertura

La suite final contiene:
- drag/click directos → 0 `panTo`;
- eco controlado drag/click → 0 `panTo`;
- drag B → externo A → `panTo(A)`;
- click B → externo A → `panTo(A)`;
- mismo `value` numérico en objeto nuevo → 0 orden extra;
- mismo `defaultZoneCenter` tras selección manual → conserva selección;
- `defaultZoneCenter` realmente distinto → actualiza pin y `panTo(C)`;
- `value` externo A→B;
- GPS;
- teclado;
- ambas variantes de marcador;
- lifecycle de `gm_authFailure`.

### Control adversarial independiente

Modelo ejecutado con la semántica del HEAD:

```text
A inicial
direct B
echo B
externo A
rerender A equivalente
direct B
rerender A equivalente
externo C
```

Resultado:

```text
after_controlled_echo=[]
after_external_return_A=[A]
after_same_A_object=[A]
after_manual_B_then_same_incoming_A=[A]
after_external_C=[A,C]

versioned_sync=true
input_dedupe=true
controlled_echo_guard=true
no_fake_tests=true
```

El residual de R3 queda cerrado.

## PR178-H02 — arreglado-verificado

La evidencia RED permanece dirigida por conducta y no depende de un helper inexistente en develop.

No reapareció `resetAuthFailureBridgeForTesting`.

## PR178-H03 — arreglado-verificado

La API pública permanece sin helpers de testing. Los tests de bridge global, cleanup no-LIFO y restauración externa permanecen.

## PR178-H04 — arreglado-verificado

Lectura independiente actual de #171:

```text
P2
fase-3
bloqueada
```

`en-curso` está ausente.

## Calidad estática

```text
any=false
@ts-ignore/@ts-expect-error=false
.only/.skip=false
setTimeout en tests=false
resetAuthFailureBridgeForTesting=false
process.env directo=false
deep import @vis.gl=false
```

## CI exact-head 36956307854

```text
typecheck       success
lint            success
unit            success — 110 files / 1599 tests
build           success
audit           success
db-tests        success — 13 files / 1614 tests
bundle-budget   success

workflow tests 31
ADR tests 6

/merchant/onboarding   147 kB OK
/merchant/requests/new 163 kB OK
/design-system         184 kB warning preexistente
```

DB sufrió rate-limit transitorio de Docker Hub, reintentó y terminó PASS.

## Cierre

Todos los hallazgos PR178-H01…H04 están arreglados y verificados en el SHA funcional final.

**CC-014 está apta para merge a develop.**

La revisión no ejecuta el merge porque corresponde a Lautaro073.
